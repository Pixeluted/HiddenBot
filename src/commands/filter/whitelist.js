'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders'),
  sendPaged = require('../../util/sendPaged'),
  { MessageEmbed } = require('discord.js'),
  filter = require('../../load/filter.js'),
  { getClient } = require('../../load/database');

function updateWhitelist(newArray) {
  return getClient().query('UPDATE public.filter SET whitelist = $1', [JSON.stringify(newArray)]);
}


module.exports = {
  data: new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('Manages the word whitelist. Must have the `List Permissions` role in the Hidden Staff discord.')
    .addSubcommand((subcommand) =>
      subcommand.setName('add')
        .setDescription('Adds a phrase to the whitelist.')
        .addStringOption((option) =>
          option.setName('phrase')
            .setDescription('Phrase to add to the whitelist.')
            .setRequired(true)))
    .addSubcommand((subcommand) =>
      subcommand.setName('remove')
        .setDescription('Removes a phrase from the whitelist.')
        .addStringOption((option) =>
          option.setName('phrase')
            .setDescription('Phrase to remove from the whitelist.')
            .setAutocomplete(true)
            .setRequired(true)))
    .addSubcommand((subcommand) => subcommand.setName('view').setDescription('Views a list of blacklisted phrases.')),
  canUse: {
    users: ['118496586299998209'],
    roles: ['602841875468124170'],
    cant: 'You do not have permission to run this command.',
  },
  autocomplete: (interaction) => {
    const value = interaction.options.getFocused();

    interaction.respond(
      filter.getWhitelistArray()
        .filter((phrase) => phrase.toLowerCase().startsWith(value.toLowerCase()))
        .sort((a, b) => a.localeCompare(b))
        .map((phrase) => ({ name: phrase, value: phrase }))
        .slice(0, 25)
    );
  },
  exec: async (call) => {
    const option = call.interaction.options.getSubcommand(),
      value = call.interaction.options.getString('phrase');

    if (option !== 'view' && !value)
      return call.interaction.reply({ content: 'Invalid arguments provided.', ephemeral: true });

    if (option === 'add') {
      if (!/^[a-z ]+$/.test(value) || filter.getBad(value) == null)
        return call.interaction.reply({ content: 'Your addition does not fit whitelist criteria: only lowercase alphabetical characters or spaces, is considered a bad word by the bot.', ephemeral: true });

      const currentList = await filter.fetchWhitelist();

      if (currentList.includes(value))
        return call.interaction.reply({ content: 'This word is already in the whitelist.', ephemeral: true });

      updateWhitelist(currentList.concat(value))
        .then(() => {
          call.interaction.reply(`Successfully added ${value} to the whitelist.`);
          filter.reloadWords({ whitelist: currentList.concat(value) });
        })
        .catch((err) => {
          process.emit('logBotError', err);
          call.interaction.reply(`Failed to add ${value} to the whitelist.`);
        });
    } else if (option === 'remove') {
      const currentList = await filter.fetchWhitelist();

      if (!currentList.includes(value)) return call.interaction.reply({ content: 'This word is not in the whitelist.', ephemeral: true });

      updateWhitelist(currentList.filter((word) => word !== value))
        .then(() => {
          call.interaction.reply(`Successfully removed ${value} from the whitelist.`);
          filter.reloadWords({ whitelist: currentList.filter((word) => word !== value) });
        })
        .catch((err) => {
          process.emit('logBotError', err);
          call.interaction.reply(`Failed to remove ${value} from the whitelist.`);
        });
    } else if (option === 'view') {
      const currentList = await filter.fetchWhitelist();

      sendPaged(
        call,
        new MessageEmbed()
          .setColor('RED')
          .setAuthor({ name: 'The following content may contain NSFW language.' })
          .setTitle('Whitelisted Word Combinations'),
        {
          values: currentList.sort((a, b) => a.localeCompare(b)),
          startWith: '||`',
          endWith: '`||',
          joinWith: '`, `'
        }
      );
    }
  },
};
