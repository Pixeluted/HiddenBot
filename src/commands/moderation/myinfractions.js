'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders'),
  { MessageEmbed } = require('discord.js'),
  { asyncMap } = require('../../util/common.js'),
  sendPaged = require('../../util/sendPaged'),
  Infractions = require('../../util/infractions'),
  { formatInfraction } = require('./infractions.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('myinfractions')
    .setDescription('Checks the infractions of the call user.'),
  formatInfraction,
  exec: async (call) => {
    const infractions = Infractions.infractionsOf(call.member ?? call.client.HD.members.cache.get(call.interaction.user.id), ((call.client.HD ?? call.client.guilds.cache.first()).id) ?? '211228845771063296');

    await infractions.ready;

    if (infractions.current.length === 0)
      return call.interaction.reply({ content: 'You have never been warned, muted, kicked or banned in this server by the bot.', ephemeral: true });

    call.interaction.reply({ content: 'Direct messaging you your infractions. If you do not receive them, please fix your privacy settings and try again.', ephemeral: true });

    sendPaged(call, new MessageEmbed()
      .setAuthor({ name: `${call.user.username}'s Infractions`, iconURL: call.user.displayAvatarURL() })
      .setColor(call.client.DEFAULT_EMBED_COLOR),
    {
      channel: call.user,
      values: await asyncMap(
        infractions.current,
        formatInfraction.bind(call.client)
      ),
      valuesPerPage: 4,
      joinWith: '\n\n',
      startWith: 'Note: If you are on mobile and your infractions are in\ndisarray, please make sure that your Discord application\nis updated.\n\n'
    });
  },
};
