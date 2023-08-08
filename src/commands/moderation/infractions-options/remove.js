'use strict';

const { SlashCommandSubcommandBuilder } = require('@discordjs/builders'),
  { MessageEmbed } = require('discord.js'),
  Infractions = require('../../../util/infractions.js');

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName('remove')
    .setDescription('Removes the provided infraction.')
    .addIntegerOption((option) =>
      option.setName('infraction')
        .setDescription('The infraction ID.')
        .setRequired(true))
    .addStringOption((option) =>
      option.setName('reason')
        .setDescription('The reason for removing this infraction')
        .setRequired(true))
    .addUserOption((option) =>
      option.setName('target')
        .setDescription('The user to remove an infraction from (supply infraction position instead of ID).')
        .setRequired(false)),
  exec: async (call, infractions, restricted) => {
    await call.interaction.deferReply();

    let infractionId = call.interaction.options.getInteger('infraction');

    const modLogs = call.client.channels.cache.get(call.client.MOD_LOGS_CHANNEL),
      reason = call.interaction.options.getString('reason');

    // If infractions exist, "target" parameter was suplied and the user supplied an index for the "infraction" parameter
    if (infractions) {
      if (!infractionId || !infractions.current[infractionId - 1])
        return call.interaction.editReply('Invalid infraction number provided. Please rerun the command and specify the number of the infraction seen in in the user\'s infraction list, or don\'t specify a target.');

      var infraction = infractions.current[parseInt(infractionId) - 1];

      if (infraction.type === 'mute' && restricted())
        return call.interaction.editReply('You cannot remove this infraction because it is not a `marketplace mute`.');

      infractionId = infraction.id;
    }

    infraction = infraction ?? await Infractions.getInfraction(call.client.HD.id, parseInt(infractionId));

    if (!infraction)
      return call.interaction.editReply('An invalid infraction was provided. If the `target` argument is provided, infraction must be properly indexed according to the user\'s infractions list.');

    // Load infractions if the "target" parameter wasn't supplied
    if (!infractions) {
      infractions = Infractions.infractionsOf(
        await call.client.guilds.cache.get(infraction.guild)?.members.fetch(infraction.user).catch(() => null)
          ?? await call.client.users.fetch(infraction.user),
        infraction.guild
      );
    }

    (
      infractions ?
        infractions.removeInfraction(infractionId) :
        Infractions.removeInfraction(call.guild.id, infractionId)
    ).then(
      async () => {
        call.interaction.editReply('Successfully removed the infraction.');

        const embed = new MessageEmbed()
          .setColor('BLUE')
          .setTitle('Infraction Removed')
          .addField('Infraction of', call.client.users.cache.get(infraction.user)?.tag ?? 'Unknown User')
          .setFooter({ text: `Removed by ${call.user.username}`, iconURL: call.user.displayAvatarURL() })
          .setDescription(`**[Infraction](${infraction?.log_url})**`)
          .setTimestamp();

        if (reason?.length > 0) embed.addField('Reason', reason);

        modLogs?.send({ embeds: [embed] }).catch(() => null);
      },
      (err) => {
        process.emit('logBotError', err);
        call.interaction.editReply('Failed to remove the infraction.');
      }
    );
  },
};
