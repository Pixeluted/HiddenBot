'use strict';

const { ContextMenuCommandBuilder, SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
  data: [
    new ContextMenuCommandBuilder()
      .setName('Get User ID')
      .setType(2),
    new SlashCommandBuilder()
      .setName('getid')
      .setDescription('Supplies the id of the user provided.')
      .addUserOption((option) => 
        option.setName('target')
          .setDescription('The user tag to get the id of.')
          .setRequired(true))
  ],
  exec: (call) => call.interaction.reply({
    content: call.interaction.targetId ?? call.interaction.options.getUser('target').id,
    ephemeral: true
  })
};