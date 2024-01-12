import { Thread, ThreadsAPI, ThreadsUser } from 'threads-api';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { CustomManager } from '../../data/typings';
import { ShardingUtils } from 'status-sharding';
import { Worker } from 'worker_threads';
import { writeFile } from 'fs/promises';
import config from '../../data/config';
import LoggerModule from '../logger';
import fs from 'fs';

export type MapUser = {
	id: string;
	guildId: string;
	username: string;
	pingRole: string | null;
	lastPostId: string | null;
	discordChannelId: string;
};

export class Threads {
	public client: ThreadsAPI;
	public interval: NodeJS.Timeout | null = null;
	public useProxy: boolean;

	public proxies: { proxies: string[]; lastUpdated: number; } = {
		proxies: [],
		lastUpdated: 0,
	};

	public constructor() {
		this.useProxy = false;
		this.client = new ThreadsAPI({
			maxRetries: 3,
			deviceID: 'android-2zhdi8la3xm00000',
			...(config.loggedIn ? config.credentials : {}),
		});

		this.getRandomProxy().then(() => {
			this.client.httpAgent = new HttpsProxyAgent(`http://${this.proxies.proxies[Math.floor(Math.random() * this.proxies.proxies.length)]}`);
		});
	}

	// Error.
	private async handleError(err: Error, proxy: string | null): Promise<string> {
		if (this.useProxy && (err.message.includes('ETIMEDOUT') || err.message.includes('ECONNRESET') || err.message.includes('ECONNREFUSED'))) {
			proxy && this.removeProxy(proxy);
		} else console.error('Error (' + proxy + '): ' + err.message);

		return 'error';
	}

	// Proxy.
	public async getRandomProxy(force?: boolean) {
		const file: { proxies: string[]; lastUpdated: number; } = fs.existsSync('./proxies.json') ? JSON.parse(fs.readFileSync('./proxies.json', 'utf8')) : null;

		if (!force && file && file.proxies?.length && file.lastUpdated > Date.now() - 1000 * 60 * 60 * 1) {
			this.proxies = {
				proxies: file.proxies,
				lastUpdated: file.lastUpdated,
			};

			return this.proxies;
		}

		const proxy = await fetch('https://api.proxyscrape.com/?request=getproxies&proxytype=http&timeout=1000&country=all&ssl=all&anonymity=all').then((res) => res.text()).catch((err) => {
			console.error(err.message);
			return null;
		});

		if (!proxy) return null;

		this.proxies = {
			proxies: proxy.split('\r\n').filter((p) => p),
			lastUpdated: Date.now(),
		};

		writeFile('./proxies.json', JSON.stringify({
			proxies: this.proxies.proxies,
			lastUpdated: this.proxies.lastUpdated,
		}, null, 5), { flag: 'w+', encoding: 'utf8' });
		return this.proxies;
	}

	private async removeProxy(proxy: string) {
		this.proxies.proxies = this.proxies.proxies.filter((p) => p !== proxy);
		writeFile('./proxies.json', JSON.stringify({
			proxies: this.proxies.proxies,
			lastUpdated: this.proxies.lastUpdated,
		}, null, 5), { flag: 'w+', encoding: 'utf8' });
	}

	private async pickRandomProxy(): Promise<string | null> {
		if (!this.useProxy) return null;

		if (this.proxies.proxies.length === 0) await this.getRandomProxy(true);
		else if (this.proxies.lastUpdated < Date.now() - 1000 * 60 * 60 * 1) await this.getRandomProxy(true); // 1 hour

		const proxy = this.proxies.proxies[Math.floor(Math.random() * this.proxies.proxies.length)];
		if (!proxy) {
			await this.getRandomProxy();
			return this.pickRandomProxy();
		}

		this.removeProxy(proxy);
		return proxy;
	}

	private checkIfError<T, O extends T>(data: T): data is O {
		if (data === 'error') return false;
		return true;
	}

	// Utils.
	public async getUserId({ username, fullProfile }: { username: string; fullProfile?: boolean; }) {
		const proxy = await this.pickRandomProxy();

		const userId = (await this.client.getUserIDfromUsername(username, {
			proxy: proxy && {
				host: proxy.split(':')[0],
				port: Number(proxy.split(':')[1]),
			} || undefined,
			timeout: 10000,
		}).catch((err) => this.handleError(err, proxy)));

		LoggerModule('Threads', `Got user id for ${username} (${userId}).`, 'yellow');

		if (!userId) return null;
		else if (!this.checkIfError<string | number, string>(userId)) return 1;

		if (fullProfile) {
			const profile = await this.getProfile({ username, userId: userId.toString() });
			LoggerModule('Threads', `Got user profile for ${username} (${userId}).`, 'yellow');
			return profile;
		}

		return {
			id: userId,
			username,
		};
	}

	public async getLastPost({ username, userId }: { username: string; userId: string; }) {
		const proxy = await this.pickRandomProxy();

		const proxyData = proxy && {
			proxy: {
				host: proxy.split(':')[0],
				port: Number(proxy.split(':')[1]),
			},
			timeout: 10000,
		} || undefined;

		const threads = config.loggedIn ?
			await this.client.getUserProfileThreadsLoggedIn(userId, undefined, proxyData).then((d) => d.threads).catch((err) => this.handleError(err, proxy)) :
			await this.client.getUserProfileThreads(username, userId, proxyData).catch((err) => this.handleError(err, proxy));

		if (!threads) return null;
		else if (!this.checkIfError<Thread[] | string, Thread[]>(threads)) return 1;

		if (!threads?.[0]?.thread_items?.[0]?.post) return null;

		return {
			id: userId,
			postId: threads[0].id,
			username: threads[0].thread_items[0].post?.user.username,
			content: threads[0].thread_items[0].post?.caption?.text || null,
			profilePicture: threads[0].thread_items[0].post?.user.profile_pic_url,
			image: threads[0].thread_items[0].post?.image_versions2?.candidates?.[0]?.url || null,
			url: `https://www.threads.net/t/${threads[0].thread_items[0].post?.code}`,
		} as WorkerData;
	}

	public async getLastThread({ username, userId }: { username: string; userId: string; }) {
		const proxy = await this.pickRandomProxy();

		const proxyData = proxy && {
			proxy: {
				host: proxy.split(':')[0],
				port: Number(proxy.split(':')[1]),
			},
			timeout: 10000,
		} || undefined;

		const threads = config.loggedIn ?
			await this.client.getUserProfileThreadsLoggedIn(userId, undefined, proxyData).then((d) => d.threads).catch((err) => this.handleError(err, proxy)) :
			await this.client.getUserProfileThreads(username, userId, proxyData).catch((err) => this.handleError(err, proxy));

		if (!threads?.length) return null;
		else if (!this.checkIfError<Thread[] | string, Thread[]>(threads)) return 1;

		if (!threads?.[0]) return null;
		return threads[0];
	}

	public async getProfile({ username, userId }: { username: string; userId: string; }) {
		const proxy = await this.pickRandomProxy();

		const proxyData = proxy && {
			proxy: {
				host: proxy.split(':')[0],
				port: Number(proxy.split(':')[1]),
			},
			timeout: 10000,
		} || undefined;

		const profile = config.loggedIn ?
			await this.client.getUserProfileLoggedIn(userId, proxyData).then((d) => d.users[0]).catch((err) => this.handleError(err, proxy)) :
			await this.client.getUserProfile(username, userId, proxyData).catch((err) => this.handleError(err, proxy));

		if (!profile) return null;
		else if (!this.checkIfError<ThreadsUser | string, ThreadsUser>(profile)) return 1;

		return {
			id: userId,
			username: profile.username,
			verified: profile.is_verified,
			profilePicture: profile.profile_pic_url,
			private: profile.is_private,
			bio: profile.biography,
		} as WorkerUser;
	}
}
export class ThreadsWatcher extends Threads {
	public monitoredUsers: Map<string, MapUser> = new Map();

	public constructor(private manager: CustomManager) {
		super();
	}

	// Watcher.
	private async loadUsers() {
		const allGuildUsers = await this.manager._data?.getAllData({
			followedUsers: { $exists: true, $ne: [] },
		}, true) || [];

		for (const guild of allGuildUsers) {
			for (const followedUser of guild.followedUsers) {
				if (this.monitoredUsers.has(followedUser.id)) continue;

				this.monitoredUsers.set(followedUser.id, {
					id: followedUser.id,
					guildId: guild.guild,
					username: followedUser.username,
					lastPostId: followedUser.lastPostId,
					discordChannelId: followedUser.channelId,
					pingRole: followedUser.roleMention,
				});
			}
		}
	}

	public async watchUsers() {
		await this.loadUsers();

		this.interval = setInterval(async () => {
			const users = Array.from(this.monitoredUsers.values());
			if (!users.length) return;

			const guildData: Map<string, WorkerData[]> = new Map();

			for (let i = 0; i < users.length; i += 10) {
				const worker = new Worker('./dist/modules/threads/worker.js', {
					workerData: {
						users: users.slice(i, i + 10), // 10 users per worker.
						i,
					},
				});

				worker.once('message', (data: WorkerData[] | null) => {
					if (!data || !data.length) return;

					for (const user of data) {
						const monitoredUser = this.monitoredUsers.get(user.id);
						if (!monitoredUser) {
							this.monitoredUsers.delete(user.id);
							continue;
						}

						monitoredUser.lastPostId = user.postId;

						if (!guildData.has(monitoredUser.guildId)) guildData.set(monitoredUser.guildId, []);
						guildData.get(monitoredUser.guildId)?.push(user);

						this.monitoredUsers.set(user.id, monitoredUser);
					}

					this.manager._data?.updateData({
						followedUsers: {
							$elemMatch: {
								id: {
									$in: data.map((user) => user.id),
								},
							},
						},
					}, {
						$set: {
							'followedUsers.$.lastPostId': data.map((user) => user.postId),
							'followedUsers.$.avatarUrl': data.map((user) => user.profilePicture),
						},
					});

					worker.terminate();
				});
			}

			const clusterData: Map<number, Map<string, WorkerData[]>> = new Map();
			for (const [guildId, data] of guildData.entries()) {
				const clusterId = ShardingUtils.clusterIdForGuildId(guildId, this.manager.options.totalShards, this.manager.options.totalClusters);
				if (!clusterData.has(clusterId)) clusterData.set(clusterId, new Map());
				clusterData.get(clusterId)?.set(guildId, data);
			}

			for (const [clusterId, data] of clusterData.entries()) {
				this.manager.clusters.get(clusterId)?.send([...data.entries()]); // [guildId, WorkerData[]] -> [guildId, [user1, user2, user3]]
			}

			guildData.clear();
		}, 900000); // 15 minutes.
	}

	public async addFollowedUser({ guildId, userId, username, channelId, pingRole }: { guildId: string; userId: string; username: string; channelId: string; pingRole: string | null; }) {
		const currentUser = this.monitoredUsers.get(userId);

		this.monitoredUsers.set(userId, {
			id: userId,
			guildId,
			username: username || currentUser?.username as string,
			lastPostId: currentUser?.lastPostId || null,
			discordChannelId: channelId || currentUser?.discordChannelId as string,
			pingRole: pingRole || currentUser?.pingRole as string,
		});

		return true;
	}

	public async removeFollowedUser({ userId }: { userId: string; }) {
		if (!this.monitoredUsers.has(userId)) return false;
		this.monitoredUsers.delete(userId);

		return true;
	}
}

export type WorkerData = {
	id: string;
	postId: string;
	username: string;
	content: string | null;
	profilePicture: string;
	image: string | null;
	url: string;

	channelId: string;
	roleMention: string | null;
};

export type WorkerUser = {
	id: string;
	username: string;
	verified: boolean;
	profilePicture: string;
	private: boolean;
	bio?: string;
};
