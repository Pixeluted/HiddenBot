'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders'),
  { MessageEmbed, MessageAttachment } = require('discord.js'),
  { getClient } = require('../../load/database.js'),
  { round } = require('../../util/common.js'),
  { createStatsImage } = require('../../util/rankImages.js'),
  { getUser: voiceGetUser, getLevelInfo: voiceGetLevelInfo } = require('../../load/voiceLevels'),
  { getUser: chatGetUser, getLevelInfo: chatGetLevelInfo } = require('../../load/chatLevels'),
  { stripIndents } = require('common-tags'),
  { isEphemeralChannel } = require('../../util/common'),

  PLACES = ['🥇', '🥈', '🥉'],
  REQUIRED_COLUMNS = ['creation_posts', 'creation_stars', 'creation_awards'],
  STATS = [
    {
      name: 'Creation Posts',
      value: (data) => `${data.rows[0].creation_posts} posts`
    },
    {
      name: 'Creation Awards',
      value: (data) => `${data.rows[0].creation_awards.map((a) => PLACES[a]).join(' ')}`
    },
    {
      name: 'Creation Stars',
      value: (data) => `${data.rows[0].creation_stars} stars (${round(data.rows[0].creation_stars / data.rows[0].creation_posts)} average)`
    },
  ];

module.exports = {
  useAnywhere: false,
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Gives user stats.')
    .addUserOption((option) =>
      option.setName('target')
        .setDescription('The user to check stats of.')
        .setRequired(false))
    .addIntegerOption((option) =>
      option.setName('days')
        .setDescription('The number of days of data to retrieve.')
        .setRequired(false)),
  exec: async (call) => {
    const user = call.interaction.options.getUser('target') ?? call.user,
      self = user.id === call.user.id,
      start = Date.now(),
      data = await getClient().query(`SELECT ${REQUIRED_COLUMNS.join(', ')} FROM public.users WHERE "user" = $1`, [user.id]),
      chatDbUser = await chatGetUser(user.id, call.client.HD.id),
      voiceDbUser = await voiceGetUser(user.id, call.client.HD.id),
      dayCount = call.interaction.options.getInteger('days');

    if (chatDbUser || voiceDbUser)
      var rankStats = await createStatsImage(chatDbUser, voiceDbUser, dayCount?.toString().toLowerCase() === 'all' ? 'all' : parseInt(dayCount) || 14);

    if (!data.rows[0] && !chatDbUser && !voiceDbUser)
      return call.interaction.reply({ content: `${self ? 'You have' : user.username + ' has'} no recorded statistics.`, ephemeral: true });

    const embed = new MessageEmbed()
      .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
      .setColor(call.client.DEFAULT_EMBED_COLOR)
      .setTitle('Statistics')
      .setDescription(`Recorded statistics of ${user.username}.`)
      .setFooter({ text: `Requested by ${call.user.tag}. Data fetched in ${(Date.now() - start).toLocaleString()} milliseconds.`, iconURL: call.user.displayAvatarURL() });

    if (data.rows[0]) embed.fields = STATS.map((f) => ({ name: f.name, value: f.value(data) || 'none', inline: true }));

    let attachment;

    if (rankStats?.canvas) {
      attachment = new MessageAttachment(rankStats.canvas.toBuffer(), 'hd_rank_stats.png');

      const averageXp = call.client.isPatreon(user) ? 30 : 20,
        chatLevelInfo = chatGetLevelInfo(chatDbUser?.total_xp),
        voiceLevelInfo = voiceGetLevelInfo(voiceDbUser?.total_xp),
        timeToNextLevelChat = Math.ceil(chatLevelInfo?.remainingXp / averageXp),
        timeToNextLevelVoice = Math.ceil(voiceLevelInfo?.remainingXp / averageXp);

      embed
        .addField(
          'Rank Stats',
          stripIndents`Below is ${self ? 'your' : `<@${user.id}>'s`} rank data over the past month.
        
          ${self ? 'You' : 'This user'} could reach level:
          ${chatLevelInfo ? `\`${chatLevelInfo.level + 1}\` in another ${timeToNextLevelChat} minute${timeToNextLevelChat > 1 ? 's' : ''} of messaging.` : ''}
          ${voiceLevelInfo ? `\`${voiceLevelInfo.level + 1}\` in another ${timeToNextLevelVoice} minute${timeToNextLevelVoice > 1 ? 's' : ''} of talking.` : ''}`
        )
        .setImage('attachment://hd_rank_stats.png');
    }

    call.interaction.reply(attachment ? { embeds: [embed], files: [attachment], ephemeral: isEphemeralChannel(call.interaction) } : { embeds: [embed], ephemeral: isEphemeralChannel(call.interaction) });
  }
};
