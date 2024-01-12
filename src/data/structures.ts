import mongoose from 'mongoose';

export type inputGuildType = {
    guild: string;

    followedUsers: {
		id: string;
		username: string;
		lastPostId: string;
		avatarUrl: string;
		bio: string;

		roleMention: string;
		channelId: string;
	}[];
};

export const GuildModel = mongoose.model<inputGuildType>('guild', new mongoose.Schema<inputGuildType>({
	guild: { type: String, required: true, unique: true },

	followedUsers: [{
		id: { type: String, required: true },
		username: { type: String, required: true },
		lastPostId: { type: String, required: true },
		avatarUrl: { type: String, required: false },
		bio: { type: String, required: false },

		roleMention: { type: String, required: true },
		channelId: { type: String, required: true },
	}],
}));
