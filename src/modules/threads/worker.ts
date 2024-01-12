import { parentPort, workerData } from 'worker_threads';
import { Threads, MapUser, WorkerData } from './base';
import LoggerModule from '../logger';
import { Post } from 'threads-api';

const ThreadsApi = new Threads();

main().catch(console.error);
async function main() {
	LoggerModule('Worker', 'Worker ' + workerData.i + ' is starting..', 'cyan');

	const allUsers = await Promise.all((workerData.users as MapUser[]).map(async (user) => {
		await new Promise((resolve) => setTimeout(resolve, 1000));

		const thread = await ThreadsApi?.getLastThread({
			userId: user.id,
			username: user.username,
		}).catch((err) => {
			console.error(err.message);
			return null;
		});

		if (!thread || typeof thread === 'number') return null;

		if (thread?.id !== user.lastPostId) {
			const lastPost = thread.thread_items[0].post as Post;

			return ({
				id: user.id,
				postId: thread.id,
				username: user.username,
				verified: lastPost.user.is_verified,
				content: lastPost.caption?.text || null,
				profilePicture: lastPost.user.profile_pic_url,
				image: lastPost.image_versions2?.candidates?.[0]?.url || null,
				url: `https://www.threads.net/t/${lastPost.code}`,
				likes: lastPost.like_count,

				channelId: user.discordChannelId,
				roleMention: user.pingRole,
			} as WorkerData);
		}

		return null;
	}));

	parentPort?.postMessage(allUsers.filter((user) => user !== null));
}

export function catchError(error: Error) {
	if (error?.name?.includes('ExperimentalWarning') || error?.name?.includes('Unknown interaction')) return;

	LoggerModule('Manager', 'An error has occurred.', 'red');
	console.error(error);
}

process.env.NODE_NO_WARNINGS = '1';
process.on('warning', (warning) => catchError(warning));
process.on('uncaughtException', (error) => catchError(error));
process.on('unhandledRejection', (error) => catchError(error as Error));
