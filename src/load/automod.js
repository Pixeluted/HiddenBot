'use strict';

const { MessageEmbed } = require('discord.js'),
  emojiRegex = require('emoji-regex'),
  Logs = require('./logs.js'),
  { parseTime, safeBlock } = require('../util/common.js'),
  timers = require('../load/timers.js'),
  { LINK_PERMS, LINK_REGEX } = require('../util/constants.js'),
  { channels: submissionChannels } = require('./submissions.js'),
  { isBlacklisted, regexifyWord, richStrings } = require('./filter.js');

const EMOJI_THRESHOLD = 8,
  // 20 minutes
  VOICE_AUTOMOD_MUTE_LENGTH = 1200000,
  CREATION_FILTER = [
    'forsale',
    'forhire',
    'selling',
    'commissionsopen'
  ],
  CREATION_REGEX = new RegExp(CREATION_FILTER.map((trigger) => regexifyWord(trigger)).join('|')),
  CHECKS = [
    // Remove "selling" word triggers from creations channel
    {
      test: (message) => {
        return message.channel.id === message.client.CREATIONS_CHANNEL
          && [message.content, ...richStrings(message.embeds.find((embed) => embed.type === 'rich') ?? {})].find((str) => isBlacklisted(str, false, CREATION_REGEX));
      },
      message: 'Please do not attempt to sell or get commissions using the creations channel.',
      reason: 'creations filter trigger'
    },
    // Anti repeating messages
    {
      test: (message) => {
        return message.content && message.guild.messages.some((m) => {
          return m.id !== message.id
						&& m.author.id === message.author.id
						&& m.content.toLowerCase() === message.content.toLowerCase()
						&& (message.createdTimestamp - m.createdTimestamp) <= 5000;
        });
      },
      message: 'Please do not send identical messages so quickly.',
      reason: 'duplicated message'
    },
    // Anti whitespace messages
    {
      test: (message) => {
        const spaceCount = message.content.replace(/\S+/g, '').length;

        if ((spaceCount !== 0 && message.content.length === spaceCount) || (message.content.length >= 10 && spaceCount > (message.content.length - spaceCount)))
          return true;
      },
      message: 'Please do not send messages with unnecessary amounts of whitespace.',
      reason: 'more than 50% whitespace'
    },
    // Anti spam messages
    {
      test: (message) => {
        if (['564871254532816916', '360584952137646083', '488123901377773575'].includes(message.channel.parentId))
          return false;

        const emojis = message.content.match(new RegExp(`<a?:[a-z0-9_]+:\\d+>${emojiRegex()}`, 'gi'));

        // Too many emojis
        if (emojis && emojis.length > EMOJI_THRESHOLD)
          return true;
      },
      message: 'Please do not send spammy messages.',
      reason: `more than ${EMOJI_THRESHOLD} emojis`
    },
    // Anti spam ping
    {
      test: (message) => {
        const result = message.mentions.users.size >= (message.member.mentionThreshold ?? 10);

        if (result) 
          message.member.mentionThreshold = Math.max(message.member.mentionThreshold ? message.member.mentionThreshold - 2 : 8, 2);

        return result;
      },
      message: 'Please do not mass mention. You have been muted for 10 minutes.',
      action: { type: 'mute', length: 600000, reason: 'Mass pinging users: 10 or more users pinged.' },
      reason: 'mass pinging (10+ users)'
    },
    // Anti spoilers
    {
      test: (message) => /\|\|(.|\n)+\|\|/.test(message.content.replace(/(?<!\|\|)(```|`)(?:.|\n)+?\1(?!\|\|)/g, '')) || message.attachments.first()?.name.startsWith('SPOILER_'),
      message: 'Please do not send spoilers.',
      reason: 'contains spoilers'
    },
    // Anti links
    {
      test: (message) => ![...submissionChannels, message.client.CREATIONS_CHANNEL].includes(message.channel.id) && LINK_PERMS.every((role) => !message.member.roles?.cache.has(role)) && LINK_REGEX.test(message.content),
      message: 'You must be `🤎 Bronze II` (level 5) before being able to post links.',
      reason: 'contains link before level 5'
    },
    // Anti scam messages (all scam messages attempt to ping @everyone).
    {
      test: (message) => !message.member.permissions.has('MENTION_EVERYONE') && message.content.includes('@everyone'),
      message: 'Attempting to ping @everyone is common for compromised accounts.',
      reason: 'attempted everyone ping',
      ignoreBypass: true
    }
  ];

async function handle(message, newMessage) {
  if (newMessage)
    message = newMessage;

  if (message.author.bot || message.channel.type !== 'GUILD_TEXT' || message.guild.id === '488120689564450827')
    return;

  for (const check of CHECKS) {
    if (!check.test(message))
      continue;

    if (!check.ignoreBypass &&
			(message.client.AUTOMOD_DISABLED_CHANNELS.includes(message.channel.id) ||
				message.client.AUTOMOD_DISABLED_CHANNELS.includes(message.channel.parentId)))
      continue;

    message.reason = check.reason;
    message.delete();
    message.author.send(
      {
        embeds: [
          new MessageEmbed()
            .setColor('RED')
            .setTitle('Automod Trigger')
            .setDescription(`\`\`\`md\n${safeBlock(message.content).substring(0, 2039)}\`\`\``)
            .addField('Trigger Warning', check.message)
        ]
      }
    );

    if (!check.action)
      continue;

    if (check.action.type === 'mute') {
      const muteRole = message.guild.roles.cache.find(({ name }) => name.toLowerCase() === 'server mute');

      if (!muteRole)
        break;

      await message.member.roles.add(muteRole, check.action.reason);

      const embed = new MessageEmbed()
        .setColor('RED')
        .setTitle('You Have Been Muted')
        .addField('Type', 'Server Muted', true)
        .addField('Length', check.action.length ? parseTime(check.action.length) : 'Until manual unmute', true)
        .addField('Moderator', `${message.guild.me.toString()} (${message.guild.me})`, true)
        .addField('Reason', check.action.reason, true);

      message.member.send({ embeds: [embed] }).catch(() => { });

      const mute = {
        guild: message.guild.id,
        member: message.author.id,
        end_date: Date.now() + check.action.length,
        type: 'server',
        moderator: message.client.user.id
      };

      Logs.log('mute', 'Server Muted', message.member, message.guild.me, check.action.reason, check.action.length);
      timers.create('unmute', mute, mute.end_date);
    }

    break;
  }
}

module.exports = {
  id: 'automod',
  exec: (client) => {
    client
      .on('messageCreate', handle)
      .on('rawMessageUpdate', handle)
      .on('voiceStateUpdate', async (oldState, newState) => {
        if (!oldState.member || !newState.member)
          return;
          
        // Left a voice channel
        if (oldState.channel && !newState.channel) {
          if (!oldState.channel.rejoins)
            oldState.channel.rejoins = {};

          if (!oldState.channel.rejoins[oldState.member.id])
            oldState.channel.rejoins[oldState.member.id] = 0;

          oldState.channel.rejoins[oldState.member.id]++;

          setTimeout(() => {
            if (oldState.channel && oldState.member && oldState.channel.rejoins[oldState.member.id] !== 0)
              oldState.channel.rejoins[oldState.member.id]--;
          }, 10000);

          if (oldState.channel.rejoins[oldState.member.id] >= 3) {
            oldState.channel.rejoins[oldState.member.id] = 0;

            const muteRole = oldState.guild.roles.cache.find(({ name }) => name.toLowerCase() === 'voice mute');

            if (!muteRole)
              return;

            const reason = 'Rejoined call 3+ times in 10 seconds';

            await oldState.member.roles.add(muteRole, reason);

            const embed = new MessageEmbed()
              .setColor('RED')
              .setTitle('You Have Been Muted')
              .addField('Type', 'Server Muted', true)
              .addField('Length', parseTime(VOICE_AUTOMOD_MUTE_LENGTH), true)
              .addField('Moderator', `${oldState.guild.me.toString()} (${oldState.guild.me})`, true)
              .addField('Reason', reason, true);

            oldState.member.send({ embeds: [embed] }).catch(() => { });

            const mute = {
              guild: oldState.guild.id,
              member: oldState.member.id,
              end_date: Date.now() + VOICE_AUTOMOD_MUTE_LENGTH,
              type: 'voice',
              moderator: client.user.id
            };

            Logs.log('mute', 'Server Muted', oldState.member, oldState.guild.me, reason, VOICE_AUTOMOD_MUTE_LENGTH);
            timers.create('unmute', mute, mute.end_date);
          }
        }
      });
  }
};
