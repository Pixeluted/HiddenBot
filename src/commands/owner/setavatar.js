'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setavatar')
    .setDescription('Changes the avatar of the bot.')
    .addStringOption((option) =>
      option.setName('avatar')
        .setDescription('The url for the new avatar.')
        .setRequired(true)),
  canUse: {
    users: ['118496586299998209'],
    cant: 'You do not have permission to run this command.',
  },
  hidden: true,
  exec: (call) => {
    call.client.user
      .setAvatar(call.interaction.options.getString('avatar'))
      .then(() => call.interaction.reply({ content: 'Changed the avatar.', ephemeral: true }))
      .catch(() => call.interaction.reply({ content: 'Failed to change the avatar. Make sure the URL is valid.', ephemeral: true }));
  },
};
