'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders'),
  { parseTime, pastTenseFilter, formatDateEmbed } = require('../../util/common.js'),
  ROLES = require('../../util/roles.json'),
  timers = require('../../load/timers.js'),
  Infractions = require('../../util/infractions.js'),
  { Modal, TextInputComponent, MessageActionRow } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bans the provided user.')
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName('target')
        .setDescription('The target user.')
        .setRequired(true))
    .addStringOption((option) =>
      option.setName('length')
        .setDescription('How long to ban the user.')
        .setRequired(false))
    .addStringOption((option) =>
      option.setName('reason')
        .setDescription('The reason for this ban.')
        .setRequired(false))
    .addIntegerOption((option) =>
      option.setName('days')
        .setDescription('How many days past to delete messages (1-7). Defaults to 0.')
        .setRequired(false)),
  canUse: {
    users: ['118496586299998209'],
    roles: [ROLES.MOD, ROLES.SENIOR_MOD, ROLES.SCAM_INVESTIGATOR, ROLES.ADMINISTRATOR],
    cant: 'You do not have permission to run this command.',
  },
  exec: async (call) => {
    const user = await call.client.users.fetch(call.interaction.options.getUser('target')).catch(() => null),
      days = Math.min(Math.max(call.interaction.options.getInteger('days') ?? 0, 0), 7);

    if (!user) return call.interaction.reply({ content: 'Please provide a valid target to ban.', ephemeral: true });

    if (user.id === call.user.id) return call.interaction.reply({ content: 'You cannot ban yourself.', ephemeral: true });

    if (user.id === call.client.user.id) return call.interaction.reply({ content: 'You cannot ban me.', ephemeral: true });

    const member = await call.interaction.guild.members.fetch(user.id).catch(() => null);

    if (member) {
      if (call.member.roles.highest.position <= member.roles.highest.position || call.interaction.guild.ownerId === member.id)
        return call.interaction.reply({ content: 'You are not high enough in role hierarchy to ban this user.', ephemeral: true });

      if (!member.bannable) return call.interaction.reply({ content: 'I do not have permission to ban this member.', ephemeral: true });
    }

    let length = call.interaction.options.getString('length');

    length = !length || length?.toLowerCase() === 'perm' ? 0 : parseTime(length);

    if (isNaN(length) || length < 0) return call.interaction.reply({ content: 'Please rerun the command with a valid ban length.', ephemeral: true });

    const recentInf = user.infractions?.current.find((inf) => (parseInt(inf.date) + 3600000) > Date.now());

    if (recentInf) {
      var confirmInteraction = await call.confirmationPrompt({
        replyOptions: {
          content: `This user was ${pastTenseFilter(recentInf.type)} by <@${recentInf.committer}> ${formatDateEmbed(recentInf.date, 'R')} with the following reason: \`${recentInf.reason ?? 'none'}\`. Are you sure you want to proceed?`,
          ephemeral: true
        },
        returnInteraction: true
      });

      if (confirmInteraction.customId.endsWith('no'))
        return call.interaction.followUp({ content: 'Cancelled command.', ephemeral: true });
    }

    let reason = call.interaction.options.getString('reason');

    if (!reason) {
      const reasonInteraction = await call.modalPrompt(
        new Modal()
          .setCustomId('ban_reason')
          .setTitle('Reason Prompt')
          .addComponents(
            new MessageActionRow().addComponents(
              new TextInputComponent()
                .setCustomId('ban_reason')
                .setLabel('Reason')
                .setStyle('PARAGRAPH'))),
        { interaction: confirmInteraction ?? call.interaction });

      reason = reasonInteraction.fields.getTextInputValue('ban_reason') || 'none';

      reasonInteraction.deferUpdate();
    }

    if (length > 0) {
      const ban = { guild: call.interaction.guild.id, member: member ? member.id : user.id, end_date: Date.now() + length };

      timers.create('unban', ban, ban.end_date);
    }

    await member
      ?.send(
        `You have been banned under the reason of \`\`${reason.replace(/``|\n/, ' ').substring(0, 1000)}\`\`
Ban Length: ${length === 0 ? 'perm' : parseTime(length)}
Moderator: ${call.user.tag} (${call.user.id})

To appeal your ban or a false ban please submit a ban appeal at our site.
Link: **<https://hiddendevs.com/appeals>**`
      )
      .catch(() => {});

    await call.interaction.guild.members.ban(user.id, { reason, days }).then(
      () => call.interaction.safeReply(`Successfully banned ${user.username}. Infraction ID: \`${Infractions.ids[call.interaction.guild.id] + 1}\``),
      (err) => {
        process.emit('logBotError', err);
        call.interaction.safeReply({ content: `Failed to ban ${user.username}`, ephemeral: true });
      }
    );

    return { type: 'Banned', member: user, reason, length };
  },
};
