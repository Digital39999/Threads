import { AllInteractionTypes, CustomClient, EventType } from '../data/typings';
import { PermissionsBitField, PermissionsString } from 'discord.js';
import { catchClientError } from '../cluster';
import config from '../data/config';

export default {
	name: 'interactionCreate',
	options: {
		emit: true,
		once: false,
	},

	run: async (client: CustomClient, interaction: AllInteractionTypes) => {
		if (interaction.isChatInputCommand() || interaction.isContextMenuCommand()) {
			const usedCommand = client.slashCommands?.data.get(interaction.commandName);
			if (!usedCommand) return interaction.reply({
				content: client.emoji?.fromMyServer.error + ' • This command is not registered.',
				ephemeral: true,
			});

			let hasPerms: { maybe: boolean, me?: boolean, which?: PermissionsString[] } = { maybe: true };

			if (!config?.dev.users.includes(interaction.user.id)) {
				if (usedCommand.permissions?.user && !(interaction.memberPermissions?.has(usedCommand.permissions.user))) hasPerms = { maybe: false, me: false, which: (interaction.member?.permissions as PermissionsBitField).missing(usedCommand.permissions.user) };
				if (usedCommand.permissions?.client && !interaction.appPermissions?.has(usedCommand.permissions.client)) hasPerms = { maybe: false, me: true, which: interaction.guild?.members.me?.permissions.missing(usedCommand.permissions.client) };
			}

			if (!hasPerms.maybe) return interaction.reply({
				content: client.emoji?.fromMyServer.warn + ' • ' + (hasPerms.me ? 'I don\'t have enough permissions to execute this command!' : 'You don\'t have enough permissions to execute this command!') + (hasPerms.which ? ` Missing permissions: \`${hasPerms.which.join('`, `')}\`` : ''),
			});

			try {
				usedCommand?.run?.(client, interaction);
			} catch (error: unknown) {
				catchClientError(error as Error);

				interaction[interaction.replied ? 'editReply' : 'reply']({
					content: client.emoji?.fromMyServer.error + ' • An error occurred while executing this command.',
				}).catch((): null => null);
			}
		}

		if (interaction.isButton()) {
			if (interaction.customId === 'help_tutorial') return interaction.reply({
				content: client.emoji?.fromMyServer.correct + ' • ' + client.config?.link.tutorial,
				ephemeral: true,
			});
		}
	},
} as EventType;
