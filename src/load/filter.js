'use strict';

/**
 * Function locations in this file are sorted by hierarchy,
 * functions go directly above the function(s) that call upon it.
 * If multiple functions are of the same hierarchy they are sorted
 * via length, shortest top longest bottom.
 */

const { MessageEmbed, MessageButton, MessageActionRow } = require('discord.js'),
  letters = require('../util/letters.json'),
  { escapeRegex, safeBlock } = require('../util/common.js'),
  { getClient } = require('./database'),

  SPACE_CHARACTERS = ['_', '-', ' '],
  bypasses = {},
  SOLO = '118496586299998209';

let client,
  whitelist = [],
  blacklist = [],
  softBlacklist = [],
  badWordRegex = /a^/,
  onlyBadRegex = /a^/;

for (const [letter, bypass] of Object.entries(letters))
  bypasses[letter] = new RegExp(`${escapeRegex(bypass).replace(/ /g, '|')}`, 'gi');

// Converts all repeating whitespace into a single space and removes all non alphabetical & space characters.
// First /\s+/g regex replace combines all repeating whitespace (specifically newlines) before stripping other characters.
// Second /\s+/g regex confirms that no repeating whitespace is left behind.
// 'my   phone # is:\n\n999-999-9999' -> 'my phone is: '
function strip(str) {
  return str.replace(/\s+/g, ' ')
    .replace(new RegExp(SPACE_CHARACTERS.join('|'), 'g'), ' ')
    .replace(/[^A-Za-z ]+/g, '')
    .replace(/\s+/g, ' ');
}

// Replaces many accents and similar looking characters to their primitive characters.
// 'héllỚ' -> 'hello'
function normalize(str) {
  str = str
  // Ignore mentions
    .replace(/<@!?\d{16,19}>/g, 'ping')
  // Ignore emoji ids
    .replace(/(?<=<a?:.+:)\d+>|<a?(?=:.+:\d+>)/g, '');

  for (const [letter, regex] of Object.entries(bypasses))
    str = str.replace(regex, letter);

  return str;
}

// Replaces common bypasses with their similar character.
// 'h3llo' -> 'hello'
function replaceCommon(str) {
  return str
    .replace(/!|1/g, 'i')
    .replace(/\(\)|0|\[\]/g, 'o')
    .replace(/3/g, 'e')
    .replace(/4|@/g, 'a');
}

// Gets all blacklisted substrings within the text with a 10 character maximum border. Consider 'hello' is blacklisted.
// The onlyBad parameter matches blacklisted words without a 10 character border if set to 'true'
// 'Oh hello there Joe, I did not see you there' -> 'Oh hello there Joe'
function getBlacklisted(str, onlyBad = false, customRegex) {
  const regex = customRegex ? customRegex
    : onlyBad ? onlyBadRegex
    : badWordRegex;

  str = normalize(str);

  return (strip(str).match(regex) || [])
    .concat(strip(replaceCommon(str)).match(regex) || []);
}

// Returns whether or not a string contains whitelisted text. Consider 'hello' is a bad word and 'Hello Joe' is whitelisted.
// 'Hello Joe!' -> true
// 'Hello Steve!' -> false
function isWhitelisted(str) {
  // Bad word test
  return str.match(onlyBadRegex) && whitelist.some((white) => str.toLowerCase().includes(white));
}

// Formats and returns the first bad substring detected in the text, surrounding the blacklisted word in brackets. Consider 'hello' is blacklisted.
// 'Oh hello there Joe, I did not see you there' -> 'Oh [hello] there Joe'
function getBad(content) {
  const matches = getBlacklisted(content);

  let match;

  if (!client.whitelistDisabled)
    match = matches.find((m) => !isWhitelisted(m));

  if (match)
    return match.replace(onlyBadRegex, '[$&]');

  return null;
}

// Boolean representation of getBad results. Used for simplifying search functions.
function isBad(content) { return getBad(content) != null; }

// Puts all text from a MessageEmbed into an array.
// { title: 'hello', fields: [{ name: 'hi', value: 'there', inline: true }] } -> ['hello', 'hi', 'there']
function richStrings(embed) {
  return [
    embed.title,
    embed.description,
    embed.author?.name,
    embed.footer?.text,
    ...(embed.fields ?? []).map((f) => f.name),
    ...(embed.fields ?? []).map((f) => f.value)
  ].filter((v) => !!v);
}

// Searches a Message object for blacklisted words, handling the message appropriately if so.
function handle(message) {
  if (!message.guild ||
		[message.client.user.id, SOLO].includes(message.author.id) ||
		message.client.AUTOMOD_DISABLED_GUILDS.includes(message.guild.id) ||
		(message.client.AUTOMOD_DISABLED_CHANNELS.includes(message.channel.parentId) &&
    !message.client.AUTOMOD_ENABLED_CHANNELS.includes(message.channel.id)) ||
		(message.client.AUTOMOD_DISABLED_CHANNELS.includes(message.channel.id) &&
    !message.client.AUTOMOD_ENABLED_CHANNELS.includes(message.channel.id)))
    return;

  const strings = [message.content, ...richStrings(message.embeds.find((embed) => embed.type === 'rich') ?? {})].filter((str) => str),
    bad = strings.find(isBad);

  if (!bad)
    return;

  message.reason = 'bad word detected';
  message.bad = true;

  const fullText = message.content.substring(0, 1800),
    badText = getBad(bad);

  message.author.send({
    embeds: [
      new MessageEmbed()
        .setColor('RED')
        .setTitle('Blacklist Match Found')
        .setDescription(`\`\`\`md\n${safeBlock(fullText).substring(0, 2039)}\`\`\``)
        .addField('Matched Text', `\`\`\`css\n${badText}\`\`\``)
        .setFooter({ text: 'Click the button below if this is a false positive (mistake).' })
    ],
    components: [new MessageActionRow().addComponents(new MessageButton().setCustomId('filter_false_positive').setLabel('Mistake').setStyle('DANGER'))]
  });
  message.delete();
}

// Boolean representation of getBlacklisted results. Used for simplifying search functions.
// Currently, this function is only used in other files.
// 'Hello Joe!' -> true
// 'Hey Joe!' -> false
function isBlacklisted(str, onlyBad = false, customRegex) { return getBlacklisted(str, onlyBad, customRegex).length > 0; }

// Used for filter RegExps, allows for things such as `hellllllooo` and `hel llooo` to be matched instead of just `hello`.
// 'hello' -> 'h(?: |h)*e(?: |e)*l(?: |l)*l(?: |l)*o'
function regexifyWord(word, soft = false) { return word.replace(/\w(?!$)/g, `$&(?:${soft ? '' : SPACE_CHARACTERS.join('|') + '|'}$&){0,20}`); }

// Returns the array of blacklisted phrases
function getBlacklistArray() {
  return blacklist;
}

// Returns the array of whitelisted phrases
function getWhitelistArray() {
  return whitelist;
}

// Retrieves list of blacklisted words from the database
function fetchBlacklist(soft) {
  return getClient()
    .query(`SELECT blacklist FROM public.filter${soft ? '_soft' : ''}`)
    .then((res) => res.rows[0].blacklist);
}

// Retrieves list of whitelisted words from the database
function fetchWhitelist() {
  return getClient().query('SELECT whitelist FROM public.filter').then((res) => res.rows[0].whitelist);
}

module.exports = {
  id: 'filter',
  loaded: false,
  normalize,
  strip,
  replaceCommon,
  richStrings,
  getBlacklisted,
  isBlacklisted,
  isWhitelisted,
  isBad,
  getBad,
  regexifyWord,
  getBlacklistArray,
  getWhitelistArray,
  fetchBlacklist,
  fetchWhitelist,
  loadWords: async function() {
    this.reloadWords({ blacklist: await fetchBlacklist(), softBlacklist: await fetchBlacklist(true), whitelist: await fetchWhitelist() });

    this.loaded = true;
  },
  reloadWords: function(lists) {
    if (lists.blacklist || lists.softBlacklist) {
      if (Array.isArray(lists.softBlacklist))
        softBlacklist = lists.softBlacklist;

      if (Array.isArray(lists.blacklist))
        blacklist = lists.blacklist;

      const combined = blacklist.map((word) => regexifyWord(word))
        .concat(softBlacklist.map((word) => regexifyWord(word, true))).join('|');

      badWordRegex = new RegExp('.{0,10}(?:' + combined + ').{0,10}', 'gi');
      onlyBadRegex = new RegExp(combined, 'gi');

      this.blacklist = lists.blacklist;
      this.badWordRegex = badWordRegex;
    }

    if (lists.whitelist) {
      whitelist = lists.whitelist;

      this.whitelist = lists.whitelist;
    }
  },
  exec: function(_client) {
    client = _client;

    const reportChannel = client.channels.cache.get(client.REPORT_CHANNEL);

    // client.prependListener('messageCreate', handle);
    // client.prependListener('rawMessageUpdate', handle);

    if (!reportChannel)
      return;

    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isButton() || !interaction.customId.startsWith('filter_')) return;

      const { message, user } = interaction;

      if (interaction.customId === 'filter_false_positive') {
        reportChannel
          .send({
            embeds: [
              new MessageEmbed()
                .setColor(client.DEFAULT_EMBED_COLOR)
                .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
                .setTitle('Filter Report')
                .setDescription(message.embeds[0].description)
                .addField('Matched Text', message.embeds[0].fields[0].value)
                .setFooter({ text: `User ID: ${user.id}` })
            ],
            components: [
              new MessageActionRow().addComponents(
                new MessageButton().setCustomId('filter_accept').setLabel('Accept').setStyle('SUCCESS'),
                new MessageButton().setCustomId('filter_deny').setLabel('Deny').setStyle('DANGER'),
                new MessageButton().setCustomId('filter_impossible').setLabel('Can\'t Whitelist').setStyle('PRIMARY')
              )
            ]
          });

        interaction.update({ components: [new MessageActionRow().addComponents(new MessageButton().setCustomId('filter_false_positive').setLabel('Mistake').setStyle('DANGER').setDisabled(true))] });
      } else if (client.isMod(user) && ['filter_accept', 'filter_deny', 'filter_impossible'].includes(interaction.customId)) {
        let dm;

        if (interaction.customId === 'filter_accept') {
          dm = 'Your filter mistake report was accepted and corrected.';
        } else if (interaction.customId === 'filter_deny') {
          dm = 'Your filter mistake report was denied. **You have not been punished**.';
        } else if (interaction.customId === 'filter_impossible') {
          dm = 'Unfortunately, we are unable to whitelist the sequence of characters that was found to be profane in your report (there is no such thing as a perfect filter).' +
						'**You have not been punished**.' +
						' Possibilities for why this could not be whitelisted include but are not limited to: terribly incorrect spelling, link hashes (such as youtube/imgur IDs), homographs or random characters.' +
						'\nSuggested solutions: use a different word if a homograph, spell correctly or if two combined words, space them out (e.g `hello.world` -> `hello. world`).';
        }

        client.users
          .fetch(message.embeds[0].footer.text.match(/\d+/)?.[0])
          .then((u) => u.send({ content: dm, embeds: message.embeds }))
          .catch(() => { });
        message.delete();
      }
    });
  }
};
