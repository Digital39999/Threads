import { ChannelSelectMenuInteraction, CommandInteraction, CommandInteractionOptionResolver, PermissionsString, RoleSelectMenuInteraction, StringSelectMenuInteraction, TextChannel } from 'discord.js';
import { CustomClient, ExtendedHandlerOptions, GuildStructureType, SlashCommandsType } from '../data/typings';
import { createEmoji, errorHandlerMenu, quickCollector } from '../modules/utils';
import { randomBytes } from 'node:crypto';

export default {
	name: 'threads',
	description: 'Manager followed users from Threads by Instagram.',
	permissions: {
		user: ['ManageGuild'],
	},
	options: [{
		name: 'hidden',
		description: 'Would you like to make your configuration private?',
		type: 5,
		required: false,
	}],

	run: async (client: CustomClient, interaction: CommandInteraction) => {
		const hidden: boolean = (interaction.options as CommandInteractionOptionResolver).getBoolean('hidden') as boolean;
		await interaction.deferReply({ ephemeral: hidden ?? false });

		return interaction.editReply({
			content: client.emoji?.main.icons_warning + ' • This command is unavailable. Read more with ' + client.functions?.getCommand('help') + '.',
			components: [],
			embeds: [],
		});

		await updatesHandlerExtended('main', {
			client, interaction, slashData: {
				firstLoad: true,
				currentUser: null,
				followedUsers: [],
			},
		});
	},
} as SlashCommandsType;

async function updatesHandlerExtended(page: string, { client, interaction, slashData }: ExtendedHandlerOptions): Promise<void> {
	const DBGuild = await client._data?.getData({ guild: interaction.guildId }, true);

	if (!slashData.followedUsers.length && slashData.firstLoad) slashData.followedUsers = DBGuild?.followedUsers ?? [];
	if (slashData.firstLoad) slashData.firstLoad = false;

	switch (page) {
		case 'main': {
			await quickCollector(interaction, {
				embeds: [{
					title: 'Threads • Following Configuration',
					color: client.config?.embed.base_color,
					description: '> Here you can effortlessly add and manage the accounts you\'re following, ensuring you never miss a post. Simply add the user\'s username and you\'re good to go! Not sure how to start? Join our [support server](' + client.config?.link.support + ') and we\'ll help you out! Click the button below to get started or use the dropdown menu to manage your followed users.',
				}],
				components: [{
					type: 1,
					components: [{
						type: 3,
						custom_id: 'allUsers',
						options: slashData.followedUsers.filter((u) => u.id).length > 0 ? slashData.followedUsers?.map((user) => ({
							label: `@${user.username}`,
							value: user.id as string,
							description: `ID: ${user.id}`,
							default: user.id === slashData.currentUser?.id,
							emoji: createEmoji('main.icons_Person'),
						})) : [{
							label: 'Add User below to get started.',
							value: 'none',
							emoji: createEmoji('main.icons_Person'),
						}],
						disabled: !slashData.followedUsers.filter((u) => u.id).length,
						placeholder: 'Manage Followed Users',
					}],
				}, {
					type: 1,
					components: [{
						type: 2,
						style: 2,
						label: 'Save & Exit',
						emoji: createEmoji('fromMyServer.correct'),
						custom_id: 'save',
					}, {
						type: 2,
						style: 3,
						label: 'Add User',
						emoji: createEmoji('main.icons_join'),
						disabled: slashData.followedUsers.length >= 20,
						custom_id: 'add',
					}],
				}, {
					type: 1,
					components: [{
						type: 2,
						style: 5,
						label: 'Support Server',
						emoji: createEmoji('fromMyServer.link'),
						url: client.config?.link.support as string,
					}],
				}],
			}, async (click) => {
				if (click === 1) return; if (!click) return errorHandlerMenu(client, interaction);

				switch (click.customId) {
					case 'add': {
						await click.deferUpdate().catch((): unknown => null);

						await updatesHandlerExtended('add', {
							client, interaction, slashData,
						});

						break;
					}
					case 'save': {
						click.deferUpdate().catch((): unknown => null);

						await client._data?.updateData({ guild: interaction.guildId as string }, { followedUsers: slashData.followedUsers as GuildStructureType['followedUsers'] });

						await interaction.editReply({
							content: client.emoji?.fromMyServer.correct + ' • Successfully exited the menu.',
							components: [], embeds: [],
						}).catch(() => null);

						break;
					}
					case 'allUsers': {
						await click.deferUpdate().catch((): unknown => null);

						slashData.currentUser = slashData.followedUsers.find((user) => user.id === (click as StringSelectMenuInteraction).values[0]) as GuildStructureType['followedUsers'][0];

						await updatesHandlerExtended('user', {
							client, interaction, slashData,
						});

						break;
					}
				}
			});

			break;
		}
		case 'user': {
			let perms = '';

			const isSpamDone = (spamSet: number | undefined) => {
				if (!spamSet || spamSet < Date.now()) return false; // Not done, cant use yet.

				const timeLeft = (spamSet - Date.now()) / 1000;
				const minutes = Math.floor(timeLeft / 60);

				return minutes ? `${minutes}m ${Math.floor(timeLeft - minutes * 60)}s.` : `${Math.floor(timeLeft)}s.`;
			};

			const isSpamDoneVar = {
				refresh: isSpamDone(client.spamSet?.get(slashData.currentUser?.id as string + '|refresh')),
				test: isSpamDone(client.spamSet?.get(slashData.currentUser?.id as string + '|test')),
			};

			if (slashData.currentUser?.channelId) {
				const missingPerms = interaction.guild?.members.me?.permissionsIn(slashData.currentUser?.channelId).missing(['ViewChannel', 'SendMessages', 'EmbedLinks', 'ReadMessageHistory', 'AttachFiles', 'UseExternalEmojis']);
				if ((missingPerms?.length || 0) > 0) perms = `${client.emoji?.fromMyServer.warn} Missing permissions (<#${slashData.currentUser?.channelId}>): ${missingPerms?.map((perm: PermissionsString) => `\`${perm}\``).join(', ')}.`;
			}

			await quickCollector(interaction, {
				embeds: [{
					title: 'Threads • Following Configuration',
					color: client.config?.embed.base_color,
					description: '> **User**: ' + (slashData.currentUser?.username ? `[@${slashData.currentUser?.username}](https://www.threads.net/@${slashData.currentUser?.username})` : 'None') + '\n> **Post Channel**: ' + (slashData.currentUser?.channelId ? `<#${slashData.currentUser?.channelId}>` : 'None') + '\n> **Ping Role**: ' + (slashData.currentUser?.roleMention ? `<@&${slashData.currentUser?.roleMention}>` : 'None') + '\n' + (isSpamDoneVar.test ? '> You may use test again in ' + isSpamDoneVar.test : '') + (isSpamDoneVar.refresh ? (isSpamDoneVar.test ? '\n' : '') + '> You may use refresh again in ' + isSpamDoneVar.refresh : '') + '\n\n' + perms,
					footer: {
						text: 'If you send test post which might be latest, regular interval will send the same post again.',
					},
					thumbnail: {
						url: slashData.currentUser?.avatarUrl as string || client.user?.displayAvatarURL() as string,
					},
				}],
				components: [{
					type: 1,
					components: [{
						type: 3,
						custom_id: 'allUsers',
						options: slashData.followedUsers?.map((user) => ({
							label: `@${user.username}`,
							value: user.id as string,
							description: `ID: ${user.id}`,
							default: user.id === slashData.currentUser?.id,
							emoji: createEmoji('main.icons_Person'),
						})) || [{
							label: 'No users found.',
							value: 'none',
							description: 'No users found.',
							emoji: createEmoji('main.icons_Person'),
						}],
						disabled: !slashData.followedUsers.length,
						placeholder: 'Manage Followed Users',
					}],
				}, {
					type: 1,
					components: [{
						type: 8,
						custom_id: 'change_channel',
						placeholder: 'Select a new channel for posts.',
						channel_types: [0],
					}],
				}, {
					type: 1,
					components: [{
						type: 6,
						custom_id: 'change_role',
						placeholder: 'Select a new role for notifications.',
					}],
				}, {
					type: 1,
					components: [{
						type: 2,
						style: 3,
						label: 'Start Checking',
						emoji: createEmoji('main.icons_shine1'),
						disabled: !slashData.currentUser?.channelId || !slashData.currentUser?.id || !slashData.currentUser?.username,
						custom_id: 'start',
					}, {
						type: 2,
						style: 2,
						label: 'Send Test Post',
						emoji: createEmoji('main.icons_shine2'),
						disabled: !slashData.currentUser?.channelId || !slashData.currentUser?.id || !slashData.currentUser?.username || !isSpamDoneVar.test,
						custom_id: 'test',
					}, {
						type: 2,
						style: 2,
						label: 'Refresh',
						emoji: createEmoji('main.icons_loading'),
						disabled: !isSpamDoneVar.refresh,
						custom_id: 'refresh',
					}],
				}, {
					type: 1,
					components: [{
						type: 2,
						style: 2,
						label: 'Back',
						emoji: createEmoji('main.icons_reply'),
						custom_id: 'back',
					}, {
						type: 2,
						style: 4,
						label: 'Remove ' + (slashData.currentUser?.username ? `@${slashData.currentUser?.username}` : 'User'),
						emoji: createEmoji('main.icons_leave'),
						disabled: !slashData.currentUser?.username,
						custom_id: 'remove',
					}],
				}],
			}, async (click) => {
				if (click === 1) return; if (!click) return errorHandlerMenu(client, interaction);

				switch (click.customId) {
					case 'refresh': {
						await click.deferUpdate().catch((): unknown => null);

						interaction.editReply({
							embeds: [{
								title: 'Threads • Fetching User',
								color: client.config?.embed.idle,
								description: '> Please wait, we\'re fetching user data..',
							}],
							components: [],
						});

						const newProfile = await client._data?.getUserProfile(slashData.currentUser?.id as string, slashData.currentUser?.username as string);

						if (typeof newProfile === 'number') {
							interaction.editReply({
								embeds: [{
									title: 'Threads • Fetching User',
									color: client.config?.embed.offline,
									description: '> We\'re sorry, but it seems like we are rate-limited, as Threads API is in early stages it is unstable, we encurage you to try again later.. :(',
								}],
								components: [],
							});

							await new Promise((resolve) => setTimeout(resolve, 7000));

							await updatesHandlerExtended('user', {
								client, interaction, slashData,
							});

							break;
						}

						if (newProfile) {
							slashData.currentUser = {
								...slashData.currentUser,
								avatarUrl: newProfile.profilePicture,
								username: newProfile.username,
								bio: newProfile.bio,
							};
						}

						client.spamSet?.setEx(1000 * 60 * 5, slashData.currentUser?.id as string + '|refresh', Date.now() + 1000 * 60 * 5); // 5 minutes.

						await updatesHandlerExtended('user', {
							client, interaction, slashData,
						});

						break;
					}
					case 'change_channel': {
						await click.deferUpdate().catch((): unknown => null);

						const followedUser = slashData.followedUsers.find((user) => user.id === slashData.currentUser?.id);
						if (followedUser) followedUser.channelId = (click as ChannelSelectMenuInteraction).values[0];

						slashData.followedUsers = slashData.followedUsers.map((user) => user.id === slashData.currentUser?.id ? followedUser : user) as GuildStructureType['followedUsers'] || [];

						await updatesHandlerExtended('user', {
							client, interaction, slashData,
						});

						break;
					}
					case 'change_role': {
						await click.deferUpdate().catch((): unknown => null);

						const followedUser = slashData.followedUsers.find((user) => user.id === slashData.currentUser?.id);
						if (followedUser) followedUser.roleMention = (click as RoleSelectMenuInteraction).values[0];

						slashData.followedUsers = slashData.followedUsers.map((user) => user.id === slashData.currentUser?.id ? followedUser : user) as GuildStructureType['followedUsers'] || [];

						await updatesHandlerExtended('user', {
							client, interaction, slashData,
						});

						break;
					}
					case 'test': {
						await click.deferUpdate().catch((): unknown => null);

						interaction.editReply({
							embeds: [{
								title: 'Threads • Sending Test Post',
								color: client.config?.embed.idle,
								description: `> Sending a test post to @${slashData.currentUser?.id}.. Please wait..`,
							}],
							components: [],
						});

						client.spamSet?.setEx(1000 * 60 * 5, slashData.currentUser?.id as string + '|test', Date.now() + 1000 * 60 * 5); // 5 minutes.

						const lastPost = await client._data?.getLastPost(slashData.currentUser?.id as string, slashData.currentUser?.username as string);
						if (!lastPost) {
							interaction.editReply({
								embeds: [{
									title: 'Threads • Fetching Posts',
									color: client.config?.embed.dnd,
									description: `> No posts found for @${slashData.currentUser?.id}.\n> Returning to the main menu.. Please wait..`,
								}],
								components: [],
							});

							await new Promise((resolve) => setTimeout(resolve, 7000)); // 4 seconds

							await updatesHandlerExtended('main', {
								client, interaction, slashData,
							});

							break;
						} else if (typeof lastPost === 'number') {
							interaction.editReply({
								embeds: [{
									title: 'Threads • Fetching Posts',
									color: client.config?.embed.offline,
									description: '> We\'re sorry, but it seems like we are rate-limited, as Threads API is in early stages it is unstable, we encurage you to try again later.. :(',
								}],
								components: [],
							});

							await new Promise((resolve) => setTimeout(resolve, 7000)); // 4 seconds

							await updatesHandlerExtended('user', {
								client, interaction, slashData,
							});

							break;
						}

						const channel = interaction.guild?.channels.cache.get(slashData.currentUser?.channelId as string) as TextChannel;
						if (!channel || !channel.permissionsFor(client.user?.id as string)?.has(['SendMessages', 'EmbedLinks'])) {
							interaction.editReply({
								embeds: [{
									title: 'Threads • Test Post',
									color: client.config?.embed.dnd,
									description: `> Could not send a test post to <#${slashData.currentUser?.channelId}>.\n> Make sure I have the following permissions: \`Send Messages\`, \`Embed Links\`, \`Use External Emojis\`, \`Add Reactions\`.\n> Returning to the main menu.. Please wait..`,
								}],
								components: [],
							});

							await new Promise((resolve) => setTimeout(resolve, 7000)); // 4 seconds

							await updatesHandlerExtended('user', {
								client, interaction, slashData,
							});

							break;
						}

						channel.send({
							embeds: [{
								author: {
									url: lastPost.url,
									name: `New post from @${lastPost.username}!`,
									icon_url: lastPost.profilePicture,
								},
								description: lastPost.content || 'No caption.',
								url: lastPost.url,
								image: lastPost.image ? {
									url: lastPost.image,
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
									url: lastPost.url,
								}],
							}],
						});

						interaction.editReply({
							embeds: [{
								title: 'Threads • Test Post',
								color: client.config?.embed.online,
								description: `> Successfully sent a test post to <#${slashData.currentUser?.channelId}>.\n> Returning to the main menu.. Please wait..`,
							}],
							components: [],
						}).catch(() => null);

						await new Promise((resolve) => setTimeout(resolve, 7000)); // 4 seconds

						await updatesHandlerExtended('user', {
							client, interaction, slashData,
						});

						break;
					}
					case 'remove': {
						await click.deferUpdate().catch((): unknown => null);

						client._data?.manageUserCheck('remove', { userId: slashData.currentUser?.id as string });
						slashData.followedUsers = slashData.followedUsers.filter((user) => user.id !== slashData.currentUser?.id);
						await client._data?.updateData({ guild: interaction.guildId as string }, { followedUsers: slashData.followedUsers as GuildStructureType['followedUsers'] });

						interaction.editReply({
							embeds: [{
								title: 'Threads • Remove User',
								color: client.config?.embed.online,
								description: `> Successfully removed @${slashData.currentUser?.username} from your followed users.\n> Returning to the main menu.. Please wait..`,
							}],
							components: [],
						}).catch(() => null);

						slashData.currentUser = null;
						await new Promise((resolve) => setTimeout(resolve, 7000)); // 4 seconds

						await updatesHandlerExtended('main', {
							client, interaction, slashData,
						});

						break;
					}
					case 'start': {
						await click.deferUpdate().catch((): unknown => null);

						const added = await client._data?.manageUserCheck('add', {
							userId: slashData.currentUser?.id as string,
							username: slashData.currentUser?.username as string,
							channelId: slashData.currentUser?.channelId as string,
							guildId: interaction.guildId as string,
							pingRole: slashData.currentUser?.roleMention as string,
						});

						if (added) {
							await client._data?.updateData({ guild: interaction.guildId as string }, { followedUsers: slashData.followedUsers as GuildStructureType['followedUsers'] });

							interaction.editReply({
								embeds: [{
									title: 'Threads • Start Checking',
									color: client.config?.embed.online,
									description: `> Successfully started checking @${slashData.currentUser?.username}.\n> Returning to the main menu.. Please wait..`,
								}],
								components: [],
							}).catch(() => null);
						} else {
							interaction.editReply({
								embeds: [{
									title: 'Threads • Start Checking',
									color: client.config?.embed.dnd,
									description: '> User is already being checked.\n> Returning to the main menu.. Please wait..',
								}],
								components: [],
							}).catch(() => null);
						}

						await new Promise((resolve) => setTimeout(resolve, 7000)); // 4 seconds

						await updatesHandlerExtended('user', {
							client, interaction, slashData,
						});

						break;
					}
					case 'back': {
						await click.deferUpdate().catch((): unknown => null);
						await client._data?.updateData({ guild: interaction.guildId as string }, { followedUsers: slashData.followedUsers as GuildStructureType['followedUsers'] });

						slashData.currentUser = null;

						await updatesHandlerExtended('main', {
							client, interaction, slashData,
						});

						break;
					}
				}
			});

			break;
		}
		case 'add': {
			const randomId = randomBytes(3).toString('hex'); // Length 6.

			interaction.editReply({
				embeds: [{
					title: 'Threads • Add User',
					color: client.config?.embed.base_color,
					description: '> To add a user, please use the ' + client.functions?.getCommand('input') + ' command. Id is `' + randomId + '`.\n> Kindly provide the user\'s username as the command argument. To cancel the process enter `cancel` as the command argument.',
					footer: {
						text: 'This menu will automatically close in 60 seconds.',
					},
				}],
				components: [],
			}).catch(() => null);

			const input = await client.promiseHandler?.createPromise(randomId, interaction.user.id);
			if (!input || input === 'cancel') {
				interaction.editReply({
					embeds: [{
						title: 'Threads • Add User',
						color: client.config?.embed.dnd,
						description: input !== 'cancel' ? '> Command has timed out. Returning to the main menu.. Please wait..' : '> Successfully cancelled the process.\n> Returning to the main menu.. Please wait..',
					}],
					components: [],
				}).catch(() => null);

				await new Promise((resolve) => setTimeout(resolve, 7000)); // 4 seconds

				await updatesHandlerExtended('main', {
					client, interaction, slashData,
				});

				break;
			}

			interaction.editReply({
				embeds: [{
					title: 'Threads • Add User',
					color: client.config?.embed.idle,
					description: '> Fetching user.. Please wait..',
				}],
				components: [],
			}).catch(() => null);

			const user = await client._data?.getThreadsUserId<true>(input.replace('@', ''), true);
			if (typeof user === 'number') {
				interaction.editReply({
					embeds: [{
						title: 'Threads • Fetching User',
						color: client.config?.embed.offline,
						description: '> We\'re sorry, but it seems like we are rate-limited, as Threads API is in early stages it is unstable, we encurage you to try again later.. :(',
					}],
					components: [],
				});

				await new Promise((resolve) => setTimeout(resolve, 7000));

				await updatesHandlerExtended('main', {
					client, interaction, slashData,
				});

				break;
			} else if (!user?.id || !user?.username) {
				interaction.editReply({
					embeds: [{
						title: 'Threads • Add User',
						color: client.config?.embed.dnd,
						description: '> No user found with the provided username.\n> Returning to the main menu.. Please wait..',
					}],
					components: [],
				}).catch(() => null);

				await new Promise((resolve) => setTimeout(resolve, 7000)); // 4 seconds

				await updatesHandlerExtended('main', {
					client, interaction, slashData,
				});

				break;
			} else if (user.private) {
				interaction.editReply({
					embeds: [{
						title: 'Threads • Add User',
						color: client.config?.embed.dnd,
						description: '> This user\'s profile is private.\n> Returning to the main menu.. Please wait..',
					}],
					components: [],
				}).catch(() => null);

				await new Promise((resolve) => setTimeout(resolve, 7000)); // 4 seconds

				await updatesHandlerExtended('main', {
					client, interaction, slashData,
				});

				break;
			}

			if (slashData.followedUsers.find((u) => u.id === user.id)) {
				interaction.editReply({
					embeds: [{
						title: 'Threads • Add User',
						color: client.config?.embed.dnd,
						description: '> This user is already being followed.\n> Returning to the main menu.. Please wait..',
					}],
					components: [],
				}).catch(() => null);

				await new Promise((resolve) => setTimeout(resolve, 7000)); // 4 seconds

				await updatesHandlerExtended('main', {
					client, interaction, slashData,
				});

				break;
			}

			slashData.currentUser = {
				id: user?.id as string,
				username: user?.username as string,
				avatarUrl: user?.profilePicture,
				bio: user?.bio,
			};

			client.spamSet?.set(slashData.currentUser.id as string + '|1', (Date.now() + (1000 * 60 * 5)));

			slashData.followedUsers.push(slashData.currentUser);
			await client._data?.updateData({ guild: interaction.guildId as string }, { followedUsers: slashData.followedUsers as GuildStructureType['followedUsers'] });

			interaction.editReply({
				embeds: [{
					title: 'Threads • Add User',
					color: client.config?.embed.online,
					description: `> Successfully added [@${user?.username}](https://www.threads.net/@${user?.username}) to your followed users.\n> Returning to the main menu.. Please wait..`,
				}],
				components: [],
			}).catch(() => null);

			await new Promise((resolve) => setTimeout(resolve, 7000)); // 4 seconds

			await updatesHandlerExtended('user', {
				client, interaction, slashData,
			});

			break;
		}
	}
}
