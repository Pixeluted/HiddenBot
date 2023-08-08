'use strict';

const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');

const CLEAR_TYPES = ['ban', 'mute', 'kick', 'softban', 'warn', 'all'];

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName('clear')
    .setDescription('Clears the infracrtions of the provided type.')
    .addUserOption((option) =>
      option.setName('target')
        .setDescription('The user to clear infractions from.')
        .setRequired(true))
    .addStringOption((option) =>
      option.setName('filter')
        .setDescription('What type of infractions to clear from this user.')
        .setRequired(true)
        .addChoices(...CLEAR_TYPES.map((type) => ({ name: type, value: type })))),
  exec: async (call, infractions, restricted) => {
    if (restricted())
      return call.interaction.reply({ content: 'You cannot clear infractions.', ephemeral: true });
      
    await call.interaction.deferReply();

    const filter = call.interaction.options.getString('filter');

    infractions.clearInfractions(filter.toLowerCase()).then(
      () => {
        call.interaction.editReply(`Successfully cleared ${filter} infractions from the user.`);
      },
      (err) => {
        process.emit('logBotError', err);
        call.interaction.editReply(`Failed to clear ${filter} infractions from the user.`);
      }
    );
  }
};
