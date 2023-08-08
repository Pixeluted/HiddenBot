'use strict';

const { MessageActionRow, MessageButton } = require('discord.js'),
  timers = require('../load/timers.js'),
  MarketplacePost = require('./post.js');

module.exports = async function(call, post, isRepost = false, interaction) {
  const champion = call.client.isPatreon(call.user, 'champion'),
    gold = call.client.isPatreon(call.user, 'gold');

  if (!isRepost && !(await call.confirmationPrompt({
    content: 'Here is a preview of your post, do you wish to send for approval? Click `Yes` to send it for approval, or `No` to cancel the prompt.',
    embeds: [await post.embed()],
  }))) {
    if (isRepost) {
      post.info.status = 'approved';
      post.update();
    }

    return call.user.send('Your post has not been sent.');
  }

  timers.create(
    'post',
    {
      userId: call.user.id,
      channelId: post.postInfo.channel.id
    },
    process.env.NODE_ENV === 'production' ? Date.now() + (champion ? 10_800_000 : gold ? 21_600_000 : 43_200_000) : 10_000
  );

  if (post.postInfo.autoApprove) {
    post.approve(call.client.user).then(async () => {
      const embed = await post.embed();

      call.client.botLogs?.send({
        embeds: [
          embed
            .setColor('BLUE')
            .setTitle(`Marketplace Post Auto Approved (ID: ${post.id})`)
            .setFooter({ text: `Approved by ${call.client.user.tag}` })
        ],
        components: [
          new MessageActionRow()
            .addComponents([
              new MessageButton()
                .setCustomId('marketplace_remove_auto_approve')
                .setLabel('Disable Auto Approval')
                .setStyle('DANGER')
            ])
        ]
      });
      
      if (interaction)
        interaction.reply({ content: 'Your post has been auto approved', ephemeral: true });
      else
        call.user.send('Your post has been auto approved.');
    }, () => interaction ? interaction.reply({ content: 'Failed to approve your post', ephemeral: true }) : call.user.send('Failed to approve your post.'));
  } else {
    post.info.status = 'pending';
    post.update();

    MarketplacePost.pendingList.set(post.id, post);

    if (interaction)
      interaction.reply({ content: 'Message successfully sent for approval. To view the approval queue, run `/queue`.', ephemeral: true });
    else
      call.user.send('Message successfully sent for approval. To view the approval queue, run `/queue`.');
  }
};
