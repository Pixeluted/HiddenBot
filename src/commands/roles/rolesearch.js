'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders'),
  { MessageEmbed } = require('discord.js'),
  sendPaged = require('../../util/sendPaged.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rolesearch')
    .setDescription('Searches for roles.')
    .setDMPermission(false)
    .addStringOption((option) =>
      option.setName('search')
        .setDescription('The search query.')
        .setRequired(true)),
  id: 'rolesearch',
  exec: (call) => {
    const search = call.interaction.options.getString('search');

    let matches = call.interaction.guild.roles.cache.filter((role) => role.name.toLowerCase().includes(search));
    
    matches.delete(call.interaction.guild.id);

    if (!matches.size)
      return call.interaction.reply({ content: 'No roles were found that included the given search query.', ephemeral: true });

    matches = matches.map((role) => `\`${role.name}\` - (${role.id})`);

    const embed = new MessageEmbed()
      .setTitle(`${matches.length} Role${matches.length > 1 ? 's' : ''} Found`)
      .setColor(call.client.DEFAULT_EMBED_COLOR)
      .setFooter({ text: `Requested by ${call.user.tag}`, iconURL: call.user.displayAvatarURL() });

    sendPaged(call, embed, { values: matches, valuesPerPage: 10 });
  }
};
