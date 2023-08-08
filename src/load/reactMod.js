'use strict';

const { MessageEmbed } = require('discord.js'),
  { getClient } = require('./database.js'),
  { asyncMap } = require('../util/common.js'),
  Infractions = require('../util/infractions.js'),
  { formatInfraction } = require('../commands/moderation/infractions.js'),
  sendPaged = require('../util/sendPaged.js');

const IGNORE = [
    '211999785891266560', // announcements
    '510564665852428290', // news
    '345319038160994314', // competitions
    '432968881791827978', // voting
    '519235100999811072', // qotw
    '549732395042078935', // mod-logs
    '549731415969759239', // hiddenbot-logs
    '731681686525444136', // message-logs
    '689933849295323154', // ticket-logs
    '774445868094586890', // voicechat-logs
    '804750838143909988', // staff-ticket-logs
    '771397278753357884', // user-ticket-logs
  ],
  INFRACTION_ROLES = [
    '679443527368835073', // Senior SI
    '539152555557650432', // SI
    '735947735114579978', // Scam Management
    '654980555850645541', // SI Leader
    '655004812324372490', // Trial SI
    '605855715902357535', // Mod Leader
    '708779912496021576', // Mod Management
    '394532546542567424', // Senior Mods
    '319327459625402369', // Mods
    '319479808990117888', // Trial Mods
    '605855650940977152', // Rep Leader
    '735947741422813224', // Rep Management
    '501484302941552660', // Senior Rep
    '334511990678487050', // Rep
    '652725589676916763' // test server admin
  ];

module.exports = {
  id: 'react-mod',
  exec: (client) => {
    client.on('messageReactionAdd', async (reaction, user) => {
      const { message } = reaction;

      if (user.bot || IGNORE.includes(message.channel.id)) return;

      const member = await client.HD.members.fetch(user.id).catch(() => null);

      if (reaction.emoji.id === client.TRASHBIN_EMOJI_ID && client.isMod(user)) {
        message.reason = `deleted by ${user} (${user.tag})`;

        message.delete();
      } else if (message.author?.id !== client.user.id && ['🔍', '🔎'].includes(reaction.emoji.name) && INFRACTION_ROLES.some((role) => member.roles.cache.has(role))) {
        reaction.users.remove(user);

        const infractions = Infractions.infractionsOf(message.author, client.HD.id);

        await infractions.ready;

        if (infractions.current.length === 0) return user.send(`${message.author.tag} has never been warned, muted, kicked or banned in this server by the bot.`);

        const note = (await getClient().query('SELECT note FROM public.notes WHERE user_id = $1', [message.author.id]).then((res) => res.rows[0]?.note)) || 'None',
          embed = new MessageEmbed()
            .setAuthor({
              name: `${message.author.username}'s Infractions`,
              iconURL: message.author.displayAvatarURL()
            })
            .setColor(client.DEFAULT_EMBED_COLOR);


        sendPaged({ interaction: { user, channel: user }, client }, embed, {
          values: await asyncMap(
            infractions.current,
            formatInfraction.bind(client)
          ),
          valuesPerPage: 5,
          channel: user,
          joinWith: '\n\n',
          startWith: `User Note:\`\`\`\n${note.substring(0, 500)}\n\`\`\`\nNote: If you are on mobile and your infractions are in\ndisarray, please make sure that your Discord application\nis updated.\n\n`
        });
      }
    });
  },
};
