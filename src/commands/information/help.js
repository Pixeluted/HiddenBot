'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders'),
  { MessageEmbed } = require('discord.js'),
  { titleCase } = require('../../util/common');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('replies with a list of commands.'),
  exec: async (call) => {
    const helpEmbed = new MessageEmbed()
        .setColor(call.client.DEFAULT_EMBED_COLOR)
        .setTitle('Commands')
        .setDescription('The following is a list of bot commands organized into their appropriate category.'),
      categories = {};

    for (
      const command of call.commands
        .filter((c) => !c.hidden)
        .map((c) => c.data)
        .flat()
        .filter((c) => c instanceof SlashCommandBuilder)
    ) {
      const category = titleCase(command.category);

      categories[category] ? categories[category].push(command) : categories[category] = [command];
    }

    helpEmbed.fields = Object.entries(categories)
      .map(([category, commands]) => ({ name: category, value: '`' + commands.sort((a, b) => a.name.localeCompare(b.name)).map((cmd) => cmd.name).join('`, `') + '`' }))
      .filter((f) => f.value !== '``');

    call.interaction.reply({ embeds: [helpEmbed], ephemeral: true });
  }
};
