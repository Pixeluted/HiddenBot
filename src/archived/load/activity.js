const TYPING_CHANNEL = '535514561986428929';

let lastSet = -Infinity,
  // eslint-disable-next-line no-unused-vars
  currentUser = null;

/*
const ACTIVITIES = [
	{ name: 'for bad words', type: 'watching' },
	{ name: 'for ,post', type: 'watching' },
	{ name: 'you read this', type: 'watching' },
	{ name: 'you type', type: 'listening' },
	{ name: 'ROBLOX', type: 'playing' }
];

let current = -1;

function changeActivity(client) {
	if (ACTIVITIES.length - 1 === current)
		current = -1;

	let activity = ACTIVITIES[++current];

	client.user.setActivity(activity.name, { type: activity.type });
}
*/


module.exports = {
  id: 'activity',
  exec: (client) => {
    client.user.setActivity(null);

    client.on('typingStart', async (channel, user) => {
      if (channel.id !== TYPING_CHANNEL || lastSet + 12000 > Date.now())
        return;

      lastSet = Date.now();
      currentUser = user.id;

      client.user.setActivity(`you type, ${await channel.guild.fetchMember(user).then((m) => m.displayName)}`, { type: 'WATCHING' });
    });
  }
};
