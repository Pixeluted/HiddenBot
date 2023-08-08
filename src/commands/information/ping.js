'use strict';

const { MessageEmbed } = require('discord.js'),
  { SlashCommandBuilder } = require('@discordjs/builders'),
  { parseTime } = require('../../util/common.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Gives you the bot\'s ping.'),
  useAnywhere: false,
  exec: (call) => {
    call.interaction.reply({ embeds: [
      new MessageEmbed()
        .setColor(call.client.DEFAULT_EMBED_COLOR)
        .setTitle('Connection Statistics')
        .addField('Uptime', parseTime(call.client.uptime))
        .addField('Heartbeat', `${call.client.ws.ping}ms`, true)
        .setFooter({ text: `Requested by ${call.user.tag}`, iconURL: call.user.displayAvatarURL() })
    ], ephemeral: true });
  }
};
