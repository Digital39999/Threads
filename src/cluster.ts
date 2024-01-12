import { GatewayIntentBits, ActivityType, Options } from 'discord.js';
import { CustomCacheFunctions } from './modules/utils';
import { AdvancedMap } from './modules/nodeUtils';
import { ShardingClient } from 'status-sharding';
import PromiseHandler from './modules/promise';
import { CustomClient } from './data/typings';
import LoggerModule from './modules/logger';
import getEmojis from './data/emojis';
import config from './data/config';
import path from 'node:path';

/* ----------------------------------- Process ----------------------------------- */

process.env.NODE_NO_WARNINGS = '1';
process.on('warning', (warning) => catchError(warning));
process.on('uncaughtException', (error) => catchError(error));
process.on('unhandledRejection', (error) => catchError(error as Error));

/* ----------------------------------- Client ----------------------------------- */

const client: CustomClient = new ShardingClient({
	allowedMentions: {
		parse: [],
	},
	presence: {
		status: 'dnd',
		activities: [{
			name: 'gears booting up..',
			type: ActivityType.Watching,
		}],
	},
	intents: [
		GatewayIntentBits.Guilds,
	],
	makeCache: Options.cacheWithLimits({
		AutoModerationRuleManager: 0,
		ApplicationCommandManager: 0,
		BaseGuildEmojiManager: 0,
		GuildEmojiManager: 0,
		GuildMemberManager: {
			maxSize: 1,
			keepOverLimit: (member) => member.id === config.bot.id,
		},
		GuildBanManager: 0,
		GuildForumThreadManager: 0,
		GuildInviteManager: 0,
		GuildScheduledEventManager: 0,
		GuildStickerManager: 0,
		GuildTextThreadManager: 0,
		MessageManager: 0,
		PresenceManager: 0,
		ReactionManager: 0,
		ReactionUserManager: 0,
		StageInstanceManager: 0,
		ThreadManager: 0,
		ThreadMemberManager: 0,
		UserManager: 0,
		VoiceStateManager: 0,
	}),
});

/* ----------------------------------- Loading ----------------------------------- */

getEmojis(undefined, false, (data) => { client.emoji = data; });

export function catchClientError(error: Error) {
	if (error?.name?.includes('ExperimentalWarning') || error?.name?.includes('Unknown interaction')) return;

	LoggerModule('Client', 'An error has occurred.', 'red');
	console.error(error);
}

export function catchError(error: Error) {
	if (error?.name?.includes('ExperimentalWarning') || error?.name?.includes('Unknown interaction')) return;

	LoggerModule('Manager', 'An error has occurred.', 'red');
	console.error(error);
}

/* ----------------------------------- Utils ----------------------------------- */

client.config = config;
client.database = { State: true };
client.spamSet = new AdvancedMap();
client.slashCommands = { data: new Map() };
client.promiseHandler = new PromiseHandler();
client._data = CustomCacheFunctions;

client.functions = {
	getCommand: (name: string) => {
		const command = client.slashCommands?.data?.get(name);
		return command?.id ? `</${command.name}:${command.id}>` : `\`/${name}\``;
	},
};

/* ----------------------------------- Handlers ----------------------------------- */

['loadEvents', 'slashCommands'].map(async (handler) => {
	await import(path.join(__dirname, '.', 'handlers', handler)).then((module) => module.default(client));
});

/* ----------------------------------- Exports & Errors ----------------------------------- */

client.rest.on('rateLimited', (info: { timeToReset: number; limit: string | number; global: boolean; route: string; url: string; method: string; }) => {
	LoggerModule('Ratelimit', `Below:\n- Timeout: ${info.timeToReset}\n- Limit: ${info.limit}\n- Global: ${info.global ? 'True' : 'False'}\n- Route: ${info.route}\n- Path: ${info.url}\n- Method: ${info.method}\n`, 'yellow');
});

export default client;
client.login(config.bot.token);

/* ----------------------------------- End ----------------------------------- */
