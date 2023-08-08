'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('togglecommand')
    .setDescription('Enables/disables the usability of the provided command.')
    .addStringOption((option) =>
      option.setName('command')
        .setDescription('The command to toggle.')
        .setRequired(true))
    .addStringOption((option) =>
      option.setName('reason')
        .setDescription('The reason for disabling this command.')
        .setRequired(true)),
  canUse: {
    users: ['118496586299998209'],
    cant: 'You do not have permission to run this command.',
  },
  hidden: true,
  exec: (call) => {
    const commandName = call.interaction.options.getString('command'),
      command = call.commands.find((cmd) => cmd.data.name === commandName);

    if (!command)
      return call.interaction.reply({ content: 'Invalid command.', ephemeral: true });

    if (command.data.name === 'togglecommand')
      return call.interaction.reply({ content: 'It would not be wise to disable that command.', ephemeral: true });

    if (command.disabled) {
      command.exec = command.storedExec.bind(command);
      command.disabled = false;
      call.interaction.reply({ content: `Successfully enabled the \`${command.data.name}\` command.`, ephemeral: true });
    } else {
      command.storedExec = command.exec;
      command.disabled = true;
      command.exec = (innerCall) => {
        innerCall.interaction.reply({ content: `This command is currently disabled for the following reason: \`${call.interaction.options.getString('reason') || 'no reason specified'}\``, ephemeral: true });
      };
      call.interaction.reply({ content: `Successfully disabled the \`${command.data.name}\` command.`, ephemeral: true });
    }
  },
};
