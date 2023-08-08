'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders'),
  timers = require('../../load/timers.js'),
  { flatten } = require('../../util/common.js'),
  { MUTE_TYPES } = require('../../util/constants.js'),
  ROLES = require('../../util/roles.json');

const notRestricted = [ROLES.CR, ROLES.INTERN_MOD, ROLES.MOD, ROLES.SENIOR_MOD, ROLES.SCAM_INVESTIGATOR, ROLES.ADMINISTRATOR, ROLES.DEPARTMENT_HEAD],
  usersNotRestricted = ['118496586299998209', '300816697282002946'];

function restricted(call) {
  return !usersNotRestricted.includes(call.user.id) && !call.member.roles.cache.some((r) => notRestricted.includes(r.id));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Unmutes the provided user.')
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName('target')
        .setDescription('The target user.')
        .setRequired(true))
    .addStringOption((option) =>
      option.setName('type')
        .setDescription('The type of mute to remove.')
        .setRequired(true)
        .addChoices(...Object.keys(MUTE_TYPES).map((t) => ({ name: t, value: t }))))
    .addStringOption((option) =>
      option.setName('reason')
        .setDescription('The reason for this unmute.')
        .setRequired(false)),
  canUse: {
    users: usersNotRestricted,
    roles: [...notRestricted, ...flatten(Object.values(MUTE_TYPES))],
    cant: 'You do not have permission to run this command.',
  },
  exec: async (call) => {
    const member = await call.interaction.guild.members.fetch(call.interaction.options.getUser('target')).catch(() => null);

    if (!member) return call.interaction.reply({ content: 'Please rerun the command and specify a valid user to unmute.', ephemeral: true });

    if (member.id === call.user.id) return call.interaction.reply({ content: 'You cannot unmute yourself.', ephemeral: true });

    if (member.id === call.client.user.id) return call.interaction.reply({ content: 'You cannot unmute me.', ephemeral: true });

    if (call.member.roles.highest.position <= member.roles.highest.position ?? call.interaction.guild.ownerId === member.id)
      return call.interaction.reply({ content: 'You are not high enough in role hierarchy to unmute this user.', ephemeral: true });

    const type = call.interaction.options.getString('type'),
      muteRoles = MUTE_TYPES[call.interaction.options.getString('type')];

    if (muteRoles.length && muteRoles.every((role) => !call.member.roles.cache.has(role)))
      return call.interaction.reply({
        content: `You do not have any of the necessary roles to use this type of mute. Roles allowed: \`${
          muteRoles
            .map((role) => call.interaction.guild.roles.cache.get(role)?.name)
            .filter((role) => role !== undefined)
            .join('`, `')
        }\``,
        ephemeral: true
      });

    const reason = call.interaction.options.getString('reason') ?? 'none',
      muteRole = call.interaction.guild.roles.cache.find(({ name }) => name.toLowerCase() === `${type.toLowerCase()} mute`),
      { info: mute } = timers.list.find((t) => t.type === 'unmute' && t.info.type === type.toLowerCase() && t.info.member === member.id) || {};

    if (member.isCommunicationDisabled())
      return member.timeout(null, `${call.interaction.user.username} - unmuted them`)
        .then(() => call.interaction.reply({ content: `Successfully unmuted ${member.user.username}.`, ephemeral: true }))
        .catch(() => call.interaction.reply({ content: `Failed to unmute ${member.user.username}.`, ephemeral: true }));

    if (mute) {
      timers.delete(mute.end_date);

      if (!member.roles.cache.has(muteRole.id)) return call.interaction.reply({ content: `Successfully unmuted ${member.user.username}.`, ephemeral: true });
    }

    if (!mute || !member.roles.cache.has(muteRole.id)) return call.interaction.reply({ content: `The specified user is not ${type.toLowerCase()} muted.`, ephemeral: true });

    if (mute.moderator !== call.user.id && restricted(call))
      return call.interaction.reply({ content: 'App readers and community representatives are not allowed to unmute users that they did not mute.', ephemeral: true });


    member.roles.remove(muteRole, reason).then(
      () => call.interaction.reply({ content: `Successfully unmuted ${member.user.username}.` }),
      () => call.interaction.reply({ content: `Failed to unmute ${member.user.username}`, ephemeral: true })
    );

    return { type: 'Unmuted', member, reason };
  },
};
