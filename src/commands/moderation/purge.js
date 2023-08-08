'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders'),
  ROLES = require('../../util/roles.json');

const purgeFilters = {
    user: (m, _, user) => m.author.id === user.id,
    raw: () => true,
    images: (m) => m.attachments.size > 0 && m.attachments.first().width,
    embeds: (m) => m.embeds.length > 0,
    startswith: (m, phrase) => m.content.toLowerCase().startsWith(phrase.toLowerCase()),
    endswith: (m, phrase) => m.content.toLowerCase().endsWith(phrase.toLowerCase()),
    includes: (m, phrase) => m.content.toLowerCase().includes(phrase.toLowerCase()),
    match: (m, phrase) => m.content.toLowerCase() === phrase.toLowerCase(),
  },
  amountOption = (option) =>
    option.setName('amount')
      .setDescription('The amount of messages to delete.')
      .setRequired(true);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Purges the supplied amount of messages under the given filters.')
    .setDMPermission(false)
    .addSubcommand((subcommand) => 
      subcommand.setName('raw')
        .setDescription('Deletes messages with no filter.')
        .addIntegerOption(amountOption))
    .addSubcommand((subcommand) =>
      subcommand.setName('user')
        .setDescription('Deletes messages by the supplied user.')
        .addIntegerOption(amountOption)
        .addUserOption((option) =>
          option.setName('target')
            .setDescription('The user to filter messages by.')
            .setRequired(true)))
    .addSubcommand((subcommand) =>
      subcommand.setName('images')
        .setDescription('Deletes messages containing images or attachments.')
        .addIntegerOption(amountOption))
    .addSubcommand((subcommand) =>
      subcommand.setName('embeds')
        .setDescription('Deletes messages containing embeds.')
        .addIntegerOption(amountOption))
    .addSubcommand((subcommand) =>
      subcommand.setName('startswith')
        .setDescription('Deletes messages starting with the provided phase.')
        .addIntegerOption(amountOption)
        .addStringOption((option) =>
          option.setName('phrase')
            .setDescription('The phrase that deleted messages should start with.')
            .setRequired(true)))
    .addSubcommand((subcommand) =>
      subcommand.setName('endswith')
        .setDescription('Deletes messages ending with the provided phase.')
        .addIntegerOption(amountOption)
        .addStringOption((option) =>
          option.setName('phrase')
            .setDescription('The phrase that deleted messages should end with.')
            .setRequired(true)))
    .addSubcommand((subcommand) =>
      subcommand.setName('includes')
        .setDescription('Deletes messages including with the provided phase.')
        .addIntegerOption(amountOption)
        .addStringOption((option) =>
          option.setName('phrase')
            .setDescription('The phrase that deleted messages should include.')
            .setRequired(true)))
    .addSubcommand((subcommand) =>
      subcommand.setName('match')
        .setDescription('Deletes messages including that match the provided phase.')
        .addIntegerOption(amountOption)
        .addStringOption((option) =>
          option.setName('phrase')
            .setDescription('The phrase that deleted messages should match.')
            .setRequired(true))),
  canUse: {
    users: ['118496586299998209'],
    roles: [ROLES.ASSISTANT, ROLES.INTERN_MOD, ROLES.MOD, ROLES.SENIOR_MOD, ROLES.SCAM_INVESTIGATOR, ROLES.ADMINISTRATOR, ROLES.INTERN_AR, ROLES.DEPARTMENT_HEAD],
    cant: 'You do not have permission to run this command.',
  },
  exec: async (call) => {
    const filter = purgeFilters[call.interaction.options.getSubcommand()],
      user = call.interaction.options.getUser('target'),
      phrase = call.interaction.options.getString('phrase');

    let amount = call.interaction.options.getInteger('amount');
    
    if (amount <= 0)
      return call.interaction.reply({ content: 'Amount must be greater than zero.', ephemeral: true });

    if (call.channel.beingPurged)
      return call.interaction.reply({ content: 'Please wait until the current purge in this channel finishes.', ephemeral: true });

    let purged = 0,
      attempts = 0,
      lastMessage;

    call.channel.beingPurged = true;

    while (amount > 0 && attempts < 5) {
      let messages = await call.channel.messages.fetch({ limit: 100, before: lastMessage });

      messages = messages.filter((m) => Date.now() - m.createdTimestamp < 1209600000 && filter(m, phrase, user));

      if (messages.size === 0) break;

      lastMessage = messages.last().id;
      messages = messages.first(amount);

      if (!Array.isArray(messages)) messages = [messages];
    
      call.client.lastPurgeModerator = call.user;

      if (messages.length > 1) {
        await call.channel.bulkDelete(messages, true);
      } else if (messages.length !== 0) {
        messages[0].reason = 'purge call';
        messages[0].deleter = call.client.user;

        messages[0].delete();
      }

      purged += messages.length;
      amount -= messages.length;
      attempts++;
    }

    call.channel.beingPurged = false;
    call.interaction.reply({ content: `Successfully purged ${purged} message${purged > 1 ? 's' : ''}.`, ephemeral: true });
  },
};
