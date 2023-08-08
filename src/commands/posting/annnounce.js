const { SlashCommandBuilder } = require('@discordjs/builders'),
  { MessageActionRow, Modal, TextInputComponent, MessageEmbed } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Announces the given information to the provided channel.')
    .setDMPermission(false)
    .addChannelOption((option) =>
      option.setName('channel')
        .setDescription('The channel to announce in.')
        .addChannelTypes(0)
        .setRequired(true)),
  canUse: {
    users: ['118496586299998209', '650440845144883200'],
    roles: ['712386713883770950'],
    cant: 'You do not have permission to run this command.',
  },
  exec: async (call) => {
    const channel = call.interaction.options.getChannel('channel'),
      modalInteraction = await call.modalPrompt(
        new Modal()
          .setCustomId('announce_information')
          .setTitle('Announcement Prompt')
          .addComponents(
            new MessageActionRow()
              .addComponents(new TextInputComponent()
                .setCustomId('announce_title')
                .setLabel('Title')
                .setStyle('SHORT')
                .setMinLength(1)
                .setMaxLength(256)),
            new MessageActionRow()
              .addComponents(new TextInputComponent()
                .setCustomId('announce_description')
                .setLabel('Description')
                .setStyle('PARAGRAPH')),
            new MessageActionRow()
              .addComponents(new TextInputComponent()
                .setCustomId('announce_content')
                .setLabel('Message Content (for pings and whatnot)')
                .setStyle('SHORT')
                .setMinLength(1)
                .setMaxLength(2000)),
            new MessageActionRow()
              .addComponents(new TextInputComponent()
                .setCustomId('announce_color')
                .setLabel('Hex Color')
                .setStyle('SHORT')
                .setMinLength(6)
                .setMaxLength(6)),
            new MessageActionRow()
              .addComponents(new TextInputComponent()
                .setCustomId('announce_show_author')
                .setLabel('Show author in footer?')
                .setStyle('SHORT')))),
      title = modalInteraction.fields.getTextInputValue('announce_title'),
      description = modalInteraction.fields.getTextInputValue('announce_description'),
      content = modalInteraction.fields.getTextInputValue('announce_content'),
      color = modalInteraction.fields.getTextInputValue('announce_color'),
      showAuthor = modalInteraction.fields.getTextInputValue('announce_show_author')?.startsWith('y') ?? false,
      embed = new MessageEmbed()
        .setColor(color || 'DEFAULT')
        .setTitle(title || '')
        .setDescription(description || '')
        .setFooter({ text: showAuthor ? `Announced by ${call.user.tag}` : '' });

    channel.send(
      {
        content: content || null,
        embeds: [embed],
        disableMentions: 'none'
      })
      .then(() => modalInteraction.reply({ content: 'Successfully sent the announcement.', ephemeral: true }))
      .catch((exc) => {
        console.warn(exc.stack);
        modalInteraction.reply({ content: 'Failed to send the message to the channel. Verify that permissions are set up correctly and that your announcement is valid.', ephemeral: true });
      });
  }
};
