'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders'),
  { Modal, TextInputComponent, MessageActionRow } = require('discord.js'),
  { pastTenseFilter, formatDateEmbed } = require('../../util/common.js'),
  ROLES = require('../../util/roles.json'),
  Infractions = require('../../util/infractions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('softban')
    .setDescription('Bans then unbans the provided user to delete messages.')
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName('target')
        .setDescription('The target user.')
        .setRequired(true))
    .addStringOption((option) =>
      option.setName('reason')
        .setDescription('The reason for this softban.')
        .setRequired(false)),
  canUse: {
    users: ['118496586299998209'],
    roles: [ROLES.MOD, ROLES.SENIOR_MOD, ROLES.SCAM_INVESTIGATOR, ROLES.ADMINISTRATOR],
    cant: 'You do not have permission to run this command.',
  },
  exec: async (call) => {
    const user = await call.client.users.fetch(call.interaction.options.getUser('target')).catch(() => null);

    if (!user) return call.interaction.reply({ contente: 'Please provide a valid target to softban.', ephemeral: true });

    if (user.id === call.user.id) return call.interaction.reply({ content: 'You cannot softban yourself.', ephemeral: true });

    if (user.id === call.client.user.id) return call.interaction.reply({ content: 'You cannot softban me.', ephemeral: true });

    const member = await call.interaction.guild.members.fetch(user.id).catch(() => null);

    if (call.member.roles.highest.position <= member?.roles.highest.position || call.interaction.guild.ownerId === member?.id)
      return call.interaction.reply({ content: 'You are not high enough in role hierarchy to softban this user.', ephemeral: true });

    if (member && !member.bannable) return call.interaction.reply({ content: 'I do not have permission to ban/unban this member.', ephemeral: true });

    const recentInf = user.infractions?.current.find((inf) => (parseInt(inf.date) + 3600000) > Date.now());

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
          .setCustomId('softban_reason')
          .setTitle('Reason Prompt')
          .addComponents(
            new MessageActionRow().addComponents(
              new TextInputComponent()
                .setCustomId('softban_reason')
                .setLabel('Reason')
                .setStyle('PARAGRAPH'))),
        { interaction: confirmInteraction ?? confirmInteraction });

      reason = reasonInteraction.fields.getTextInputValue('softban_reason') || 'none';

      reasonInteraction.deferUpdate();
    }

    await call.interaction.guild.members
      .ban(user.id, { reason, days: 3 })
      .then(() => call.interaction.guild.members.unban(user.id))
      .then(() => call.interaction.safeReply(`Successfully softbanned ${user.username}. Infraction ID: \`${Infractions.ids[call.interaction.guild.id] + 1}\``))
      .catch(() => call.interaction.safeReply({ content: `Failed to ban/unban ${user.username}.`, ephemeral: true }));

    return { type: 'Softbanned', member, reason };
  },
};
