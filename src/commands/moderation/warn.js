'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders'),
  { formatDateEmbed, pastTenseFilter } = require('../../util/common.js'),
  { Modal, TextInputComponent, MessageActionRow, MessageEmbed } = require('discord.js'),
  ROLES = require('../../util/roles.json'),
  Infractions = require('../../util/infractions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warns the provided user.')
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName('target')
        .setDescription('The target user.')
        .setRequired(true))
    .addStringOption((option) =>
      option.setName('reason')
        .setDescription('The reason for this warning.')
        .setRequired(false)),
  canUse: {
    users: ['118496586299998209'],
    roles: [ROLES.INTERN_MOD, ROLES.MOD, ROLES.SENIOR_MOD, ROLES.SCAM_INVESTIGATOR, ROLES.ADMINISTRATOR, ROLES.INTERN_SCAM_INVESTIGATOR],
    cant: 'You do not have permission to run this command.',
  },
  exec: async (call) => {
    const user = await call.client.users.fetch(call.interaction.options.getUser('target'));

    if (!user)
      return call.interaction.reply({ content: 'Please provide a valid target to warn.', ephemeral: true });

    if (user.id === call.user.id)
      return call.interaction.reply({ content: 'You cannot warn yourself.', ephemeral: true });

    if (user.id === call.client.user.id)
      return call.interaction.reply({ content: 'You cannot warn me.', ephemeral: true });

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
          .setCustomId('warn_reason')
          .setTitle('Reason Prompt')
          .addComponents(
            new MessageActionRow().addComponents(
              new TextInputComponent()
                .setCustomId('warn_reason')
                .setLabel('Reason')
                .setStyle('PARAGRAPH'))),
        { interaction: confirmInteraction ?? call.interaction });

      reason = reasonInteraction.fields.getTextInputValue('warn_reason');

      reasonInteraction.deferUpdate();
      
      if (!reason)
        return call.interaction.safeReply({ content: 'You must provide a reason. We can\'t just go around warning people for no reason!', ephemeral: true });
    }

    call.interaction.safeReply(`Successfully warned ${user.username}. Infraction ID: \`${Infractions.ids[call.interaction.guild.id] + 1}\``);

    const embed = new MessageEmbed()
      .setTitle('Warning Information')
      .setColor(call.client.DEFAULT_EMBED_COLOR)
      .setDescription(reason.substring(0, 2048))
      .addField('Date', new Date(Date.now()).toString().substring(0, 15))
      .addField('Moderator', call.user.tag)
      .addField('Appeal', 'To appeal, create an appeal ticket below by sending `,ticket`.');

    user.send({ content: 'You received a warning:', embeds: [embed] }).catch(() => { });

    return { type: 'Warned', member: user, reason };
  },
};
