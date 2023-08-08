'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders'),
  { getClient } = require('../../load/database'),
  { getUser: getVoiceUser } = require('../../load/voiceLevels'),
  { getUser: getChatUser } = require('../../load/chatLevels');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('transferrank')
    .setDescription('Transfer ranks from one account to another.')
    .addUserOption((option) =>
      option.setName('from_user')
        .setDescription('The user to transfer data from.')
        .setRequired(true))
    .addUserOption((option) =>
      option.setName('to_user')
        .setDescription('The user to transfer data to.')
        .setRequired(true)),
  canUse: {
    users: ['118496586299998209', '269926271633326082', '300816697282002946'],
    cant: 'You do not have permission to run this command.',
  },
  hidden: true,
  exec: async (call) => {
    const user1 = call.interaction.options.getUser('from_user'),
      user2 = call.interaction.options.getUser('to_user'),
      member1 = await call.client.HD.members.fetch(user1.id).catch(() => null),
      member2 = await call.client.HD.members.fetch(user2.id).catch(() => null);

    try {
      if (user1.bot || user2.bot) return call.interaction.reply({ content: `The user you are trying to transfer ranks ${user1.bot ? 'from' : 'to'} is a bot.`, ephemeral: true });

      if (!member1 || !member2) return call.interaction.reply({ content: `The user you are trying to transfer ranks ${member1 ? 'to' : 'from'} is not in HiddenDevs.`, ephemeral: true });

      const user1Voice = await getVoiceUser(user1.id, call.client.HD.id),
        user1Chat = await getChatUser(user1.id, call.client.HD.id);

      if (!user1Voice && !user1Chat) return call.interaction.reply({ content: 'The user you are trying to transfer ranks from has not spoken in the server via voice or messaging.', ephemeral: true });

      if (user1Voice) {
        const { length, monthly_data: voiceMonthly, total_xp: voiceTotalXp, total_minutes: voiceTotalMin, length_last_updated } = user1Voice;

        await getClient().query(`INSERT INTO public.voice_activity (id, guild_id, length, monthly_data, total_xp, total_minutes, length_last_updated) values ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET length = $3, monthly_data = $4, total_xp = $5, total_minutes = $6, length_last_updated = $7`,
        [user2.id, call.client.HD.id, length, voiceMonthly, voiceTotalXp, voiceTotalMin, length_last_updated]);

        await getClient().query('DELETE FROM public.voice_activity WHERE id = $1 AND guild_id = $2; ', [user1.id, call.client.HD.id]);
      }

      if (user1Chat) {
        const { daily_data, monthly_data: chatMonthly, total_xp: chatTotalXp, total_minutes: chatTotalMin } = user1Chat;

        await getClient().query(`INSERT INTO public.chat_activity (id, guild_id, daily_data, monthly_data, total_xp, total_minutes) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET daily_data = $3, monthly_data = $4, total_xp = $5, total_minutes = $6`,
        [user2.id, call.client.HD.id, daily_data, chatMonthly, chatTotalXp, chatTotalMin]);

        await getClient().query('DELETE FROM public.chat_activity WHERE id = $1 AND guild_id = $2', [user1.id, call.client.HD.id]);
      }

      call.interaction.reply({ content: `Successfully transferred the rank data from ${user1.username} to ${user2.username}.`, ephemeral: true });
    } catch (err) {
      process.emit('logBotError', err);
      call.interaction.reply({ content: `Failed to transfer the rank data from ${user1.username} to ${user2.username}.`, ephemeral: true });
    }
  }
};
