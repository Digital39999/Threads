import { CustomClient, SlashCommandsType } from '../data/typings';
import { catchClientError } from '../cluster';
import { readdirSync } from 'node:fs';
import path from 'node:path';

export default function(client: CustomClient) {
	try {
		if (client.slashCommands) client.slashCommands.reload = reload;

		readdirSync(path.join(__dirname, '..', 'commands')).filter((file: string) => file.endsWith('.js')).map(async (command: string) => {
			const pull: SlashCommandsType = await import(path.join(__dirname, '..', 'commands', command)).then((file) => file.default);
			if (pull?.name) client?.slashCommands?.data.set(pull.name, pull);
		});
	} catch (error: unknown) {
		catchClientError(error as Error);
	}
}

export function reload(client: CustomClient) {
	const commandIds: { name: string; id: string; }[] = []; Array.from(client?.slashCommands?.data?.values() || []).map((command: SlashCommandsType) => commandIds.push({ name: command.name, id: command?.id as string }));
	if (client.slashCommands) client.slashCommands.data.clear();

	try {
		readdirSync(path.join(__dirname, '..', 'commands')).filter((file: string) => file.endsWith('.js')).map(async (command: string) => {
			delete require.cache[require.resolve(path.join(__dirname, '..', 'commands', command))];

			const pull: SlashCommandsType = await import(path.join(__dirname, '..', 'commands', command)).then((file) => file.default);

			if (pull?.name) {
				const commandId: { name: string; id: string; } | undefined = commandIds.find((command: { name: string; id: string; }) => command.name === pull.name);
				if (commandId) pull.id = commandId.id; client?.slashCommands?.data.set(pull.name, pull);
			}
		});
	} catch (error: unknown) {
		catchClientError(error as Error);
	}
}
