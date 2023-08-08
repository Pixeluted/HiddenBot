'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders'),
  { Modal, MessageActionRow, TextInputComponent, MessageEmbed } = require('discord.js'),
  { safeBlock } = require('../../util/common.js'),
  filter = require('../../load/filter.js'),
  { getBad, isBlacklisted } = filter;

module.exports = {
  useAnywhere: false,
  data: new SlashCommandBuilder()
    .setName('test')
    .setDescription('Tests a string on various blacklist and whitelist scenarios.'),
  exec: async (call) => {
    if (!filter.loaded)
      return call.interaction.reply({ content: 'The bot has recently restarted and the filter has not yet loaded.', ephemeral: true });

    const stringInteraction = await call.modalPrompt(
        new Modal()
          .setCustomId('test')
          .setTitle('Test Prompt')
          .addComponents(
            new MessageActionRow().addComponents(
              new TextInputComponent()
                .setCustomId('test_string')
                .setLabel('Text')
                .setStyle('PARAGRAPH')))),
      string = safeBlock(stringInteraction.fields.getTextInputValue('test_string') ?? ''),
      before = Date.now(),
      blacklisted = isBlacklisted(string),
      blacklistedText = getBad(string),
      whitelisted = blacklisted && !blacklistedText,
      bad = blacklisted && !whitelisted,
      time = Date.now() - before,
      embed = new MessageEmbed()
        .setColor(bad ? 'RED' : 'GREEN')
        .setTitle('Test Results')
        .setDescription(`\`\`\`${safeBlock(string || '\u200b')}\`\`\``);

    if (bad)
      embed.addField('Blacklisted Text', `\`\`\`css\n${blacklistedText}\`\`\``);

    embed
      .addField('Blacklisted', blacklisted ? 'Yes' : 'No', true)
      .addField('Whitelisted', whitelisted ? 'Yes' : 'No', true)
      .addField('Processed In', `${time === 0 ? '< ' : ''}${time || 1} millisecond${time > 1 ? 's' : ''}`, true)
      .addField('Input Length', `${string.length.toLocaleString()} characters`, true);

    stringInteraction.reply({ embeds: [embed], ephemeral: true });
  }
};
