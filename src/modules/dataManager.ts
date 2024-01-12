import { CustomManager, GuildStructureType } from '../data/typings';
import { FilterQuery, UpdateQuery } from 'mongoose';
import { GuildModel } from '../data/structures';
import config from '../data/config';
import LoggerModule from './logger';

/* ----------------------------------- Data ----------------------------------- */

export interface MapType<T> {
	data: T;
	lastAccessed: number;
}

export default class DataManager {
	private manager: CustomManager;

	static nullHitter: string[];
	private guildData: Map<string, MapType<GuildStructureType>>;

	constructor(manager: CustomManager) {
		this.manager = manager;
		DataManager.nullHitter = [];

		this.loadCacheSweeper();

		this.guildData = new Map();
	}

	/* ----------------------------------- Cache Functions ----------------------------------- */

	private loadCacheSweeper(): void {
		if (!config.dev.cache) return;

		setInterval(() => {
			if (config.dev.mode) {
				const guild = deleteFromCollection(this.guildData);
				LoggerModule('Cache Sweeper', `Successfully swept the cache. Deleted ${guild} items.`, 'grey');
			} else deleteFromCollection(this.guildData);

			function deleteFromCollection(collection: Map<string, { lastAccessed: number, data: GuildStructureType }>): number {
				if (collection.size === 0) return 0;
				let deleted = 0;

				for (const [key, value] of collection) {
					if (value.lastAccessed + 300000 < Date.now()) {
						collection.delete(key); deleted++;
					}
				}

				return deleted;
			}
		}, 300000); // 5 minutes
	}

	private async getMatchingItems(filter?: GuildStructureType | FilterQuery<GuildStructureType>): Promise<{ ids: string[], data: GuildStructureType[] }> {
		if (!filter || typeof filter !== 'object') return { ids: [], data: [] };

		return new Promise<{ ids: string[], data: GuildStructureType[] }>((resolve) => {
			const result: { ids: string[], data: GuildStructureType[] } = { ids: [], data: [] };

			const filterKeys = Object.keys(filter);
			if (!filterKeys.length) return resolve(result);

			const filtered = Array.from(this.guildData.values()).filter((guild) => {
				for (const key of filterKeys) {
					const value = filter[key as keyof typeof filter];
					switch (key) {
						case '$exists': {
							const keys = value.$exists;
							if (!Array.isArray(keys)) {
								throw new Error('$exists value must be an array');
							}
							for (const k of keys) {
								if (!guild.data[k as keyof typeof guild.data]) {
									return false;
								}
							}
							break;
						}
						case '$or': {
							const queries = value.$or;
							if (!Array.isArray(queries)) {
								throw new Error('$or value must be an array');
							}
							for (const query of queries) {
								if (typeof query !== 'object') {
									throw new Error('query in $or array must be an object');
								}
								if (Object.keys(query).some((k) => guild.data[k as keyof typeof guild.data] !== query[k as keyof typeof query])) {
									return false;
								}
							}
							break;
						}
						case '$ne': {
							const keys = value.$ne;
							if (!Array.isArray(keys)) {
								throw new Error('$ne value must be an array');
							}
							for (const k of keys) {
								if (guild.data[k as keyof typeof guild.data]) {
									return false;
								}
							}
							break;
						}
						default: {
							if (guild.data[key as keyof typeof guild.data] !== value) {
								return false;
							}
						}
					}
				}

				return true;
			});

			for (const guild of filtered) {
				result.ids.push(guild.data.guild);
				result.data.push(guild.data);
			}

			return resolve(result);
		});
	}

	/* ----------------------------------- Mongoose Main ----------------------------------- */

	async createData(inputData: Partial<GuildStructureType>): Promise<GuildStructureType | null> {
		if (this.manager.database?.State !== true) return null;

		const data: GuildStructureType | null = await GuildModel.create(inputData); // ?.catch((): null => null) as GuildStructureType | null;
		if (!data) return null;

		if (DataManager.nullHitter.includes(`guild|${inputData.guild}`)) nullHitter(`guild|${inputData.guild}`, false);

		if (config?.dev.cache) this.guildData.set(`guild|${inputData.guild}`, { lastAccessed: Date.now(), data: data });
		return data;
	}

	async getData(inputData: Partial<GuildStructureType> | FilterQuery<GuildStructureType>, createOnFail?: boolean): Promise<GuildStructureType | null> {
		if (this.manager.database?.State !== true) return null;

		if (DataManager.nullHitter.includes(`guild|${inputData.guild}`) && !createOnFail) return null;

		const data: GuildStructureType | null = this.guildData.get(`guild|${inputData.guild}`)?.data || await GuildModel.findOne(inputData)?.lean().catch((): null => null) as GuildStructureType | null;

		if (!data) {
			if (createOnFail) return await this.createData(inputData);

			nullHitter(`guild|${inputData.guild}`, true);
			return null;
		}

		return data;
	}

	async deleteData(inputData: Partial<GuildStructureType>, reCreate?: boolean): Promise<GuildStructureType | null> {
		if (this.manager.database?.State !== true) return null;

		if (DataManager.nullHitter.includes(`${inputData}`)) return null;

		if (config?.dev.cache) this.guildData.delete(`guild|${inputData.guild}`);

		const data: GuildStructureType | null = await GuildModel.deleteOne(inputData)?.lean().catch((): null => null) as GuildStructureType | null;
		if (data && reCreate) return await this.createData(inputData);

		return data;
	}

	async updateData(inputData: UpdateQuery<GuildStructureType> | Partial<GuildStructureType>, dataToUpdate: UpdateQuery<GuildStructureType> | Partial<GuildStructureType>): Promise<GuildStructureType | null> {
		if (this.manager.database?.State !== true) return null;

		if (DataManager.nullHitter.includes(`guild|${inputData.guild}`)) return null;

		const data: GuildStructureType | null = await GuildModel.findOneAndUpdate(inputData, dataToUpdate, { new: true })?.lean().catch((): null => null) as GuildStructureType | null;
		if (config?.dev.cache && data) this.guildData.set(`guild|${inputData.guild}`, { lastAccessed: Date.now(), data });

		return data;
	}

	async getAllData(inputData?: GuildStructureType | FilterQuery<GuildStructureType>, mognoose?: boolean, directMongoose?: boolean): Promise<GuildStructureType[] | null> {
		if (this.manager.database?.State !== true) return null;
		if (!config.dev.cache) directMongoose = true;

		if (directMongoose) {
			const data: GuildStructureType[] | null = await GuildModel.find(inputData || {})?.lean().catch((): null => null) as GuildStructureType[] | null;

			if (!data) return null;
			return data;
		} else {
			const allFromCache = await this.getMatchingItems(inputData);

			if (mognoose) {
				const filter = { ...inputData, ...(allFromCache.ids.length ? { guild: { $nin: allFromCache.ids } } : {}) };

				const data: GuildStructureType[] | null = await GuildModel.find(filter)?.lean().catch((): null => null) as GuildStructureType[] | null;
				if (!data && !allFromCache.data.length) return null;

				return [...allFromCache.data, ...(data ?? [])];
			}

			return allFromCache.data;
		}
	}
}

/* ----------------------------------- Util ----------------------------------- */

function nullHitter(identifier: string, add: boolean): boolean | null { // I'm stuid so i wrote comments.
	const hasIt: boolean = DataManager.nullHitter.includes(identifier);
	if ((hasIt && add) || (!hasIt && !add)) return null; // If it already has it and we're adding it, or if it doesn't have it and we're removing it, return null.

	if (!hasIt && add) DataManager.nullHitter.push(identifier); // If it doesn't have it and we're adding it, add it.
	if (hasIt && !add) DataManager.nullHitter.splice(DataManager.nullHitter.indexOf(identifier), 1); // If it has it and we're removing it, remove it.

	return true;
}
