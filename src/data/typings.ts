import { APIApplicationCommand, ButtonInteraction, ChannelSelectMenuInteraction, ChatInputCommandInteraction, ClientEvents, CommandInteraction, ContextMenuCommandInteraction, Message, MessageContextMenuCommandInteraction, ModalSubmitInteraction, PermissionResolvable, RoleSelectMenuInteraction, SelectMenuInteraction, UserSelectMenuInteraction } from 'discord.js';
import { ClusterManager, ShardingClient } from 'status-sharding';
import { ThreadsWatcher } from '../modules/threads/base';
import { CustomCacheFunctions } from '../modules/utils';
import { AdvancedMap } from '../modules/nodeUtils';
import DataManager from '../modules/dataManager';
import PromiseHandler from '../modules/promise';
import { EmojiType } from './emojis';

export type ConfigType = typeof import('./config').default;
export type GuildStructureType = import('./structures').inputGuildType;
export type ActionTypes = 'createData' | 'getData' | 'updateData' | 'deleteData' | 'getAllData';
export type ActionTypesThreads = ActionTypes | 'getThreadsId' | 'manageUserCheck' | 'getLastPost' | 'getUserProfile';
export type ConnectionState = 'Disconnected' | 'Connected' | 'Connecting' | 'Disconnecting' | 'Uninitialized';
export type ExtendedHandlerOptions = { client: CustomClient; interaction: CommandInteraction; message?: Message; slashData: SlashData; };
export type AllInteractionTypes = CommandInteraction | ContextMenuCommandInteraction | ButtonInteraction | ModalSubmitInteraction | SelectMenuInteraction | ChatInputCommandInteraction | MessageContextMenuCommandInteraction | ChannelSelectMenuInteraction | UserSelectMenuInteraction | RoleSelectMenuInteraction;

export interface CustomManager extends ClusterManager {
	_data?: DataManager;
    threads?: ThreadsWatcher;

	database?: {
		State?: boolean;
		Connection?: ConnectionState | null;
	}
}

export interface CustomError extends Error {
    reason?: string;
    msg?: string;
}

export interface CustomClient extends ShardingClient {
	config?: ConfigType;
	emoji?: EmojiType;

	_data?: typeof CustomCacheFunctions;
	slashCommands?: { data: Map<string, SlashCommandsType>; reload?: (client: CustomClient) => void; }
    promiseHandler?: PromiseHandler;
    spamSet?: AdvancedMap<string, number>;

	database?: {
		State: boolean;
		Connection?: string | null;
	}

    functions?: {
		getCommand: (name: string) => string;
	}
}

export type EventType = {
	name: keyof ClientEvents & 'raw';
	options: {
		emit: boolean;
		once: boolean;
	}

	run: <T extends keyof ClientEvents>(client: CustomClient, ...args: ClientEvents[T]) => unknown;
}

export type TextCommandsType = {
	name: string;
	aliases?: string[];
	permissions?: {
		user?: PermissionResolvable[];
		client?: PermissionResolvable[];
	}

	run: (client: CustomClient, message: Message, args: string[]) => unknown;
}

export type SlashCommandsType = APIApplicationCommand & {
	usage?: string;
	register?: boolean;
	context?: boolean;
	permissions?: {
		user?: PermissionResolvable[];
		client?: PermissionResolvable[];
	}

	run?: (client: CustomClient, interaction: CommandInteraction | ContextMenuCommandInteraction) => unknown;
}

export type SlashData = {
    firstLoad: boolean;
    currentUser: Partial<GuildStructureType['followedUsers'][number]> | null;
    followedUsers: Partial<GuildStructureType['followedUsers'][number]>[];
};
