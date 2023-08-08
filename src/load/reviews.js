'use strict';

const { MessageEmbed } = require('discord.js'),
  timers = require('./timers.js'),
  { getClient } = require('./database.js');

const REVIEW_DELAY = 86400000;

async function canReview(client, reviewer, user) {
  reviewer = await client.users.fetch(reviewer);
  user = await client.users.fetch(user);

  reviewer?.send(`You can now review the following user using the \`/review\` command ${user} (${user.tag}).`);

  // Create the row if it doesn't exist already
  await getClient().query('INSERT INTO public.reviews ("user") SELECT $1 WHERE NOT EXISTS (SELECT 1 FROM public.reviews WHERE "user" = $1)', [user.id]);

  // Fetch current reviews
  const reviews = await getClient().query('SELECT reviews FROM public.reviews WHERE "user" = $1', [user.id]).then((res) => res.rows[0].reviews);

  // Signify that the reviewer has yet to leave a review
  reviews[reviewer.id] = 1;

  getClient().query('UPDATE public.reviews SET reviews = $2 WHERE "user" = $1', [user.id, JSON.stringify(reviews)]);
}

module.exports = {
  id: 'reviews',
  exec: (client) => {
    client.on('messageReactionAdd', async (reaction, postUser) => {
      const { message, emoji } = reaction;

      if (postUser.bot || !message.author.bot || message.channel.type !== 'DM' || ![client.THUMBSUP_EMOJI_ID, client.THUMBSDOWN_EMOJI_ID].includes(emoji.id))
        return;

      const embed = new MessageEmbed(message.embeds[0]);

      let user = (message.content.match(/\d+/) || [])[0];

      if (!user || !(user = await client.users.fetch(user)))
        return postUser.send('Failed to find the user interested in the post. The user likely no longer shares a server with the bot. Please report this issue in the <#669267304101707777> channel.');

      if (emoji.id === client.THUMBSUP_EMOJI_ID) {
        message.reactions.removeAll();
        user.send({
          content: `${postUser} (${postUser.tag}) has noted your interest in the following marketplace post and has accepted your offer.`,
          embeds: [embed]
        });
        postUser.send({
          content: `You have confirmed the commission between you and ${user} (${user.tag}). When you are confident that this commission is confirmed, please delete your original post.`,
          embeds: [embed]
        });
        timers.create('review', { postUser: postUser.id, user: user.id }, Date.now() + REVIEW_DELAY);
      } else {
        message.delete();
      }
    });

    timers.on('review', ({ postUser, user }) => {
      canReview(client, postUser, user);
      canReview(client, user, postUser);
    });
  }
};
