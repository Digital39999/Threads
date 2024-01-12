import { CustomClient } from '../data/typings';
import { WorkerData } from './threads/base';
import { TextChannel } from 'discord.js';
import { createEmoji } from './utils';

export async function loadClientIPCMessages(client: CustomClient): Promise<void> {
	client.cluster?.on('message', async (message) => {
		const data = message.data as { type: 'database'; data: unknown; } | [string, WorkerData[]][]; // [guildId, WorkerData[]][]
		if ('type' in data) // { State: boolean; Connection: string; }
			client.database = data.data as { State: boolean; Connection: string; };
		else { // [guildId, WorkerData[]][]
			for (const [guildId, workerData] of data) {
				const guild = client.guilds.cache.get(guildId);
				if (!guild) continue;

				for (const worker of workerData) {
					const channel = guild.channels.cache.get(worker.channelId) as TextChannel | undefined;
					if (!channel) continue;

					if (channel.permissionsFor(client.user?.id as string)?.has(['SendMessages', 'EmbedLinks'])) {
						channel.send({
							content: worker.roleMention ? `Hey <@&${worker.roleMention}>!` : undefined,
							embeds: [{
								author: {
									url: worker.url,
									name: `New post from @${worker.username}!`,
									icon_url: worker.profilePicture,
								},
								description: worker.content || 'No caption.',
								url: worker.url,
								image: worker.image ? {
									url: worker.image,
								} : undefined,
								color: client.config?.embed.base_color,
								timestamp: new Date().toISOString(),
							}],
							components: [{
								type: 1,
								components: [{
									type: 2,
									label: 'View Post',
									style: 5,
									emoji: createEmoji('main.icons_magicwand'),
									url: worker.url,
								}],
							}],
						});
					}
				}
			}
		}
	});
}
