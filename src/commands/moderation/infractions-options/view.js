'use strict';

const { SlashCommandSubcommandBuilder } = require('@discordjs/builders'),
  { MessageEmbed } = require('discord.js'),
  { parseTime } = require('../../../util/common.js'),
  Infractions = require('../../../util/infractions');
  
module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName('view')
    .setDescription('Fetches detailed information on a singular infraction.')
    .addIntegerOption((option) =>
      option.setName('infraction')
        .setDescription('The infraction ID.')
        .setRequired(true)),
  exec: async (call, _infractions, restricted) => {
    const infraction = await Infractions.getInfraction(call.client.HD.id, parseInt(call.interaction.options.getInteger('infraction')));

    if (!infraction)
      return call.interaction.reply({ content: 'Failed to find an infraction for the ID provided. Please rerun the command and specify the ID of the infraction you wish to view.', ephemeral: true });

    if (infraction.type === 'mute' && restricted())
      return call.interaction.reply({ content: 'You cannot view this infraction because it is not a `marketplace mute`.', ephemeral: true });

    const user = await call.client.users.fetch(infraction.user),
      moderator = await call.client.users.fetch(infraction.committer),
      embed = new MessageEmbed()
        .setColor(call.client.DEFAULT_EMBED_COLOR)
        .setTimestamp(infraction.date)
        .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
        .setTitle(`Infraction #${infraction.id.toLocaleString()}`)
        .setDescription(infraction.reason)
        .addField('Type', infraction.type, true);

    if (infraction.length) embed.addField('Length', parseTime(parseInt(infraction.length)), true);

    embed
      .addField('Log URL', infraction.log_url ? `[**Link**](${infraction.log_url})` : 'None recorded', true)
      .addField('Moderator', `${moderator.tag} (${moderator.id})`);

    call.interaction.reply({ embeds: [embed] });
  }
};