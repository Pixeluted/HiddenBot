'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders'),
  sendPaged = require('../../util/sendPaged'),
  { MessageEmbed } = require('discord.js'),
  filter = require('../../load/filter.js'),
  { getClient } = require('../../load/database');

function updateBlacklist(newArray, soft) {
  return getClient().query(`UPDATE public.filter${soft ? '_soft' : ''} SET blacklist = $1`, [JSON.stringify(newArray)]);
}

function softOption(option) {
  return option.setName('type')
    .setDescription('Hard or soft blacklist.')
    .setRequired(false)
    .addChoices({ name: 'soft', value: 'soft' }, { name: 'hard', value: 'hard' });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blacklist')
    .setDescription('Manages the word blacklist. Must have the `List Permissions` role in the Hidden Staff discord.')
    .addSubcommand((subcommand) =>
      subcommand.setName('add')
        .setDescription('Adds a phrase to the blacklist.')
        .addStringOption((option) =>
          option.setName('phrase')
            .setDescription('Phrase to add to the blacklist.')
            .setRequired(true))
        .addStringOption(softOption))
    .addSubcommand((subcommand) =>
      subcommand.setName('remove')
        .setDescription('Removes a phrase from the blacklist.')
        .addStringOption((option) =>
          option.setName('phrase')
            .setDescription('Phrase to remove from the blacklist.')
            .setAutocomplete(true)
            .setRequired(true))
        .addStringOption(softOption))
    .addSubcommand((subcommand) => subcommand.setName('view').setDescription('Views a list of blacklisted phrases.').addStringOption(softOption)),
  canUse: {
    users: ['118496586299998209'],
    roles: ['602841875468124170'],
    cant: 'You do not have permission to run this command.',
  },
  autocomplete: (interaction) => {
    const value = interaction.options.getFocused();

    interaction.respond(
      filter.getBlacklistArray()
        .filter((phrase) => phrase.toLowerCase().startsWith(value.toLowerCase()))
        .sort((a, b) => a.localeCompare(b))
        .map((phrase) => ({ name: phrase, value: phrase }))
        .slice(0, 25)
    );
  },
  exec: async (call) => {
    const option = call.interaction.options.getSubcommand(),
      soft = call.interaction.options.getString('type') === 'soft',
      value = call.interaction.options.getString('phrase');

    if (option !== 'view' && !value)
      return call.interaction.reply({ content: 'Invalid arguments provided.', ephemeral: true });

    if (option === 'add') {
      if (!/^[a-z]+$/.test(value)) return call.interaction.reply({ content: 'Your addition does not fit blacklist criteria: only lowercase alphabetical characters.', ephemeral: true });

      const currentList = await filter.fetchBlacklist(soft);

      if (currentList.includes(value)) return call.interaction.reply({ content: 'This word is already in the blacklist.', ephemeral: true });

      updateBlacklist(currentList.concat(value), soft)
        .then(() => {
          call.interaction.reply(`Successfully added ${value} to the blacklist.`);

          filter.reloadWords(soft ? { softBlacklist: currentList.concat(value) } : { blacklist: currentList.concat(value) });
        })
        .catch((err) => {
          process.emit('logBotError', err);
          call.interaction.reply(`Failed to add \`${value}\` to the blacklist.`);
        });
    } else if (option === 'remove') {
      const currentList = await filter.fetchBlacklist(soft);

      if (!currentList.includes(value)) return call.interaction.reply({ content: 'This word is not in the blacklist.', ephemeral: true });

      updateBlacklist(
        currentList.filter((word) => word !== value),
        soft
      )
        .then(() => {
          call.interaction.reply(`Successfully removed ${value} from the blacklist.`);

          filter.reloadWords(soft ? { softBlacklist: currentList.filter((word) => word !== value) } : { blacklist: currentList.filter((word) => word !== value) });
        })
        .catch((err) => {
          process.emit('logBotError', err);
          call.interaction.reply(`Failed to remove \`${value}\` to the blacklist.`);
        });
    } else if (option === 'view') {
      const currentList = await filter.fetchBlacklist(soft);
      
      sendPaged(
        call,
        new MessageEmbed()
          .setColor('RED')
          .setAuthor({ name: 'The following content contains NSFW language.' })
          .setTitle('Blacklisted Words'),
        {
          values: currentList.sort((a, b) => a.localeCompare(b)),
          startWith: '||`',
          endWith: '`||',
          joinWith: '`, `',
          ephemeral: true
        }
      );
    }
  },
};
