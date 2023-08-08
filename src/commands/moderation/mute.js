'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders'),
  { Modal, TextInputComponent, MessageActionRow, MessageEmbed } = require('discord.js'),
  ms = require('ms'),
  { parseTime, titleCase, pastTenseFilter, formatDateEmbed } = require('../../util/common.js'),
  { MUTE_TYPES } = require('../../util/constants.js'),
  timers = require('../../load/timers.js'),
  ROLES = require('../../util/roles.json'),
  Infractions = require('../../util/infractions.js');

const notRestricted = [
    ROLES.MARKETPLACE_STAFF,
    ROLES.SENIOR_MARKETPLACE,
    ROLES.INTERN_CR,
    ROLES.CR,
    ROLES.SENIOR_CR,
    ROLES.INTERN_MOD,
    ROLES.MOD,
    ROLES.SENIOR_MOD,
    ROLES.INTERN_SCAM_INVESTIGATOR,
    ROLES.SCAM_INVESTIGATOR,
    ROLES.ADMINISTRATOR,
    ROLES.DEPARTMENT_HEAD,
  ],
  usersNotRestricted = ['118496586299998209', '300816697282002946'];

function restricted(call) {
  return !usersNotRestricted.includes(call.user.id) && !call.member.roles.cache.some((r) => notRestricted.includes(r.id));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mutes the provided user.')
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName('target')
        .setDescription('The target user.')
        .setRequired(true))
    .addStringOption((option) =>
      option.setName('length')
        .setDescription('How long to mute the user.')
        .setRequired(true))
    .addStringOption((option) =>
      option.setName('type')
        .setDescription('The type of mute.')
        .setRequired(false)
        .addChoices(...Object.keys(MUTE_TYPES).map((t) => ({ name: t, value: t }))))
    .addStringOption((option) =>
      option.setName('reason')
        .setDescription('The reason for this ban.')
        .setRequired(false)),
  canUse: {
    users: usersNotRestricted,
    roles: notRestricted,
    cant: 'You do not have permission to run this command.',
  },
  restricted,
  exec: async (call) => {
    const member = await call.interaction.guild.members.fetch(call.interaction.options.getUser('target')).catch(() => null);

    if (!member) return call.interaction.reply({ content: 'Please rerun the command and specify a valid `target` to mute.', ephemeral: true });

    if (member.id === call.user.id) return call.interaction.reply({ content: 'You cannot mute yourself.', ephemeral: true });

    if (member.id === call.client.user.id) return call.interaction.reply({ content: 'You cannot mute me.', ephemeral: true });

    if (call.member.roles.highest.position <= member.roles.highest.position && call.interaction.guild.ownerId !== member.id)
      return call.interaction.reply({ content: 'You are not high enough in role hierarchy to mute this user.', ephemeral: true });

    let length = call.interaction.options.getString('length');

    length = length?.toLowerCase() === 'perm' ? ms('100y') : parseTime(length);

    if (!length || length <= 0 || (restricted(call) && length > 86400000))
      return call.interaction.reply({ content: 'Please rerun the command and specify a valid amount of time to mute this user or use `perm` to just add the role to them. Note that app readers cannot mute for more than 24 hours.', ephemeral: true });
    
    const type = call.interaction.options.getString('type') ?? 'server';

    if (member.isCommunicationDisabled() && type.toLowerCase() === 'server')
      return call.interaction.reply({ content: `The specified user is already ${type.toLowerCase()} muted.`, ephemeral: true });

    if (timers.list.some((t) => t.type === 'unmute' && t.info.type === type.toLowerCase() && t.info.member === member.id))
      return call.interaction.reply({ content: `The specified user is already ${type.toLowerCase()} muted.`, ephemeral: true });

    const muteRoles = MUTE_TYPES[type.toLowerCase()];

    if (!muteRoles)
      return call.interaction.reply({
        content: `Please rerun the command with a valid type of mute or no type (no type defaults to a server mute). i.e. ,\`mute @user <?type> <time> <reason>\` TYPES: \`${Object.keys(MUTE_TYPES).join(
          '`, `'
        )}\`.`,
        ephemeral: true
      });

    if (muteRoles.length && muteRoles.every((role) => !call.member.roles.cache.has(role)))
      return call.interaction.reply({
        content:
          `You do not have any of the necessary roles to use this type of mute. Roles allowed: \`${muteRoles
            .map((role) => call.interaction.guild.roles.cache.get(role)?.name)
            .filter((role) => role !== undefined)
            .join('`, `')}\``,
        ephemeral: true
      });

    const recentInf = member.user.infractions?.current.find((inf) => (parseInt(inf.date) + 3600000) > Date.now());

    if (recentInf) {
      var confirmInteraction = await call.confirmationPrompt({
        replyOptions: {
          content: `This user was ${pastTenseFilter(recentInf.type)} by <@${recentInf.committer}> ${formatDateEmbed(recentInf.date, 'R')} with the following reason: \`${recentInf.reason ?? 'none'}\`. Are you sure you want to proceed?`,
          ephemeral: true
        }
      });

      if (!confirmInteraction)
        return call.interaction.followUp({ content: 'Cancelled command.', ephemeral: true });
    }

    let reason = call.interaction.options.getString('reason');

    if (!reason) {
      const reasonInteraction = await call.modalPrompt(
        new Modal()
          .setCustomId('mute_reason')
          .setTitle('Reason Prompt')
          .addComponents(
            new MessageActionRow().addComponents(
              new TextInputComponent()
                .setCustomId('mute_reason')
                .setLabel('Reason')
                .setStyle('PARAGRAPH'))),
        { interaction: confirmInteraction ?? call.interaction });

      reason = reasonInteraction.fields.getTextInputValue('mute_reason') || 'none';

      reasonInteraction.deferUpdate();
    }

    const timeout = type.toLowerCase() === 'server' && length < ms('28d'),
      muteRole = call.interaction.guild.roles.cache.find(({ name }) => name.toLowerCase() === `${type.toLowerCase()} mute`);

    (timeout ? member.timeout(length, reason) : member.roles.add(muteRole, reason)).then(() => {
      call.interaction.safeReply(`Successfully muted ${member.user.username}. Infraction ID: \`${Infractions.ids[call.interaction.guild.id] + 1}\``);

      const embed = new MessageEmbed()
        .setColor('RED')
        .setTitle('You Have Been Muted')
        .addField('Type', `${titleCase(type)} Muted`, true)
        .addField('Length', length !== ms('100y') ? parseTime(length) : 'Until manual unmute', true)
        .addField('Moderator', call.user + ` (${call.user.tag})`, true)
        .addField('Reason', reason.substring(0, 1024), true)
        .addField('Appeal', 'To appeal, create an appeal ticket below by sending `/ticket`.');

      member.send({ embeds: [embed] }).catch(() => { });

      if (!timeout) {
        const mute = {
          guild: call.interaction.guild.id,
          member: member.id,
          end_date: Date.now() + length,
          type: type.toLowerCase(),
          moderator: call.user.id,
        };

        timers.create('unmute', mute, mute.end_date);
      }
    },
    (err) => {
      process.emit('logBotError', err);
      call.interaction.safeReply({ content: `Failed to mute ${member.user.username}`, ephemeral: true });
    });

    return {
      type: `${type.toLowerCase().replace(/./, (c) => c.toUpperCase())} Muted`,
      member,
      reason,
      length,
    };
  },
};
