'use strict';

const { SlashCommandSubcommandBuilder } = require('@discordjs/builders'),
  { MessageEmbed, Message } = require('discord.js'),
  ms = require('ms'),
  { parseTime, sentenceCase, addDots } = require('../../../util/common.js'),
  { MUTE_TYPES } = require('../../../util/constants.js'),
  ROLES = require('../../../util/roles.json'),
  timers = require('../../../load/timers.js'),
  Infractions = require('../../../util/infractions.js');

const MUTE_NOT_RESTRICTED = [ROLES.MARKETPLACE_STAFF, ROLES.CR, ROLES.INTERN_MOD, ROLES.MOD, ROLES.SENIOR_MOD, ROLES.SCAM_INVESTIGATOR, ROLES.ADMINISTRATOR, ROLES.DEPARTMENT_HEAD];

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName('edit')
    .setDescription('Edits infractions.')
    .addIntegerOption((option) =>
      option.setName('infraction')
        .setDescription('The infraction ID.')
        .setRequired(true))
    .addStringOption((option) =>
      option.setName('type')
        .setDescription('The type of infraction.')
        .setRequired(true)
        .addChoices(...['ban', 'mute', 'kick', 'warn', 'softban'].map((c) => ({ name: c, value: c }))))
    .addStringOption((option) =>
      option.setName('reason')
        .setDescription('The reason for editing this infraction.')
        .setRequired(true))
    .addStringOption((option) =>
      option.setName('length')
        .setDescription('The updated length of the infraction. Applies only to bans and mutes.')
        .setRequired(false))
    .addStringOption((option) =>
      option.setName('mute_type')
        .setDescription('The type of mute to convert the infraction to.')
        .setRequired(false)
        .addChoices(...Object.keys(MUTE_TYPES).map((type) => ({ name: type, value: type })))),
  exec: async (call, _, restricted, callMember) => {
    await call.interaction.deferReply();
    
    const modLogs = call.client.channels.cache.get(call.client.MOD_LOGS_CHANNEL),
      type = call.interaction.options.getString('type'),
      infraction = await Infractions.getInfraction(call.client.HD.id, parseInt(call.interaction.options.getInteger('infraction')));

    if (!infraction)
      return call.interaction.editReply(`No infraction was found with the id \`${call.interaction.options.getInteger('infraction')}\`.`);

    const user = await call.client.users.fetch(infraction.user),
      member = await call.client.HD.members.fetch(infraction.user).catch(() => null),      
      muteType = call.interaction.options.getString('mute_type');

    let length = call.interaction.options.getString('length'),
      doNotMute;

    if (['mute', 'ban'].includes(type)) {
      if (!length)
        return call.interaction.editReply('The `length` parameter is required for this infraction type.');
      
      length = length?.toLowerCase() === 'perm' ? type === 'mute' ? ms('100y') : 0 : parseTime(length);
    }

    const reason = call.interaction.options.getString('reason');
    
    if (member && call.client.HD.ownerId !== call.member.id && (call.member.roles.highest.position <= member.roles.highest.position || call.client.HD.ownerId === member.id))
      return call.interaction.editReply('You are not high enough in role hierarchy to update this infraction.');

    switch (type) {
    case 'warn': {
      break;
    }
    case 'ban': {
      if (member && !member.bannable)
        return call.interaction.editReply('I do not have permission to ban this member.');

      if (isNaN(length) || length < 0) return call.interaction.editReply('Please rerun the command with a valid ban length.');

      break;
    }
    case 'kick': {
      if (member && !member.kickable) return call.interaction.editReply('I do not have permission to kick this member.');

      break;
    }
    case 'mute': {
      if (length <= 0 || (restricted(callMember, MUTE_NOT_RESTRICTED) && length > 86400000))
        return call.interaction.editReply('Please rerun the command and specify a valid amount of time to update the user\'s infraction to and to mute them for or use `perm` to just add the role to them. Note that app readers cannot mute for more than 24 hours.');

      const muteRoles = MUTE_TYPES[muteType];

      if (!muteRoles)
        return call.interaction.editReply('A valid mute type must be provided.');

      if (muteRoles.length && muteRoles.every((role) => !call.member.roles.cache.has(role)))
        return call.interaction.editReply({
          content: `You do not have any of the necessary roles to use this type of mute. Roles allowed: \`${muteRoles
            .map((role) => call.client.HD.roles.cache.get(role)?.name)
            .filter((role) => role !== undefined)
            .join('`, `')}\``,
          ephemeral: true 
        });

      break;
    }
    case 'softban': {
      if (member && !member.bannable) return call.interaction.editReply('I do not have permission to softban this member.');

      break;
    }
    default:
      break;
    }

    if (infraction.type === 'mute') {
      const count = member?.roles.cache.filter((role) => role.name.toLowerCase().endsWith('mute')).length ?? 0;

      if (count === 1) {
        const currentMuteRole = member.roles.cache.find(({ name }) => name.toLowerCase().endsWith('mute')),
          currentMuteType = currentMuteRole.name.substring(0, currentMuteRole.name.indexOf(' ')).toLowerCase(),
          { info: mute } = timers.list.find((t) => t.type === 'unmute' && t.info.type === currentMuteType && t.info.member === member.id) || {};

        if (!mute)
          timers.delete(mute.end_date);

        await member.roles.remove(currentMuteRole, 'Updating user\'s infraction.');
      } else if (count > 1) {
        doNotMute = true;
        call.interaction.editReply('The infraction specified will be updated; however, since the user has multiple mute roles, you will need to manually unmute and (if applicable) re-mute the user using the commands.');
      }
    } else if (infraction.type === 'ban' && await call.client.HD.bans.fetch().then((bans) => bans.some((ban) => ban.user.id === infraction.user))) {
      await call.client.HD.members.unban(infraction.user, 'Updating user\'s infraction.');
    }

    const infractionEmbed = new MessageEmbed()
      .setTitle('Your Infraction Has Received An Update')
      .setColor('RED')
      .addField('New Moderation Type', `${sentenceCase(type)}`, true)
      .addField('Infraction ID', infraction.id)
      .addField('Moderator', call.user + ` (${call.user.tag})`, true)
      .addField('Reason', reason ? addDots(reason, 1024) : 'none');

    if (type === 'mute')
      infractionEmbed
        .addField('Mute Type', `${sentenceCase(muteType)} Muted`, true)
        .addField('Length', length !== ms('100y') ? parseTime(length) : 'Until manual unmute', true);
    else if (type === 'ban')
      infractionEmbed.addField('Length', length === 0 ? 'perm' : parseTime(length), true);
    else
      infractionEmbed.addField('Date', new Date(Date.now()).toString().substring(0, 15), true);

    const modLogsEmbed = new MessageEmbed()
      .setTitle('Infraction Updated')
      .setTimestamp()
      .setColor('RED')
      .setAuthor({ name: `${user.username} ${sentenceCase(type)}`, iconURL: user.displayAvatarURL() })
      .addField('Target', user.toString(), true)
      .addField('Moderator', call.user.toString(), true);

    if (infraction.log_url && infraction.log_url !== 'null') modLogsEmbed.setURL(infraction.log_url);

    if (length) modLogsEmbed.addField('Length', length !== ms('100y') ? parseTime(length) : 'Until manual unmute', true);
    
    modLogsEmbed.addField('Reason', reason.trim() ? addDots(reason, 1024) : 'none');

    const modLogsMsg = await modLogs?.send({ embeds: [modLogsEmbed] }),
      inf = {
        type,
        reason,
        length,
        committer: call.user.id,
        log_url: infraction.log_url,
        mute_type: muteType ? sentenceCase(muteType) : null,
        edit_log_url: modLogsMsg instanceof Message ? modLogsMsg.url : 'null',
      },
      infractions = Infractions.infractionsOf(
        await call.client.users.fetch(infraction.user),
        (call.client.HD ?? call.client.HD ?? call.client.guilds.cache.first()).id
      );

    await infractions.ready;

    infractions.updateInfraction(infraction?.id, inf).then(
      async () => {
        call.interaction.editReply('Successfully updated the infraction.');

        await user.send({ embeds: [infractionEmbed] }).catch(() => {});

        if (type === 'mute' && !doNotMute) {
          const muteRole = call.client.HD.roles.cache.find(({ name }) => name.toLowerCase() === `${muteType.toLowerCase()} mute`);

          member.roles.add(muteRole, reason).then(() => {
            const mute = {
              guild: call.client.HD.id,
              member: member.id,
              end_date: Date.now() + length,
              type: muteType.toLowerCase(),
              moderator: call.user.id,
            };

            timers.create('unmute', mute, mute.end_date);
          });
        } else if (type === 'ban') {
          if (length > 0) {
            const ban = { guild: call.client.HD.id, member: user.id, end_date: Date.now() + length };

            timers.create('unban', ban, ban.end_date);
          }

          call.client.HD.members.ban(user.id, { reason, days: 0 }).then(() => { });
        } else if (type === 'kick') {
          member.kick(reason).then(() => { });
        } else if (type === 'softban') {
          call.client.HD.members
            .ban(user.id, { reason, days: 3 })
            .then(() => call.client.HD.members.unban(user.id));
        }
      },
      (err) => {
        process.emit('logBotError', err);
        call.interaction.editReply('Failed to update the infraction.');
      }
    );
  }
};
