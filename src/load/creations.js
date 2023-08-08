'use strict';

const { MessageEmbed } = require('discord.js'),
  { getClient } = require('./database.js'),
  { setTimeout } = require('safe-timers'),
  { parseImage } = require('../util/common.js'),
  { SUBMISSION_LINKS, SUBMISSION_FILE_TYPES } = require('../util/constants.js');

const REACTION = '🌟',
  DISALLOWED_LINKS = ['roblox.com'], // To prevent game links from being sent in the creations channel
  LINKS = SUBMISSION_LINKS.filter((link) => !DISALLOWED_LINKS.includes(link)).map((link) => new RegExp(`(https?://(www\\.)?)${link.replace(/\./, '\\.')}`, 'i')),
  FEATURED_CREATION_THRESHOLD = 10,
  SOCIAL_MEDIA_THRESHOLD = 25,
  validType = new RegExp(`\\.(${SUBMISSION_FILE_TYPES.join('|')})$`, 'i');

async function determineCount(reaction) {
  await reaction.users.fetch();

  return reaction.count - reaction.me - reaction.users.cache.has(reaction.message.author.id);
}

function messageHandle(message, newMessage) {
  if (newMessage) message = newMessage;

  if (message.channel.id !== message.client.CREATIONS_CHANNEL || message.author.bot) return;

  if (LINKS.some((link) => link.test(message.content)) || message.attachments.some((att) => validType.test(att.name))) {
    // message.react(REACTION);

    // Insert if not exists
    getClient().query('INSERT INTO public.users ("user", creation_posts, creation_stars, creation_stars_last_month) SELECT $1, 0, 0, 0 WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE "user" = $1)', [
      message.author.id,
    ]);

    getClient().query('UPDATE public.users SET creation_posts = creation_posts + 1 WHERE "user" = $1', [message.author.id]);
  } else {
    message.reason = 'creation with no link';

    message
      .delete()
      .then(() => message.author.send('Your creation was deleted because it did not contain a valid link or an attachment. Your message: ```\n' + message.content.substring(0, 1897) + '\n```'));
  }
}

async function deleteHandle(message) {
  if (message.channel.id !== message.client.CREATIONS_CHANNEL || message.author.bot) return;

  const reaction = message.reactions.cache.get(REACTION);

  if (!reaction) return;

  getClient().query('UPDATE public.users SET creation_posts = creation_posts - 1, creation_stars = creation_stars - $2, creation_stars_last_month = creation_stars_last_month - $2 WHERE "user" = $1', [
    message.author.id,
    await determineCount(reaction),
  ]);
}

async function reactionHandle(reaction, user, amount) {
  const { message } = reaction,
    reactionCount = await determineCount(reaction);

  if (reaction.emoji.name !== REACTION || message.channel.id !== user.client.CREATIONS_CHANNEL || user.bot) return;

  if (amount) {
    const embed = new MessageEmbed()
      .setColor(reaction.client.DEFAULT_EMBED_COLOR)
      .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
      .setDescription(`[Post](${message.url})\n\n${message.content}`)
      .setImage(parseImage(message));

    if (reactionCount >= FEATURED_CREATION_THRESHOLD && !message.reactions.cache.has('⭐')) {
      const channel = user.client.channels.cache.get(user.client.FEATURED_CREATIONS_CHANNEL);

      // channel
      //   .send({ content: message.author.toString(), embeds: [embed] })
      //   .catch(() => channel.send({ content: message.author.toString(), embeds: [embed.setImage(undefined)] }));
      // message.react('⭐');
    }

    if (reactionCount >= SOCIAL_MEDIA_THRESHOLD && !message.reactions.cache.has('✨')) {
      const channel = user.client.channels.cache.get(user.client.SOCIAL_MEDIA_CREATIONS_CHANNEL);

      // channel
      //   .send({ content: `${message.author.toString()} <@&624287710911266816>`, embeds: [embed] }) // Ping Social Media role every time
      //   .catch(() => channel.send({ content: `${message.author.toString()} <@269926271633326082>`, embeds: [embed.setImage(undefined)] }));
      // message.react('✨');
    }

  }

  getClient().query(`UPDATE public.users SET creation_stars = creation_stars ${amount ? '+' : '-'} 1, creation_stars_last_month = creation_stars_last_month ${amount ? '+' : '-'} 1 WHERE "user" = $1`, [
    message.author.id,
  ]);
}

module.exports = {
  id: 'creations',
  exec: (client) => {
    client.on('messageCreate', messageHandle);
    client.on('messageUpdate', messageHandle);
    client.on('messageDelete', deleteHandle);

    client.on('messageReactionAdd', (reaction, user) => reactionHandle(reaction, user, true));
    client.on('messageReactionRemove', (reaction, user) => reactionHandle(reaction, user, false));

    const now = new Date();

    let nextMonth;

    if (now.getMonth() == 11) {
      nextMonth = new Date(now.getFullYear() + 1, 0, 1);
    } else {
      nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }

    // Triggers upon new month.
    setTimeout(async () => {
      console.log('Resetting creations leaderboard.');

      const topUpvotes = await getClient()
        .query(
          `SELECT "user", creation_stars_last_month FROM public.users
				ORDER BY creation_stars_last_month DESC
				LIMIT 3`
        )
        .then((res) => res.rows);

      let i = 0;

      for (const top of topUpvotes) {
        const user = client.users.cache.get(top.user);

        if (!user) continue;

        user.send(
          `Congratulations you received \`${top.creation_stars_last_month.toLocaleString()}\` amount of upvotes this month` +
					` and finished in position number ${++i} on the creations leaderboard (\`,leaderboard creations\`)! Keep it up!`
        );

        getClient().query('UPDATE public.users SET creation_awards = array_append(creation_awards, $2) WHERE "user" = $1', [user.id, i - 1]);
      }

      getClient().query('UPDATE public.users SET creation_stars_last_month = 0');
    }, nextMonth.getTime() - Date.now());
  },
};
