'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders'),
  ROLES = require('../../util/roles.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unbans the provided user.')
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName('target')
        .setDescription('The user to unban.')
        .setRequired(true))
    .addStringOption((option) =>
      option.setName('reason')
        .setDescription('The reason for this unban.')
        .setRequired(false)),
  id: 'unban',
  desc: 'Unbans the provided user. `,unban (user) [reason+]`',
  canUse: {
    users: ['118496586299998209', '300816697282002946'],
    roles: [ROLES.MOD, ROLES.SENIOR_MOD, ROLES.SCAM_INVESTIGATOR, ROLES.ADMINISTRATOR],
    cant: 'You do not have permission to run this command.',
  },
  exec: async (call) => {
    let user = await call.client.users.fetch(call.interaction.options.getUser('target')).catch(() => null);

    if (!user) return call.interaction.reply({ content: 'Please rerun the command with a valid `target` to unban.`', ephemeral: true });

    user = await call.interaction.guild.bans.fetch(user).then((ban) => ban?.user).catch(() => null);

    if (!user) return call.interaction.reply({ content: 'The given user is not banned.', ephemeral: true });

    const reason = call.interaction.options.getString('reason') ?? 'none';

    call.interaction.guild.members.unban(user, reason).then(
      (unbannedUser) => call.interaction.reply({ content: `Successfully unbanned ${unbannedUser.username}.` }))
      .catch(() => call.interaction.reply({ content: `Failed to unban ${user.username}.`, ephemeral: true }));

    return { type: 'Unbanned', member: user, reason };
  },
};
