import { ActionTypesThreads, ConnectionState, CustomManager, GuildStructureType } from './data/typings';
import { convertObjectIdsToStrings } from './modules/utils';
import LoggerModule, { LoggerBoot } from './modules/logger';
import { Cluster, ClusterManager } from 'status-sharding';
import { ThreadsWatcher } from './modules/threads/base';
import connectMongoose from './modules/database';
import DataManager from './modules/dataManager';
import { ObjectId } from 'mongoose';
import config from './data/config';

/* ----------------------------------- Process ----------------------------------- */

process.env.NODE_NO_WARNINGS = '1';
process.on('warning', (warning) => catchError(warning));
process.on('uncaughtException', (error) => catchError(error));
process.on('unhandledRejection', (error) => catchError(error as Error));

/* ----------------------------------------- Logging ----------------------------------------- */

console.clear(); LoggerBoot(); LoggerModule('Client', 'Threads is booting up.. please wait..', 'cyan');
config.dev.mode ? LoggerModule('Client', 'Developer mode is enabled, some features may not work properly.\n', 'cyan') : console.log('\n');

/* ----------------------------------- Manager ----------------------------------- */

const manager: CustomManager = new ClusterManager(`${__dirname}/cluster.js`, {
	token: config.bot.token,
	totalShards: config.sharding.shards,
	totalClusters: config.sharding.clusters,
	shardsPerClusters: config.sharding.shardsPerCluster,
	mode: 'worker',
}) as CustomManager;

/* ----------------------------------- Database ----------------------------------- */

async function mongoCheck(manager: CustomManager) {
	await connectMongoose(manager).then((Mongo: { State: boolean; Connection: ConnectionState | null; }) => {
		if (!Mongo.State) {
			LoggerModule('Database', 'Failed to connect to the database, shutting down..', 'red', true); process.exit(1);
		}

		manager.database = { State: Mongo.State, Connection: Mongo.Connection };
	});
}

export default manager;

/* ----------------------------------- Utils ----------------------------------- */

startLoading(manager);

async function startLoading(manager: CustomManager) {
	await mongoCheck(manager);

	manager._data = new DataManager(manager);
	manager.threads = new ThreadsWatcher(manager);

	setTimeout(() => loadClusters(manager), 3000); // 3 seconds
}

export function catchError(error: Error) {
	if (error?.name?.includes('ExperimentalWarning') || error?.name?.includes('Unknown interaction')) return;

	LoggerModule('Manager', 'An error has occurred.', 'red');
	console.error(error);
}

export async function evalExecute(code: unknown) {
	try {
		const result = function (str: string) { return eval(str); }.call(manager, code as string);
		return JSON.stringify(result, null, 5);
	} catch (error) {
		if (typeof error === 'string') return error;
		if (error instanceof EvalError) return `EvalError: ${error.message}`;

		try {
			return error?.toString();
		} catch (e) {
			return 'Failed to get error message, check console for more information.';
		}
	}
}

/* ----------------------------------- Internal ----------------------------------- */

export type DataType<T extends ActionTypesThreads> = {
	cachePassword: string;
	actionType: ActionTypesThreads;
	inputDataOptions: T extends 'getUserProfile' ? { userId: string; username: string; } : T extends 'getThreadsId' ? { username: string; fullProfile?: boolean; } : T extends 'manageUserCheck' ? { guildId?: string, userId: string, username?: string, channelId?: string; pingRole: string | null; } : T extends 'getLastPost' ? { userId: string, username: string } : Partial<GuildStructureType>;
	dataToUpdate: Partial<GuildStructureType>;
	arg1: boolean; arg2: boolean;
}

manager.on('clientRequest', async (message) => {
	const messageRaw = message.data as DataType<ActionTypesThreads>;

	if (messageRaw?.cachePassword) {
		let outputData = null;

		switch (messageRaw.actionType as ActionTypesThreads) {
			case 'createData': { outputData = await manager._data?.createData((messageRaw as DataType<'createData'>).inputDataOptions); break; }
			case 'getData': { outputData = await manager._data?.getData((messageRaw as DataType<'getData'>).inputDataOptions, messageRaw.arg1); break; }
			case 'deleteData': { outputData = await manager._data?.deleteData((messageRaw as DataType<'deleteData'>).inputDataOptions, messageRaw.arg1); break; }
			case 'updateData': { outputData = await manager._data?.updateData((messageRaw as DataType<'updateData'>).inputDataOptions, messageRaw.dataToUpdate); break; }
			case 'getAllData': { outputData = await manager._data?.getAllData((messageRaw as DataType<'getAllData'>).inputDataOptions, messageRaw.arg1, messageRaw.arg2); break; }

			case 'getThreadsId': { outputData = await manager.threads?.getUserId((messageRaw as DataType<'getThreadsId'>).inputDataOptions); break; }
			case 'getLastPost': { outputData = await manager.threads?.getLastPost(((messageRaw as DataType<'getLastPost'>).inputDataOptions)); break; }
			case 'getUserProfile': { outputData = await manager.threads?.getProfile((messageRaw as DataType<'getUserProfile'>).inputDataOptions); break; }
			case 'manageUserCheck': {
				if (messageRaw.arg1) outputData = await manager.threads?.addFollowedUser((messageRaw as DataType<'manageUserCheck'>).inputDataOptions as { guildId: string; userId: string; username: string; channelId: string; pingRole: string | null; });
				else outputData = await manager.threads?.removeFollowedUser((messageRaw as DataType<'manageUserCheck'>).inputDataOptions as { userId: string; });
				break;
			}
		}

		try {
			return message.reply({ password: messageRaw.cachePassword, data: JSON.stringify((typeof outputData === 'object' && (outputData as unknown as { _id: ObjectId })?._id) ? convertObjectIdsToStrings(outputData) : outputData) });
		} catch (error) {
			LoggerModule('Manager', 'Error while trying to send data.', 'red'); console.error(error);
			return message.reply({ password: messageRaw.cachePassword, data: null });
		}
	}
});

/* ----------------------------------- Clusters ----------------------------------- */

async function loadClusters(manager: CustomManager) {
	let clusterReadyCounter = 0;
	const clusterDiedCounter: { [x: string]: number } = {};

	manager.on('clusterCreate', (cluster: Cluster) => {
		LoggerModule('Clusters', `Launched Cluster ${cluster.id}.`, 'yellow');

		cluster.on('ready', () => {
			clusterReadyCounter++;

			if (clusterReadyCounter === config.sharding.shards) {
				setTimeout(() => {
					LoggerModule('Standby', 'All clusters are ready, Logging:\n', 'white', true);
				}, 1200);
			}
		});

		cluster.on('reconnecting', () => {
			LoggerModule('Clusters', `Cluster ${cluster.id} is reconnecting.`, 'yellow');
		});

		cluster.on('disconnect', async () => {
			LoggerModule('Clusters', `Cluster ${cluster.id} disconnected.`, 'red');

			if (!clusterDiedCounter[cluster.id]) clusterDiedCounter[cluster.id] = 0; clusterDiedCounter[cluster.id]++;
			if (clusterDiedCounter[cluster.id] < 3) await cluster.respawn().catch(() => LoggerModule('Clusters', `Failed to respawn cluster ${cluster.id}.`, 'red'));
		});

		cluster.on('error', async (error) => {
			LoggerModule('Clusters', `Error on cluster ${cluster.id}.`, 'red'); catchError(error);

			if (!clusterDiedCounter[cluster.id]) clusterDiedCounter[cluster.id] = 0; clusterDiedCounter[cluster.id]++;
			if (clusterDiedCounter[cluster.id] < 3) await cluster.respawn().catch(() => LoggerModule('Clusters', `Failed to respawn cluster ${cluster.id}.`, 'red'));
		});

		cluster.on('death', async () => {
			LoggerModule('Clusters', `Cluster ${cluster.id} died.`, 'red');

			if (!clusterDiedCounter[cluster.id]) clusterDiedCounter[cluster.id] = 0; clusterDiedCounter[cluster.id]++;
			if (clusterDiedCounter[cluster.id] < 3) await cluster.respawn().catch(() => LoggerModule('Clusters', `Failed to respawn cluster ${cluster.id}.`, 'red'));
		});
	});

	manager.spawn().then(() => {
		setInterval(() => manager.broadcastEval('this.ws.status && this.isReady() ? this.ws.reconnect() : 0'), 300000);
	});
}

/* ----------------------------------- End Of File ----------------------------------- */
