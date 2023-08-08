'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders'),
  ROLES = require('../../util/roles.json'),
  { getClient } = require('../../load/database.js'),
  { channels } = require('../../load/submissions.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('submissions')
    .setDescription('Changes whether or not a channel is a submission channel.')
    .setDMPermission(false)
    .addChannelOption((option) => 
      option.setName('channel')
        .setDescription('The channel to edit.')
        .setRequired(true)),
  id: 'submissions',
  desc: 'Changes whether or not a channel is a submission channel. `,submissions (channel)`',
  canUse: {
    users: ['118496586299998209'],
    roles: [ROLES.ADMINISTRATOR, ROLES.REPRESENTATIVE],
    cant: 'You do not have permission to run this command.',
  },
  exec: async (call) => {
    const channel = call.interaction.options.getChannel('channel');

    if (!channel.isText())
      return call.interaction.reply({ content: 'Channel must be a text channel.', ephemeral: true });

    if (channels.includes(channel)) {
      channels.splice(channels.indexOf(channel), 1);
      getClient().query('DELETE FROM public.submissions WHERE "channel" = $1', [channel]);

      call.interaction.reply({ content: `<#${channel}> is no longer a submissions channel.`, ephemeral: true });
    } else {
      channels.push(channel);
      getClient().query('INSERT INTO public.submissions ("channel") VALUES($1)', [channel]);

      call.interaction.reply({ content: `<#${channel}> is now a submissions channel.`, ephemeral: true });
    }
  },
};
