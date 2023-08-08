'use strict';

const { SlashCommandBuilder, ContextMenuCommandBuilder } = require('@discordjs/builders'),
  { getUser: voiceGetUser } = require('../../load/voiceLevels'),
  { getUser: chatGetUser } = require('../../load/chatLevels'),
  { MessageAttachment } = require('discord.js'),
  { createImage } = require('../../util/rankImages'),
  { isEphemeralChannel } = require('../../util/common');

module.exports = {
  useAnywhere: false,
  data: [
    new ContextMenuCommandBuilder()
      .setName('Check User Rank')
      .setType(2),
    new SlashCommandBuilder()
      .setName('rank')
      .setDescription('Get the voice or chat rank of a user, or yourself.')
      .addStringOption((option) =>
        option.setName('type')
          .setDescription('Whether to check voice or chat stats.')
          .addChoices(...[{ name: 'voice', value: 'voice' }, { name: 'chat', value: 'chat' }])
          .setRequired(true))
      .addUserOption((option) =>
        option.setName('target')
          .setDescription('The user tag to get the rank of.')
          .setRequired(false))
  ],
  exec: async (call) => {
    const user = call.interaction.targetUser ?? call.interaction.options.getUser('target') ?? call.user,
      type = call.interaction.isUserContextMenu() ? 'chat' : call.interaction.options.getString('type'),
      dbUser = await (type === 'voice' ?  voiceGetUser : chatGetUser)(user.id, call.client.HD.id) ?? {
        id: user.id,
        total_xp: 0,
        total_minutes: 0,
        daily_data: {
          minute_count: 0
        },
        length: 0
      },
      canvas = await createImage(call, dbUser, user, type === 'chat');

    await call.interaction.deferReply({ ephemeral: true });
    call.interaction.editReply({ files: [new MessageAttachment(canvas.toBuffer(), `hd_${type}_rank.png`)], ephemeral: isEphemeralChannel(call.interaction) });
  }
};
