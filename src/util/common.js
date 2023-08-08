'use strict';

const ms = require('ms'),
  { default: fetch } = require('node-fetch'),
  reverseMs = require('pretty-ms'),
  constants = require('./constants.js'),
  { ONLY_LINK_REGEX } = require('./constants.js');

// Taken from the ms source code and slightly edited.
const multiMsRegExp = /\+?\d+(\.\d*)?\s*(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)/gi;


// Abbreviates the provided number
// 65463 -> 65.4k (when precision is 3)
function abbreviateNumber(value, precision = 3) {
  const suffixes = ['', 'k', 'k', 'k', 't'];

  let suffixNum = 0;

  while (value >= 1000) {
    value /= 1000;
    suffixNum++;
  }

  value = parseFloat(value).toPrecision(precision);
  value += suffixes[suffixNum];

  return value;
}

// Adds a '...' and cuts off 'length' - 3 characters if the length is less than 'length'
// ('Hello my name is gt_c', 20) -> 'Hello my name is ...'
function addDots(str, length) {
  return str.length > length ? str.substring(0, length - 3) + '...' : str;
}

// Maps an array similarly to Array#map, except goes through each value asynchronously
async function asyncMap(arr, func) {
  const newArr = [];

  let i = 0;

  for (const val of arr) newArr.push(await func(val, i++));

  return newArr;
}

// Utility function for autocomplete user options for slash commands.
function autocompleteUserFunction(interaction) {
  const value = interaction.options.getFocused().toLowerCase();

  if (!value.trim())
    return interaction.respond([]);

  interaction.respond(
    interaction.client.users.cache
      .filter((u) => !u.partial && (u.tag.toLowerCase().startsWith(value) || u.id === value))
      .sort((a, b) => a.tag.localeCompare(b.tag))
      .map((u) => ({ name: u.tag, value: u.id }))
      .slice(0, 25)
  );
}

function correctGrammar(text) {
  return /^[aeiou]/.test(text) ? 'an' : 'a';
}

// Escapes RegExp operators in strings.
// 'yo... how you doing?' -> 'yo\.\.\. how you doing\?'
function escapeRegex(str) {
  return str.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
}

// Fetches a roblox user id from a discord id using bloxlink's API
async function fetchRobloxIdFromBloxlink(userId) {
  const url = 'https://api.blox.link/v1/user/' + userId,
    options = {
      method: 'GET',
    },

    query = await fetch(url, options).then((response) => response.json());

  if (query.status === 'ok') return query.primaryAccount;

  return undefined;
}

// Fetches a roblox user id from a discord id using rover's API
async function fetchRobloxIdFromRover(userId) {
  const url = `https://verify.eryn.io/api/user/${userId}`,
    options = {
      method: 'GET',
    },

    query = await fetch(url, options).then((response) => response.json());

  if (query.status === 'ok') return query.robloxId;

  return undefined;
}

// Flattens an array
// [1, 2, [3, 4]] -> [1, 2, 3, 4]
function flatten(arr) {
  return arr.reduce((flat, next) => flat.concat(Array.isArray(next) ? flatten(next) : typeof next === 'object' && next !== null ? flat.concat(Object.values(next)) : next), []);
}

// Transforms a timestamp into a date. Offset is for timezones, default is EST.
// 1589431426685 -> 'May 14 2020'
function formatDate(timestamp, offset = -4) {
  return timestamp ? new Date(parseInt(timestamp) + 3600000 * offset).toString().substring(0, 15) : null;
}

// Transforms a timestamp into an embedded form.
// 1589431426685 -> 'Thu May 14 2020 12:43 AM'
// "type" parameter options:
// "f" gives you the date and time								            July 19, 2021 8:26 PM
// "F" gives you the day, date and time							          Monday, July 19, 2021 8:26 PM
// "R" gives an approximate										                7 days ago
// "d" and "D" gives the date									                07/19/2021
// "t" gives the time only (hours and seconds)					      8:26 PM
// "T" gives the time only (hours, seconds and milliseconds)	8:26:04 PM
function formatDateEmbed(timestamp, type = 'f') {
  return `<t:${getSeconds(parseInt(timestamp))}:${type}>`;
}

// Transforms a timestamp (milliseconds) into seconds.
// 1626716395680 -> 1626716395
function getSeconds(timestamp) {
  return Math.floor(timestamp / 1000);
}

// Formats a link/attachment into a hyperlink
function formatFile(file) {
  return ONLY_LINK_REGEX.test(file.content) ? `**[Link](${file.content})**` : `**[${file.attachments.first().name.replace(/.+\./g, '').toUpperCase()} File](${file.attachments.first().url})**`;
}

// Transforms a timestamp into time. Offset is for timezones, default is EST.
// 1589431426685 -> '20:43'
function formatTime(timestamp, offset = -4) {
  const date = new Date(timestamp + 3600000 * offset);

  return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
}

// Returns the longest string in the provided array
// ['one', 'two', 'three'] -> 'three'
function getLongestString(array) {
  return array.sort((a, b) => b.length - a.length)[0];
}

// Gets the age of a roblox account, in days since creation
async function getRobloxAge(user) {
  const createdDate =  await fetch(`https://users.roblox.com/v1/users/${user}`)
    .then((res) => res.json())
    .then((res) => res.created)
    .catch(() => null);

  return Math.round((Date.now() - new Date(createdDate).getTime()) / 86400000).toLocaleString();
}

// Creates a random ID containing random alphabetical characters.
// makeId -> 'xUiaxgYfjE'
function makeId(length = 10) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

  let id = '';

  for (let i = 0; i < length; i++) {
    id += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  return id;
}

// Takes a message and returns the first image found in the message in url form.
// This could be an attachment, embed thumbnail picture or embed image picture.
// If none of those are found, it returns the message content.
function parseImage(message) {
  const embed = message.embeds[0];

  return message.attachments.first()?.url ?? embed?.thumbnail?.url ?? embed?.image?.url ?? message.content;
}

// Converts string to number (time in milliseconds) or vice versa.
// '10m' -> 600000
// 60000 -> '10m'
function parseTime(input, options = { verbose: true, secondsDecimalDigits: 0 }) {
  if (Number.isFinite(input))
    return reverseMs(input, options);
  else if (typeof input !== 'string')
    return null;

  const matches = input.match(multiMsRegExp);

  return matches ? matches.reduce((a, b) => a + ms(b), 0) : null;
}

// Returns infraction types in their past tense.
// 'warn' -> 'warned'
// sofban' -> 'softbanned'
function pastTenseFilter(filter) {
  return `${filter.endsWith('ban') ? `${filter}n` : filter === 'mute' ? 'mut' : filter}ed`;
}

// Removes any whitespace from a string
// 'Hello World!' -> 'HelloWorld!'
function removeSpace(str) {
  return str.replace(/\s+/g, '');
}

// Rounds a number to the nearest 10th
// 33.33333 -> 33.33
function round(num) {
  return Math.round(num * 100) / 100;
}

// Safely allows the string to be formatted in a code block
// 'this`is`a`string' -> 'this\u200b`\u200bis\u200b`\u200ba\u200b`\u200bstring'
function safeBlock(str) {
  return str?.replace(/`/g, '\u200b`\u200b');
}

// Capitilizes the first letter of the string
// 'i love lowercase' -> 'I love lowercase'
function sentenceCase(str) {
  return str.replace(/./, (c) => c.toUpperCase());
}

// Deletes array values from the end of an array of strings until the combined length of the
// remaining strings is less than the provided value.
function shortenArray(array, length) {
  let index = -1;

  for (const val of array) {
    index++;

    length -= val.length;

    if (length < 0) return array.slice(0, index);
  }

  return array.slice();
}

// Converts a number into the corresponding emoji stars.
function starEmojis(rating, max = 5) {
  const round = Math.floor(rating);

  return (
    `${constants.STAR_100_EMOJI}`.repeat(round) +
		(rating !== max ? constants[`STAR_${(Math.round((rating - round) * 4) / 4) * 100}_EMOJI`] : '') +
		constants.STAR_0_EMOJI.repeat(Math.max(0, max - 1 - round))
  );
}

/**
 *
 * @param interaction The interaction that initiated the command.
 * @returns {Boolean} If the channel should be ephemeral or not
 */
function isEphemeralChannel(interaction) {
  return constants.EPHEMERAL_TXT_CHANNELS.includes(interaction.channel?.name);
}

// Title cases a string
// 'This is a string' -> 'This Is A String'
function titleCase(str) {
  return str.toLowerCase().replace(/(^|\s)\S/g, (t) => t.toUpperCase());
}

// Returns true if the provided timezone is valid according to IANA timezone identifiers
// 'America/Los_Angeles' -> true
function validTimezone(timeZone) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone });

    return true;
  } catch {
    return false;
  }
}

module.exports = {
  abbreviateNumber,
  addDots,
  asyncMap,
  autocompleteUserFunction,
  correctGrammar,
  escapeRegex,
  fetchRobloxIdFromBloxlink,
  fetchRobloxIdFromRover,
  flatten,
  formatDate,
  formatDateEmbed,
  formatFile,
  formatTime,
  getLongestString,
  getRobloxAge,
  getSeconds,
  makeId,
  parseImage,
  parseTime,
  pastTenseFilter,
  removeSpace,
  round,
  isEphemeralChannel,
  shortenArray,
  safeBlock,
  sentenceCase,
  starEmojis,
  titleCase,
  validTimezone,
};
