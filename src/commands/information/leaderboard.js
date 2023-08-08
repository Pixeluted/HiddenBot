'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders'),
  { MessageEmbed } = require('discord.js'),
  { getClient } = require('../../load/database.js'),
  sendPaged = require('../../util/sendPaged.js'),
  { parseTime, sentenceCase } = require('../../util/common.js');
  
const PLACES = ['🥇', '🥈', '🥉'];

function countAwards(awards) {
  return awards.reduce((a, b) => a + Math.abs(b - 3), 0);
}

function tag(client, user) {
  user = client.users.cache.get(user.user ?? user);

  return user ? user.tag.replace(/``/g, '`\u200b`\u200b') : 'unknown';
}

function defaultFormat(client, res) {
  return `\`\`${tag(client, res)}\`\` - ${Object.values(res)[1].toLocaleString()}`;
}

const LEADERBOARD_QUERIES = {
  creation_stars: {
    query: `SELECT "user", creation_stars
			FROM public.users
			ORDER BY creation_stars DESC
			LIMIT 100`,
    format: defaultFormat
  },
  creation_stars_this_month: {
    query: `SELECT "user", creation_stars_last_month
			FROM public.users
			ORDER BY creation_stars_last_month DESC
			LIMIT 100`,
    format: defaultFormat
  },
  creation_posts: {
    query: `SELECT "user", creation_posts
			FROM public.users
			ORDER BY creation_posts DESC
			LIMIT 100`,
    format: defaultFormat
  },
  creation_ratio: {
    query: `SELECT "user", round(CAST(creation_stars AS decimal)/NULLIF(creation_posts, 0), 2) AS creation_ratio
			FROM public.users
			WHERE creation_posts > 5
			ORDER BY creation_ratio DESC
			LIMIT 100`,
    format: defaultFormat
  },
  creation_awards: {
    query: 'SELECT "user", "creation_awards" FROM public.users WHERE array_length(creation_awards, 1) != 0',
    sort: (a, b) => countAwards(b.creation_awards) - countAwards(a.creation_awards),
    format: (client, res) => `\`\`${tag(client, res)}\`\` - ${res.creation_awards.map((a) => PLACES[a]).join(' ')}`,
  },
  voice: {
    query: `SELECT id, total_minutes
      FROM public.voice_activity
      ORDER BY total_minutes DESC
      LIMIT 100`,
    format: (client, res, i) => `${i + 1}. \`${tag(client, res.id)}\` - ${parseTime(res.total_minutes * 60000)}`,
  },
  chat: {
    query: `SELECT id, total_minutes
      FROM public.chat_activity
      ORDER BY total_minutes DESC
      LIMIT 100`,
    format: (client, res, i) => `${i + 1}. \`${tag(client, res.id)}\` - ${parseTime(res.total_minutes * 60000)}`,
  },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Sends a leaderboard formatted paginated embed of the provided category.')
    .addStringOption((option) =>
      option.setName('leaderboard')
        .setDescription('The leaderboard to view.')
        .setRequired(true)
        .addChoices(...Object.keys(LEADERBOARD_QUERIES).map((name) => ({ name: sentenceCase(name.replace(/_/g, ' ')), value: name })))),
  exec: async (call) => {
    await call.interaction.deferReply();
    
    const type = LEADERBOARD_QUERIES[call.interaction.options.getString('leaderboard')];

    let results = await getClient().query(type.query).then((result) => result.rows);

    if (type.sort)
      results = results.sort(type.sort);

    results = results.slice(0, 100).map((res, i) => type.format(call.client, res, i));

    return sendPaged(
      call,
      new MessageEmbed()
        .setTitle('Leaderboard')
        .setFooter({ text: `Requested by ${call.user.tag}`, iconURL: call.user.displayAvatarURL() })
        .setColor(call.client.DEFAULT_EMBED_COLOR),
      {
        values: results,
        valuesPerPage: 10
      }
    );
  }
};