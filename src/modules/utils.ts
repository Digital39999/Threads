import { CommandInteraction, InteractionEditReplyOptions, AnySelectMenuInteraction, ButtonInteraction, MessageComponentInteraction, ComponentType, APIMessageComponentEmoji } from 'discord.js';
import { ActionTypesThreads, AllInteractionTypes, CustomClient, GuildStructureType } from '../data/typings';
import { FilterQuery, PipelineStage } from 'mongoose';
import { WorkerData, WorkerUser } from './threads/base';
import getEmojis from '../data/emojis';
import config from '../data/config';
import LoggerModule from './logger';
import path from 'node:path';

export async function requestDataFromManager<T extends ActionTypesThreads>(action: T, inputData?: T extends 'getUserProfile' ? { userId: string; username: string; } : T extends 'getThreadsId' ? { username: string; fullProfile?: boolean } : T extends 'manageUserCheck' ? { guildId?: string, userId: string, username?: string, channelId?: string; pingRole?: string | null; } : T extends 'getLastPost' ? { userId: string, username: string } : Partial<GuildStructureType> | PipelineStage[], updateData?: (Partial<GuildStructureType>), arg1?: boolean, arg2?: boolean): Promise<(T extends 'getAllData' ? GuildStructureType[] : T extends 'getData' ? GuildStructureType : T extends 'createData' ? GuildStructureType : T extends 'updateData' ? GuildStructureType : T extends 'deleteData' ? boolean : T extends 'getThreadsId' ? { id: string; username: string; } | WorkerUser: T extends 'manageUserCheck' ? boolean : T extends 'getLastPost' ? WorkerData : T extends 'getUserProfile' ? WorkerUser : never) | null> {
	const client = await import(path.join('..', 'cluster')).then((file) => file.default).catch(() => null) as CustomClient;
	type Internal = (T extends 'getAllData' ? GuildStructureType[] : T extends 'getData' ? GuildStructureType : T extends 'createData' ? GuildStructureType : T extends 'updateData' ? GuildStructureType : T extends 'deleteData' ? boolean : never) | null;

	const data = await client.cluster?.request({
		cachePassword: 'dataRequest',
		inputDataOptions: inputData,
		dataToUpdate: updateData,
		actionType: action,
		arg1: arg1,
		arg2: arg2,
	}).catch((): null => null) as { password: string; data: string; } | null;

	try {
		return JSON.parse(data?.data as string) as unknown as Internal;
	} catch (e) {
		return null;
	}
}

export const CustomCacheFunctions = {
	async createData(inputData: Partial<GuildStructureType>): Promise<GuildStructureType | null> { return await requestDataFromManager('createData', inputData); },
	async getData(inputData: Partial<GuildStructureType> | FilterQuery<GuildStructureType>, createOnFail?: boolean): Promise<GuildStructureType | null> { return await requestDataFromManager('getData', inputData, undefined, createOnFail); },
	async deleteData(inputData: Partial<GuildStructureType>, reCreate?: boolean): Promise<boolean | null> { return await requestDataFromManager('deleteData', inputData, undefined, reCreate); },
	async updateData(inputData: Partial<GuildStructureType>, dataToUpdate: (Partial<GuildStructureType>)): Promise<GuildStructureType | null> { return await requestDataFromManager('updateData', inputData, dataToUpdate); },
	async getAllData(inputData?: GuildStructureType | FilterQuery<GuildStructureType>, mognoose?: boolean, directMongoose?: boolean): Promise<GuildStructureType[] | null> { return await requestDataFromManager('getAllData', inputData, undefined, mognoose, directMongoose); },

	async getThreadsUserId<T extends boolean>(username: string, fullProfile?: boolean): Promise<(T extends true ? WorkerUser : { id: string; username: string; }) | 1 | null> { return await requestDataFromManager('getThreadsId', { username, fullProfile }) as (T extends true ? WorkerUser : { id: string; username: string; }) | 1 | null; },
	async manageUserCheck(type: 'add' | 'remove', options: { guildId?: string, userId: string, username?: string, channelId?: string; pingRole?: string | null; }): Promise<boolean | null> { return await requestDataFromManager('manageUserCheck', options, undefined, type === 'add'); },
	async getUserProfile(userId: string, username: string): Promise<WorkerUser | 1 | null> { return await requestDataFromManager('getUserProfile', { userId, username }); },
	async getLastPost(userId: string, username: string): Promise<WorkerData | 1 | null> { return await requestDataFromManager('getLastPost', { userId, username }); },
};

export function convertObjectIdsToStrings<T>(data: T): T {
	try {
		if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean' || data === null || data === undefined) return data;

		const dataType = Object.prototype.toString.call(data);

		if (dataType === '[object Object]') {
			for (const key in data) {
				if (Object.prototype.hasOwnProperty.call(data, key)) {
					if (key === '_id') data[key] = data[key]?.toString() as unknown as (T & { _id: string })[Extract<keyof T, string>];
					else data[key] = convertObjectIdsToStrings(data[key]);
				}
			}
		} else if (dataType === '[object Array]') {
			for (let i = 0; i < (data as Array<T>).length; i++) (data as Array<T>)[i] = convertObjectIdsToStrings((data as Array<T>)[i]);
		}

		return data;
	} catch (error) {
		throw new Error(`[convertObjectIdsToStrings] ${JSON.stringify(data, null, 5)}\n${error}`);
	}
}

export async function quickCollector(interaction: CommandInteraction, data: InteractionEditReplyOptions, cb: (click: AnySelectMenuInteraction | ButtonInteraction | null | 1) => void): Promise<void> {
	await interaction.editReply(data).then(async (m) => {
		await m?.awaitMessageComponent({
			time: 1000 * 60 * 10, // 10 minutes
			filter: (inter) => {
				if (config.dev.users.includes(inter.user.id)) return true;
				else if (inter.user.id !== interaction.user.id) inter?.reply({
					ephemeral: true,
					content: getEmojis('fromMyServer.error') + ' • You cannot manage that menu.',
				});

				return inter.user.id === interaction.user.id;
			},
		}).then((click) => {
			if (!click) cb(null);

			if (click?.customId === 'exit') {
				interaction.editReply({
					content: getEmojis('fromMyServer.correct') + ' • Successfully exited the menu.',
					components: [], embeds: [],
				}).catch(() => null);

				return cb(1);
			}

			switch (click?.componentType) {
				case ComponentType.Button: cb(click as Extract<MessageComponentInteraction, { componentType: ComponentType.Button }>); break;
				case ComponentType.StringSelect: cb(click as Extract<MessageComponentInteraction, { componentType: ComponentType.StringSelect }>); break;
				case ComponentType.RoleSelect: cb(click as Extract<MessageComponentInteraction, { componentType: ComponentType.RoleSelect }>); break;
				case ComponentType.ChannelSelect: cb(click as Extract<MessageComponentInteraction, { componentType: ComponentType.ChannelSelect }>); break;
				case ComponentType.UserSelect: cb(click as Extract<MessageComponentInteraction, { componentType: ComponentType.UserSelect }>); break;
				default: cb(null); break;
			}
		}).catch(() => cb(null));
	}).catch(() => cb(null));
}

export async function errorHandlerMenu(client: CustomClient, interaction: AllInteractionTypes): Promise<void> {
	if (!interaction || !client) LoggerModule('Functions ErrorHandler', 'No interaction or client was provided.', 'red');

	if (interaction.replied) {
		if (interaction.deferred) await interaction.editReply({
			content: getEmojis('fromMyServer.error') + ' • Unknown error occurred, please try again.',
			embeds: [], components: [],
		}).catch(() => null);
		else await interaction.followUp({
			ephemeral: true,
			content: getEmojis('fromMyServer.error') + ' • Unknown error occurred, please try again.',
			embeds: [], components: [],
		}).catch(() => null);
	} else {
		if (interaction.deferred) await interaction.editReply({
			content: getEmojis('fromMyServer.error') + ' • Unknown error occurred, please try again.',
			embeds: [], components: [],
		}).catch(() => null);
		else await interaction.reply({
			ephemeral: true,
			content: getEmojis('fromMyServer.error') + ' • Unknown error occurred, please try again.',
			embeds: [], components: [],
		}).catch(() => null);
	}
}

export function createEmoji(emojiName: string): APIMessageComponentEmoji {
	const emojis: { [key: string]: { [key: string]: string } } = getEmojis<undefined>();

	return {
		name: emojis?.[emojiName.split('.')[0]]?.[emojiName.split('.')[1]]?.split(':')[1],
		id: emojis?.[emojiName.split('.')[0]]?.[emojiName.split('.')[1]]?.split(':')[2].replace('>', ''),
	};
}
