import { CommandInteraction, CommandInteractionOptionResolver } from 'discord.js';
import { CustomClient } from '../data/typings';
import getEmojis from '../data/emojis';

export default {
	name: 'input',
	description: 'This is help commands of /threads and is not meant to be used directly.',
	options: [{
		name: 'id',
		description: 'The ID from /threads.',
		type: 3,
		required: true,
	}, {
		name: 'username',
		description: 'The username of user you want to add.',
		type: 3,
		required: true,
	}],

	run: async (client: CustomClient, interaction: CommandInteraction) => {
		await interaction.deferReply({ ephemeral: true });

		return interaction.editReply({
			content: client.emoji?.main.icons_warning + ' • This command is unavailable. Read more with ' + client.functions?.getCommand('help') + '.',
			components: [],
			embeds: [],
		});

		const id: string = (interaction.options as CommandInteractionOptionResolver).getString('id') as string;
		const username: string = (interaction.options as CommandInteractionOptionResolver).getString('username') as string;

		const check = await client.promiseHandler?.resolvePromise(id?.trim(), username?.trim(), interaction.user.id);
		if (check === null) return interaction.editReply({ content: getEmojis('fromMyServer.error') + ' • Are you a little bit lost? Use ' + client.functions?.getCommand('threads') + ' to get started.' });
		else if (check === false) return interaction.editReply({ content: getEmojis('fromMyServer.error') + ' • You are not allowed to use this command.' });

		interaction.editReply({ content: getEmojis('fromMyServer.warn') + ' • Your input has been registered, you may now dismiss this message.' });
	},
};
