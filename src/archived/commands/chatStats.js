const sendPaged = require('../../util/sendPaged.js'),
  { RichEmbed } = require('discord.js'),
  { getWords, CHAT_CHANNELS } = require('../../load/chatStats.js');
const { getClient } = require('../../load/database.js'),

  HD_LOGO = 'https://cdn.discordapp.com/icons/211228845771063296/a_c915dbe8288e6a03546882a2f0de8595.gif?size=512';

function round(num) {
  return Math.round(num * 100) / 100;
}

const OPTIONS = [
  {
    title: 'info',
    value: 'Sends information regarding how the statistics command works.'
  },
  {
    title: 'words',
    value: 'Sends a paged message containing all of the users words and their amount of uses, sorted by most to least.'
  },
  {
    title: 'everyone',
    value: 'Sends the average/combined statistics of everyone in the server.'
  },
  {
    title: 'streak',
    value: 'Sends the longest streak of identical messages recorded by HiddenBot.'
  }
];

for (const option of OPTIONS)
  option.name = `,stats ${option.title}`;

function count(arr, val) {
  let num = 0;

  for (const property of arr)
    if (val === property)
      num++;

  return num;
}

module.exports = {
  id: 'stats',
  desc: 'Gives user stats.',
  channels: 'any',
  exec: async (call) => {
    let user = call.user,
      option = null;

    if (!Object.values(OPTIONS).map((o) => o.title).includes(call.args[0] && call.args[0].toLowerCase()))
      user = await call.fetchUser(call.cut) || call.user;
    else
      option = call.args[0];

    let ping = Date.now();

    const stats = !['everyone', 'streak'].includes(option) ?
      await getClient().query(`SELECT messages, msg_len_avg,
				word_len_avg, type_len_avg,
				mobile_type_len_avg,
				safe_count, swear_count,
				favorite_word, favorite_word_count
				FROM public.chat WHERE "user" = $1`, [user.id])
        .then((result) => result.rows[0]) :
      option === 'streak' ?
        await getClient().query(`SELECT s1.content, s1.messages, s1.length
				FROM public.streaks s1
				LEFT JOIN public.streaks s2 ON s1.length < s2.length;
				
				SELECT messages, "length", "content"
				FROM public.streaks
				ORDER BY "length" DESC
				LIMIT 1;`).then((res) => res[1].rows[0]) :
        await getClient().query(`SELECT 1 as messages,
				SUM(safe_count + swear_count) as total_count,
				SUM(safe_count) as safe_count,
				SUM(swear_count) as swear_count,
				SUM(mobile_count) as mobile_count,
				AVG(word_len_avg) as word_len_avg,
				AVG(msg_len_avg) as msg_len_avg,
				AVG(type_len_avg) as type_len_avg,
				AVG(mobile_type_len_avg) as mobile_type_len_avg FROM public.chat`)
          .then((result) => result.rows[0]);

    ping = Date.now() - ping;

    if (!stats || stats.messages.length === 0)
      return call.message.channel.send('This user has no recorded chat statistics.');

    const embed = new RichEmbed()
      .setFooter(`Requested by ${call.user.username}. Data fetched in ${ping} milliseconds.`, call.user.displayAvatarURL)
      .setColor('#acf8f4');

    if (!option) {
      const messageCount = stats.safe_count + stats.swear_count;

      embed
        .setAuthor(user.username, user.displayAvatarURL)
        .setTitle('Statistics')
        .setDescription(`Chat statistics of ${user.username}. For information on the ins and outs of this feature, say \`,stats info\`. ` +
					'CPM stands for characters per minute.')
        .addField('Messages', `\`${messageCount.toLocaleString()} ` +
					`(${stats.messages.filter((m) => Date.now() - m.created < 604800000).length.toLocaleString()} last week)\``, true)
        .addField('Safe Messages', `\`${stats.safe_count.toLocaleString()} (${round(stats.safe_count / messageCount * 100)}%)\``, true)
        .addField('Filtered Messages', `\`${stats.swear_count.toLocaleString()} (${round(stats.swear_count / messageCount * 100)}%)\``, true)
        .addField('Average Message Size', `\`${round(stats.msg_len_avg)} characters\``, true)
        .addField('Average Word Size', `\`${round(stats.word_len_avg)} characters\``, true)
        .addField('Average CPM', `\`${round(stats.type_len_avg)} CPM\` (mobile: \`${round(stats.mobile_type_len_avg)}\`)`, true)
        .addField('Favorite Word', stats.favorite_word && stats.favorite_word_count ? `\`${stats.favorite_word} (${stats.favorite_word_count.toLocaleString()} uses)\`` : '`N/A`', true);
    } else if (option === 'info') {
      embed
        .setTitle('Information')
        .setDescription(`Upon message in ${CHAT_CHANNELS.slice(0, -1).map((c) => `<#${c}>`).join(', ')} or <#${CHAT_CHANNELS[CHAT_CHANNELS.length - 1]}>, the **only** somewhat ` +
					'personal data stored is the message content in order to determine your favorite word(s) and message created at to determine messages in past week. ' +
					'If you are not comfortable with this, please contact either gt_c or ethanlaj to be opted out of this feature.');

      embed.author = null;
      embed.fields = OPTIONS;
    } else if (option === 'words') {
      const wordStats = {},
        words = getWords(stats.messages);

      if (words.length === 0)
        return call.message.channel.send('You have no recorded words.');

      for (const word of words)
        if (!(word in wordStats))
          wordStats[word] = count(words, word);

      return sendPaged(call, embed.setTitle('Word Statistics'),
        {
          values: Object.entries(wordStats).sort(([, a], [, b]) => b - a).map(([word, count]) => `\`${word} (${count} use${count > 1 ? 's' : ''})\``),
          valuesPerPage: 10
        });
    } else if (option === 'everyone') {
      embed
        .setAuthor('Hidden Developers', HD_LOGO)
        .setTitle('Statistics')
        .setDescription('Chat statistics of everyone. For information on the ins and outs of this feature, say `,stats info`. ' +
					'CPM stands for characters per minute.')
        .addField('Messages', `\`${parseInt(stats.total_count).toLocaleString()}\``, true)
        .addField('Safe Messages', `\`${parseInt(stats.safe_count).toLocaleString()} (${round(stats.safe_count / stats.total_count * 100)}%)\``, true)
        .addField('Filtered Messages', `\`${parseInt(stats.swear_count).toLocaleString()} (${round(stats.swear_count / stats.total_count * 100)}%)\``, true)
        .addField('Average Message Size', `\`${round(stats.msg_len_avg)} characters\``, true)
        .addField('Average Word Size', `\`${round(stats.word_len_avg)} characters\``, true)
        .addField('Average CPM', `\`${round(stats.type_len_avg)} CPM\` (mobile: \`${round(stats.mobile_type_len_avg)}\`)`, true);
    } else if (option === 'streak') {
      embed
        .setTitle('Longest Streak')
        .setDescription('Longest streak recorded by HiddenBot.')
        .addField('Content', `\`${stats.content.replace(/`/g, '').substring(0, 100) + (stats.content.replace(/`/g, '').length > 100 ? '...' : '')}\``)
        .addField('Participants', `${stats.messages.filter((m) => m.author && call.client.users.has(m.author)).map((m) => call.client.users.get(m.author).toString()).join(', ') || 'None; no shared servers'}`)
        .addField('Length', `\`${stats.length} messages\``, true);
    }

    call.message.channel.send({ embed });
  }
};