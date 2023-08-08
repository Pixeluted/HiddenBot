'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders'),
  { pastTenseFilter, formatDateEmbed } = require('../../util/common.js'),
  ROLES = require('../../util/roles.json'),
  { MessageEmbed } = require('discord.js'),
  Infractions = require('../../util/infractions.js'),
  { Modal, TextInputComponent, MessageActionRow } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kicks the provided user.')
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName('target')
        .setDescription('The target user.')
        .setRequired(true))
    .addStringOption((option) =>
      option.setName('reason')
        .setDescription('The reason for this kick.')
        .setRequired(false)),
  canUse: {
    users: ['118496586299998209'],
    roles: [ROLES.MOD, ROLES.SENIOR_MOD, ROLES.SCAM_INVESTIGATOR, ROLES.ADMINISTRATOR],
    cant: 'You do not have permission to run this command.',
  },
  exec: async (call) => {
    const member = call.interaction.options.getMember('target');

    if (!member) return call.interaction.reply({ content: 'Please rerun the command and specify a valid user to kick.', ephemeral: true });

    if (member.id === call.user.id) return call.interaction.reply({ content: 'You cannot kick yourself.', ephemeral: true });

    if (member.id === call.client.user.id) return call.interaction.reply({ content: 'You cannot kick me.', ephemeral: true });

    if (call.member.roles.highest.position <= member.roles.highest.position || call.interaction.guild.ownerId === member.id)
      return call.interaction.reply({ content: 'You are not high enough in role hierarchy to kick this user.', ephemeral: true });

    if (!member.kickable) return call.interaction.reply({ content: 'I do not have permission to kick this member.', ephemeral: true });

    const recentInf = member.user.infractions?.current.find((inf) => (parseInt(inf.date) + 3600000) > Date.now());

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
          .setCustomId('kick_reason')
          .setTitle('Reason Prompt')
          .addComponents(
            new MessageActionRow().addComponents(
              new TextInputComponent()
                .setCustomId('kick_reason')
                .setLabel('Reason')
                .setStyle('PARAGRAPH'))),
        { interaction: confirmInteraction ?? call.interaction });

      reason = reasonInteraction.fields.getTextInputValue('kick_reason') || 'none';

      reasonInteraction.deferUpdate();
    }
      
    const embed = new MessageEmbed()
      .setTitle('Kick Information')
      .setColor(call.client.DEFAULT_EMBED_COLOR)
      .setDescription(reason.substring(0, 2048))
      .addField('Date', new Date(Date.now()).toString().substring(0, 15))
      .addField('Moderator', call.user.tag)
      .addField('Appeal', 'To appeal, create an appeal ticket below by sending `,ticket`.');

    await member.kick(reason).then(
      () => call.interaction.safeReply(`Successfully kicked ${member.user.username}. Infraction ID: \`${Infractions.ids[call.interaction.guild.id] + 1}\``),
      () => call.interaction.safeReply({ content: `Failed to kick ${member.user.username}`, ephemeral: true })
    );

    member.send({ content: 'You have been kicked:', embeds: [embed] }).catch(() => null);

    return { type: 'Kicked', member, reason };
  },
};
