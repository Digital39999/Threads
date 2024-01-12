import { ConnectionState, CustomManager } from '../data/typings';
import config from '../data/config';
import LoggerModule from './logger';
import mongoose from 'mongoose';

export default async function connectMongoose(manager: CustomManager): Promise<{ State: boolean; Connection: ConnectionState | null; }> {
	try {
		return new Promise((resolve) => {
			mongoose.set('strictQuery', false);
			mongoose.connect(config?.database as string);

			mongoose.connection.on('connected', async () => {
				LoggerModule('Database', 'Connected to MongoDB.', 'magenta');
				resolve({ State: true, Connection: (['Disconnected', 'Connected', 'Connecting', 'Disconnecting'][mongoose.connection.readyState ?? 0] || 'Uninitialized') as ConnectionState });
			});

			mongoose.connection.on('disconnected', async () => {
				LoggerModule('Database', 'Disconnected from MongoDB.\n', 'red');
				resolve({ State: false, Connection: (['Disconnected', 'Connected', 'Connecting', 'Disconnecting'][mongoose.connection.readyState ?? 0] || 'Uninitialized') as ConnectionState });

				for (const cluster of manager.clusters.values()) cluster.send({ type: 'database', data: { State: false, Connection: (['Disconnected', 'Connected', 'Connecting', 'Disconnecting'][mongoose.connection.readyState ?? 0] || 'Uninitialized') as ConnectionState } });
			});

			mongoose.connection.on('error', async (er: unknown) => {
				LoggerModule('Database', 'Failed to connect to MongoDB.\n', 'red');
				throw new Error('Failed to connect to MongoDB. ' + er);
			});
		});
	} catch (er: unknown) {
		return { State: false, Connection: null };
	}
}
