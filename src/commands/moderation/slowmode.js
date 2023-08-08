'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders'),
  { parseTime } = require('../../util/common.js'),
  { MessageEmbed, Collection } = require('discord.js'),
  ROLES = require('../../util/roles.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Changes the slowmode on the current discord channel.')
    .setDMPermission(false)
    .addStringOption((option) => 
      option.setName('length')
        .setDescription('The cooldown between slowmode messages. Supply "off" to turn off the slowmode.')
        .setRequired(true))
    .addStringOption((option) =>
      option.setName('duration')
        .setDescription('How long before the slowmode is turned off.')
        .setRequired(false)),
  id: 'slowmode',
  desc: 'Changes the slowmode on the current discord channel. `,slowmode (length) (duration)',
  currentSlow: new Collection(),
  canUse: {
    users: ['118496586299998209'],
    roles: Object.values(ROLES),
    cant: 'You do not have permission to run this command.',
  },
  exec: (call) => {
    const modLogs = call.client.channels.cache.get(call.client.MOD_LOGS_CHANNEL),
      length = ['disable', 'off', 'stop', 'end', '0s'].includes(call.interaction.options.getString('length')) ? 0 : parseTime(call.interaction.options.getString('length'));

    if (length == null || length < 0)
      return call.interaction.reply({ content: 'Please rerun the command and specify a valid slowmode length or `off` to turn off slowmode.', ephemeral: true });

    const duration = call.interaction.options.getString('duration') ? parseTime(call.interaction.options.getString('duration')) : 0;

    if (duration < 0 || duration > 21600000)
      return call.interaction.reply({ content: 'Please rerun the command and specify a valid slowmode duration, between 0 and 6 hours', ephemeral: true });

    call.channel.setRateLimitPerUser(length / 1000).then(
      () => {
        call.interaction.reply({ content: `Successfully ${length === 0 ? 'disabled' : 'changed'} the slowmode for this channel.`, ephemeral: true });

        const channelSlow = module.exports.currentSlow.get(call.channel.id);

        if (channelSlow) clearTimeout(channelSlow);

        if (length > 0 && duration > 0)
          module.exports.currentSlow.set(
            call.channel.id,
            setTimeout(() => call.channel.setRateLimitPerUser(0), duration)
          );
      },
      () => call.interaction.reply({ content: 'Could not change the slowmode for this channel.', ephemeral: true })
    );

    const embed = new MessageEmbed()
      .setTimestamp()
      .setTitle('Slowmode Changed')
      .setColor('RED')
      .addField('Length', parseTime(length), true)
      .addField('Duration', duration === 0 ? 'indefinite' : parseTime(duration), true)
      .addField('Channel', call.channel.toString(), true)
      .addField('Moderator', call.user.toString(), true);

    modLogs.send({ embeds: [embed] }).catch(() => null);
  },
};
