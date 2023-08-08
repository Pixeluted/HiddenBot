'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
  useAnywhere: false,
  data: new SlashCommandBuilder()
    .setName('moveto')
    .setDescription('Moves the user into the specified channel, regardless of channel user cap.')
    .setDMPermission(false)
    .addChannelOption((option) =>
      option.setName('channel')
        .setDescription('The channel to move yourself to.')
        .addChannelTypes(2)
        .setRequired(true)),
  exec: (call) => {
    if (!call.client.isPatreon(call.member))
      return call.interaction.reply({ content: 'This command is restricted to <:Patreon:690343717219205223> **Patreon Members**.\nBecome a Patreon 👉  https://www.patreon.com/HiddenDevs', ephemeral: true });

    const channel = call.interaction.options.getChannel('channel');

    if (!channel.permissionsFor(call.member).has('CONNECT'))
      return call.interaction.reply({ content: 'Please retry with a valid channel that you have permission to join.', ephemeral: true });

    if (channel.id === call.member.voice.channelId)
      return call.interaction.reply({ content: `You are already in the \`${channel.name}\` voice channel.`, ephemeral: true });

    call.member.voice.setChannel(channel)
      .then(() => call.interaction.reply({ content: `Successfully moved you to the \`${channel.name}\` channel.`, ephemeral: true }),
        () => call.interaction.reply({ content: `Failed to move you to the \`${channel.name}\` channel.`, ephemeral: true }));
  }
};
