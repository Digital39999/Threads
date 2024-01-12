const dev = process?.platform === 'win32';

export default {
	bot: {
		id: dev ? '' : '',
		token: dev ? '' : '',
	},

	link: {
		topgg: 'https://top.gg/bot/1126837530805948426',
		invite: 'https://discord.com/api/oauth2/authorize?client_id=1126837530805948426&permissions=377957502016&scope=applications.commands%20bot',
		support: 'https://discord.gg/4rphpersCa',
		website: 'https://threadsbot.us',
		status: 'https://statusbot.us',
		tutorial: 'https://threadsbot.us/tutorial',
	},

	sharding: {
		shards: 1,
		clusters: 1,
		shardsPerCluster: 1,
	},

	embed: {
		color: 0x5c6ceb,
		base_color: 0x5c6ceb,
		offline: 0x999999,
		online: 0x7bcba7,
		stream: 0x9676ca,
		idle: 0xfcc061,
		dnd: 0xf17f7e,
	},

	loggedIn: false,
	credentials: {
		username: '',
		password: '',
	},

	database: '',

	dev: {
		mode: dev,
		cache: true,
		slash: true,
		users: ['797012765352001557'],
	},
};
