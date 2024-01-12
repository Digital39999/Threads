import { CommandInteraction, CommandInteractionOptionResolver } from 'discord.js';
import { CustomClient } from '../data/typings';
import { createEmoji } from '../modules/utils';

export default {
	name: 'help',
	description: 'Show all information about Threads, its commands, preview and demonstrations.',
	options: [{
		name: 'hidden',
		description: 'Would you like to make your configuration private?',
		type: 5,
	}],

	run: async (client: CustomClient, interaction: CommandInteraction) => {
		const hidden: boolean = (interaction.options as CommandInteractionOptionResolver).getBoolean('hidden') as boolean;
		await interaction.deferReply({ ephemeral: hidden ?? false });

		interaction.editReply({
			embeds: [{
				title: 'Threads • Help',
				description: '> Bringing the latest Instagram posts directly to your Discord server - stay connected with the Instagram Threads Discord Bot!\n> Not sure how to start? Join our [support server](' + client.config?.link.support + ') and we\'ll help you out!',
				color: client.config?.embed.base_color,
				thumbnail: {
					url: client.user?.displayAvatarURL() as string,
				},
				footer: { text: 'Each user is checked once every 15 minutes. If the bot doesn\'t send a message, Threads.net API blocked us temporarily. Please be patient.' },
				fields: [{
					name: client.emoji?.main.icons_search + ' • Commands',
					value: '> ' + client.functions?.getCommand('help') + ' • Spawns this help embed.\n> ' + client.functions?.getCommand('threads') + ' - Manage all followed users.',
					inline: false,
				}],
			}, {
				title: 'Threads • Deprecation Notice',
				description: '> Based on the notification from Meta, it\'s clear that using or distributing the code might violate the terms of service of Meta Platforms, Inc. and its associated services, including but not limited to Instagram and Threads.',
				color: client.config?.embed.idle,
				thumbnail: {
					url: 'https://raw.githubusercontent.com/junhoyeo/threads-api/main/.github/logo.jpg',
				},
				fields: [{
					name: client.emoji?.main.icons_warning + ' • What does this mean?',
					value: '> Threads will be discontinued until the official API is released. This means that the bot will not be able to function properly and/or will be unstable.',
				}, {
					name: client.emoji?.main.icons_warning + ' • What will happen to my data?',
					value: '> Your data will be kept safe and secure. However, you will not be able to use the bot for the time being.',
				}, {
					name: client.emoji?.main.icons_warning + ' • Why is this happening?',
					value: '> Threads is using an unofficial API to fetch data from Instagram. This is against the terms of service of Instagram and Meta Platforms, Inc. and its associated services.',
				}, {
					name: client.emoji?.main.icons_info + ' • Read More..',
					value: '> [Library Cease and Desist Notice](https://github.com/junhoyeo/threads-api?tab=readme-ov-file#-threads-api).',
				}],
			}],
			components: [{
				type: 1,
				components: [{
					type: 2,
					label: 'Invite Me',
					emoji: createEmoji('fromMyServer.link'),
					style: 5,
					url: client.config?.link.invite as string,
				}, {
					type: 2,
					label: 'Support Server',
					emoji: createEmoji('fromMyServer.link'),
					style: 5,
					url: client.config?.link.support as string,
				}, {
					type: 2,
					label: 'Upvote Me',
					emoji: createEmoji('fromMyServer.link'),
					style: 5,
					url: client.config?.link.topgg as string,
				}],
			}, {
				type: 1,
				components: [{
					type: 2,
					label: 'Website',
					emoji: createEmoji('fromMyServer.link'),
					style: 5,
					url: client.config?.link.website as string,
				}, {
					type: 2,
					label: 'Checkout Status Bot',
					emoji: createEmoji('fromMyServer.link'),
					style: 5,
					url: client.config?.link.status as string,
				}],
			}, {
				type: 1,
				components: [{
					type: 2,
					label: 'View Quick Setup Tutorial',
					emoji: createEmoji('fromMyServer.link'),
					style: 5,
					url: 'https://us-east-1.tixte.net/uploads/cdn.crni.xyz/YOBNMNFp1.mp4',
				}],
			}],
		});
	},
};
