'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders'),
  { stripIndents } = require('common-tags'),
  { MessageEmbed } = require('discord.js'),
  MarketplacePost = require('../../util/post.js');

module.exports = {
  useAnywhere: false,
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Tells you how many posts are awaiting approval.'),
  exec: async (call) => {
    if (!MarketplacePost.loaded)
      return call.interaction.reply({ content: 'The bot has recently restarted and marketplace posts have not yet loaded.', ephemeral: true });

    const sortedQueue = [...MarketplacePost.pendingList.values()]
      .filter((post) => post.info.status === 'pending' && !post.info.claimed)
      .sort(MarketplacePost.queueSort);

    call.interaction.reply({ embeds: [
      new MessageEmbed()
        .setColor(call.client.DEFAULT_EMBED_COLOR)
        .setTitle('Pending')
        .setDescription(stripIndents`Queue Size: \`${sortedQueue.length}\`
					Position in Queue: \`${(sortedQueue.findIndex((post) => post.info.authorId === call.user.id) + 1) || 'no post in queue'}\``)
        .setFooter({ text: `Requested by ${call.user.tag}`, iconURL: call.user.displayAvatarURL() })
    ], ephemeral: true });
  }
};
