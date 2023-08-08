'use strict';

const { stripIndents } = require('common-tags'),
  hastebin = require('hastebin'),
  { Message, MessageEmbed } = require('discord.js'),
  Infractions = require('../util/infractions.js'),
  { asyncMap, formatDate, formatTime, parseTime, addDots, formatDateEmbed } = require('../util/common.js'),
  ROLES = require('../util/roles.json'),
  { ImgurClient } = require('imgur');

const imgurClient = new ImgurClient({
  clientId: process.env.IMGUR_CLIENT_ID,
  clientSecret: process.env.IMGUR_CLIENT_SECRET,
  refreshToken: process.env.IMGUR_REFRESH_TOKEN,
});

function splitContent(embed, content, name) {
  content = content.replace(/`/g, '`\u200B');

  embed.addField(name, `\`\`\`${content.substring(0, 1018)}\`\`\``);

  if (content.length > 1024) embed.addField('\u200B', `\`\`\`${content.substring(1018)}\`\`\``);

  return embed;
}

function formatVoiceChannel(channel) {
  return `**${channel.name}** ${channel.customOwner ? `(owned by ${channel.customOwner.user.username} - ${channel.customOwner.id})` : ''}`;
}

function createImageUrl(attachment) {
  // Attachment isn't an image or video
  if (!attachment.width)
    return attachment.url;

  return imgurClient.upload({ image: attachment.url }).then((res) => {
    // If error is due to invalid image ignore because that means it was a video.
    if (res.data.error) {
      process.emit('logBotError', new Error(res.error.message));

      return attachment.url;
    }

    return res.data.link;
  });
}

module.exports = {
  id: 'logs',
  imgurClient,
  log: async function(command, type, member, moderator, reason, length, fields) {
    if (!member)
      return;

    let guild = this.client.HD;

    if (member.guild) guild = member.guild;

    const helper = member?.roles?.cache.has('811747785384525875'); // Development Helper role

    member = member.user || member;

    const embed = new MessageEmbed()
      .setTimestamp()
      .setColor('RED')
      .setAuthor({ name: `${member.username} ${type}`, iconURL: member.displayAvatarURL?.() })
      .addField('Target', member.toString(), true)
      .addField('Moderator', moderator.toString(), true);

    if (length) embed.addField('Length', !isNaN(length) ? parseTime(length) : length, true);

    if (reason) embed.addField('Reason', addDots(reason, 1024));

    if (fields) embed.fields.push(...fields);

    const message = await this.modLogs.send({ embeds: [embed] }).catch(() => null);

    if (helper) await this.helperLogs.send({ embeds: [embed] }).catch(() => null);

    if (!['ban', 'mute', 'kick', 'softban', 'warn'].includes(command)) return;

    const infractions = Infractions.infractionsOf(member, guild);

    infractions.addInfraction({
      type: command,
      reason,
      length,
      committer: moderator.id ?? moderator,
      log_url: message instanceof Message ? message.url : 'null',
      mute_type: type?.endsWith('Muted') ? type.substring(0, type.indexOf(' ')) : null,
    });
  },
  exec: function(client) {
    this.client = client;

    const modLogs = client.channels.cache.get(client.MOD_LOGS_CHANNEL),
      helperLogs = client.channels.cache.get(client.HELPER_LOGS_CHANNEL),
      helperMessageLogs = client.channels.cache.get(client.HELPER_MESSAGE_LOGS_CHANNEL),
      messageLogs = client.channels.cache.get(client.MESSAGE_LOGS_CHANNEL),
      botLogs = client.channels.cache.get(client.BOT_LOGS_CHANNEL),
      voiceLogs = client.channels.cache.get(client.VOICE_LOGS_CHANNEL);

    if (!modLogs || !messageLogs || !botLogs) return console.warn('Failed to locate the mod-logs or logs channel.');

    this.modLogs = modLogs;
    this.helperLogs = helperLogs;
    this.messageLogs = messageLogs;
    this.botLogs = botLogs;

    // Message Logs

    client
      .on('messageDelete', async (message) => {
        if (!message.guild || message.guild.id !== client.HD.id || message.author.bot) return;

        let user = client.user;

        if (!message.bad && !message.reason) {
          const entry = await message.guild.fetchAuditLogs({ type: 'MESSAGE_DELETE' }).then((audit) => audit.entries.first());

          if (entry?.extra.channel.id === message.channel.id && entry?.target.id === message.author.id && entry?.createdTimestamp > Date.now() - 5000 && entry?.extra.count >= 1) {
            user = entry.executor;
          } else {
            user = message.author;
          }
        }

        const member = await client.HD?.members.fetch(user.id),
          helper = member?.roles?.cache.has('811747785384525875'), // Development Helper role
          embed = new MessageEmbed()
            .setColor(user.id === client.user.id || user.id !== message.author.id ? 'RED' : 'ORANGE')
            .setTitle('Message Delete')
            .setDescription(`In: ${message.channel}${message.content.length ? `\`\`\`${message.content.replace(/`/g, '`\u200B')}\`\`\`` : ''}`)
            .setAuthor({ name: `${message.author.username} (${message.author.id})`, iconURL: message.author.displayAvatarURL() })
            .setFooter({ text: `ID: ${message.id}` })
            .setTimestamp();


        if (message.reference) {
          embed.addField(
            'Reply',
            `[View reply](https://discord.com/channels/${message.guild.id}/${message.reference.channelId}/${message.reference.messageId})`
          );
        }

        if (message.attachments.size > 0)
          embed.addField('Attachments', await asyncMap([...message.attachments.values()], async (a) => `[${a.name.substring(0, 32)}](${await createImageUrl(a)})`).then((arr) => arr.join(', ')));

        embed.addField(
          'Information',
          `Created: ${formatDateEmbed(message.createdTimestamp)}\n` +
          `Deleter: \`${user.tag} - (${user.id})\`` +
          (message.reason ? `\nReason: \`${message.reason}\`` : '')
        );

        // messageLogs.send({ embeds: [embed] });

        // if (helper && !member.roles.cache.has(ROLES.MOD)) helperMessageLogs.send({ embeds: [embed] });
      })
      .on('messageDeleteBulk', async (messages) => {

        const moderator = client.lastPurgeModerator,
          pasteUrl = await hastebin.createPaste(
            messages.reduce(
              (a, message) => a + stripIndents`Author: ${message.author.username} (${message.author.id})
                Channel: ${message.channel.name} (${message.channel.id})
                Content: ${message.content || 'none'}
                Attachments: ${message.attachments.map((a) => a.proxyURL).join(', ') || 'none'}
                Created: ${formatDate(message.createdTimestamp, 0)} @ ${formatTime(message.createdTimestamp, 0)}` + '\n\n',
              ''
            ),
            { raw: true, contentType: 'text/plain' }
          ),
          embed = new MessageEmbed()
            .setColor('RED')
            .setTitle('Bulk Message Delete')
            .setDescription(`Channel: ${messages.first().channel}
              Messages: **[${messages.size} messages](${pasteUrl})**
              Moderator: ${moderator}`);

        // messageLogs.send({ embeds: [embed] });
        // client.channels.cache.get(client.MOD_LOGS_CHANNEL).send({ embeds: [embed] });
      })
      .on('messageUpdate', async (oldMessage, newMessage) => {
        if (newMessage.channel.type === 'DM' || newMessage.guild.id !== client.HD.id || oldMessage.content === newMessage.content || newMessage.author.bot) return;

        const embed = new MessageEmbed()
          .setTitle('Message Edit')
          .setDescription(`Channel: ${newMessage.channel}\nCreated: ${formatDateEmbed(oldMessage.createdTimestamp)}`)
          .setColor('BLUE')
          .setAuthor({ name: `${newMessage.author.username} (${newMessage.author.id})`, iconURL: newMessage.author.displayAvatarURL() })
          .setFooter({ text: `ID: ${newMessage.id}` })
          .setTimestamp();

        splitContent(splitContent(embed, oldMessage.content ?? '\u200B', 'Old Content'), newMessage.content ?? '\u200B', 'New Content');

        // messageLogs.send({ embeds: [embed] });
      });

    // Voice Logs

    client.on('voiceStateUpdate', (oldState, newState) => {
      // Left a voice channel
      if (oldState.channel && !newState.channel) {
        // voiceLogs.send({
        //   embeds: [
        //     new MessageEmbed()
        //       .setTitle('Voice Channel Leave')
        //       .setDescription(`Channel: ${formatVoiceChannel(oldState.channel)}`)
        //       .setColor('RED')
        //       .setAuthor({ name: `${newState.member.user.username} (${newState.member.user.id})`, iconURL: newState.member.user.displayAvatarURL() })
        //       .setTimestamp()
        //   ]
        // });
        // Joined a voice channel
      } else if (!oldState.channel && newState.channel) {
        // voiceLogs.send({
        //   embeds: [
        //     new MessageEmbed()
        //       .setTitle('Voice Channel Join')
        //       .setDescription(`Channel: ${formatVoiceChannel(newState.channel)}`)
        //       .setColor('GREEN')
        //       .setAuthor({ name: `${newState.member.user.username} (${newState.member.user.id})`, iconURL: newState.member.user.displayAvatarURL() })
        //       .setTimestamp()
        //   ]
        // });
        // Moved voice channels
      } else if (oldState.channelId !== newState.channelId) {
        // voiceLogs.send({
        //   embeds: [
        //     new MessageEmbed()
        //       .setTitle('Voice Channel Move')
        //       .setDescription(`Old Channel: ${formatVoiceChannel(oldState.channel)}\nNew Channel: ${formatVoiceChannel(newState.channel)}`)
        //       .setColor('BLUE')
        //       .setAuthor({ name: `${newState.member.user.username} (${newState.member.user.id})`, iconURL: newState.member.user.displayAvatarURL() })
        //       .setTimestamp()
        //   ]
        // });
      }
    });

    // Command Logs

    client.on('commandUsed', async (call, result) => {
      if (call.command.data.category !== 'moderation' || !result) return;

      result = await result;

      if (!result || result instanceof Message) return;

      this.log(call.command.data.name, result.type, await call.interaction.guild.members.fetch(result.member).catch(() => null) ?? result.member, call.user, result.reason, result.length, result.fields);
    });
  },
};
