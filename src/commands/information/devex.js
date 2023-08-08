'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders'),
  { MessageEmbed } = require('discord.js'),
  { DEVEX_CONVERSION_RATE } = require('../../util/constants.js'),
  { round } = require('../../util/common.js'),
  { isEphemeralChannel } = require('../../util/common');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('devex')
    .setDescription('Converts ROBUX into USD or vice versa.')
    .addIntegerOption((option) =>
      option.setName('amount')
        .setDescription('The amount to convert.')
        .setRequired(true))
    .addStringOption((option) =>
      option.setName('currency')
        .setDescription('The currency to convert.')
        .setRequired(false)
        .addChoices({ name: 'usd', value: 'USD' }, { name: 'robux', value: 'R$' })),
  // bypassChannels: ['815720998414319637', '360585358737539075'], // "DEVELOPMENT", "STAFF" categories
  useAnywhere: false,
  exec: (call) => {
    const currency = call.interaction.options.getString('currency') ?? 'R$',
      amount = call.interaction.options.getInteger('amount');

    if (amount <= 0)
      return call.interaction.reply({ content: 'Please re-run the command with a valid positive integer to convert.', ephemeral: true });

    if (amount > Number.MAX_SAFE_INTEGER)
      return call.interaction.reply({ content: `Unfortunately, the number that you have provided for me to convert is not within my boundaries. 

JavaScript uses double-precision floating-point format numbers as specified in IEEE 754. Because of this, I can only safely represent integers between \`-(2^53 - 1)\` and \`2^53 - 1\`.

In more understandable terms: smol brain bot not know big numbr :(`, ephemeral: true });

    call.interaction.reply({
      embeds: [
        new MessageEmbed()
          .setColor(call.client.DEFAULT_EMBED_COLOR)
          .setFooter({ text: `Requested by ${call.user.tag} (${call.user.id})`, iconURL: call.user.displayAvatarURL() })
          .setDescription(`\`${amount.toLocaleString()}${currency}\` converts to \`${round(currency === 'R$' ? amount * DEVEX_CONVERSION_RATE : amount / DEVEX_CONVERSION_RATE).toLocaleString()
          }\`${currency === 'R$' ? 'USD' : 'R$'}`)
      ],
      ephemeral: isEphemeralChannel(call.interaction)
    });
  }
};
