const { isBad } = require('./filter');
const { client: clientPG } = require('./database'),

  // eslint-disable-next-line max-len
  commonWords = ['are', 'dont', 'don', 'didn', 'won', 'had', 'im', 'was', 'is', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'u', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us', 'the'],
  CHAT_CHANNELS = ['535514561986428929', '535514647952883712'],
  OPTED_OUT = ['347449698581348373', '545079726180401153'],

  STREAK_CHANNEL = '535514561986428929',

  channels = {};

// Prevent bot from thinking streak has been broken before the longest streak has loaded.
let longestStreak = Infinity;

const streak = [];

function addToAvg(average, value, count) {
  return cI(average === 0 ? value : average + ((value - average) / (count + 1)));
}

function removeFromAvg(average, value, count) {
  return cI(((average * count) - value) / (count - 1));
}

function round(num) {
  return Math.round(num * 100) / 100;
}

function CPM(msgLen, typeLen) { return typeLen === 0 ? 'N/A' : round(60000 * (msgLen / typeLen)); }

// Checks invalid numbers
function cI(num) {
  return num === Infinity || num === -Infinity || isNaN(num) ? 0 : num;
}

function wordFilter(word) {
  return word.length > 0 && !commonWords.includes(word.toLowerCase()) && !word.includes('`') && !isBad(word);
}

function getWords(messages) {
  const map = {};

  for (const content of messages.map((m) => m.content)) {
    const unique = content.match(/(?<!'|`|‘|’)(\b[a-z]+\b)(?!(.|\n)*\b\1\b)/gi);

    if (!unique)
      continue;

    for (let word of unique) {
      if (!wordFilter(word))
        continue;

      word = word.toLowerCase();

      if (word === 'constructor')
        continue;

      if (word in map)
        map[word]++;
      else
        map[word] = 1;
    }
  }

  return [].concat.apply([], Object.entries(map).map(([word, count]) => {
    let ret;

    try {
      ret = Array(count).fill(word);
    } catch (exc) {
      console.log('Invalid length:', count, '\nWord:', word);
      console.warn(exc.stack);

      ret = [];
    }

    return ret;
  }));
}

function mode(array) {
  const modeMap = {};

  let maxEl = array[0],
    maxCount = 1;

  for (let i = 0; i < array.length; ++i) {
    const el = array[i];

    if (modeMap[el] == null)
      modeMap[el] = 1;
    else
      modeMap[el]++;

    if (modeMap[el] > maxCount) {
      maxEl = el;
      maxCount = modeMap[el];
    }
  }

  // Value, amount.
  return [maxEl, modeMap[maxEl]];
}

module.exports = {
  id: 'chat-stats',
  CHAT_CHANNELS,
  getWords,
  exec: (client) => {
    longestStreak = clientPG.query('SELECT MAX("length") AS "length" FROM public.streaks').then((res) => res.rows[0].length);

    client
      .on('messageDelete', async (m) => {
        if (m.author.bot ||
					!CHAT_CHANNELS.includes(m.channel.id) ||
					OPTED_OUT.includes(m.author.id) ||
					!m.currentAvgWordLen ||
					!m.currentAvgTypeLen)
          return;

        const stats = await clientPG
          .query('SELECT messages, msg_len_avg, word_len_avg, type_len_avg, mobile_type_len_avg FROM public.chat WHERE "user" = $1', [m.author.id]).then((result) => result.rows[0]);

        if (!stats)
          return;

        const index = stats.messages.findIndex(({ id }) => id === m.id),
          totalCount = stats.messages.length,
          pc_count = stats.messages.filter((m) => m.mobile === false).length,
          mobile_count = stats.messages.length - pc_count,
          count = m.mobile ? mobile_count : pc_count;

        if (index < 0)
          return;

        stats.messages.splice(index, 1);

        clientPG.query(`UPDATE public.chat SET
					messages = $2, msg_len_avg = $3,
					word_len_avg = $4, ${m.mobile ? 'mobile_' : ''}type_len_avg = $5 WHERE "user" = $1`,
        [
          m.author.id,
          JSON.stringify(stats.messages),
          removeFromAvg(stats.msg_len_avg, m.content.length, totalCount),
          removeFromAvg(stats.word_len_avg, m.currentAvgWordLen, totalCount),
          removeFromAvg(m.mobile ? stats.mobile_type_len_avg : stats.type_len_avg, m.currentAvgTypeLen, count)
        ]);
      })
      .on('realTypingStart', (channel, user) => {
        if (!channel || channel.type === 'dm' || OPTED_OUT.includes(user.id))
          return;

        if (!(channel.id in channels))
          channels[channel.id] = {};

        const channelS = channels[channel.id];

        if (!(user.id in channelS))
          channelS[user.id] = { start: Date.now() };

        const userS = channelS[user.id];

        clearTimeout(userS.timeout);

        userS.timeout = setTimeout(() => delete channelS[user.id], 9000);
      })
    // User Stats
      .on('message', async (m) => {
        m.mobile = !!m.author.presence.clientStatus && !m.author.presence.clientStatus.desktop && !m.author.presence.clientStatus.web;

        if (m.author.bot || !CHAT_CHANNELS.includes(m.channel.id) || OPTED_OUT.includes(m.author.id))
          return;

        let { messages, msg_len_avg, word_len_avg, type_len_avg, mobile_type_len_avg, safe_count, swear_count, mobile_count } = await clientPG
          .query(`SELECT messages, msg_len_avg,
						word_len_avg, type_len_avg,
						mobile_type_len_avg,
						safe_count, swear_count, mobile_count
						FROM public.chat WHERE "user" = $1`, [m.author.id])
          .then((result) => {
            if (!result.rows[0])
              throw null;

            return result.rows[0];
          })
          .catch(() => clientPG.query('INSERT INTO public.chat ("user") VALUES($1)', [m.author.id])
            .then(() => ({ messages: [], msg_len_avg: 0, word_len_avg: 0, type_len_avg: 0, safe_count: 0, swear_count: 0, mobile_count: 0 })));

        if (!(m.channel.id in channels))
          channels[m.channel.id] = {};

        const channel = channels[m.channel.id],
          user = channel[m.author.id];

        let currentAvgTypeLen = null;

        if (user) {
          clearTimeout(user.timeout);

          currentAvgTypeLen = CPM(m.content.length, Date.now() - user.start);

          // If outlier, discard:
          if (Math.abs((m.mobile ? mobile_type_len_avg : type_len_avg) - currentAvgTypeLen) > 300)
            currentAvgTypeLen = null;

          delete channel[m.author.id];
        }

        // 0 divided by # = 0
        // # divided by 0 = Infinity
        // 0 divided by 0 = NaN

        const words = (m.content.match(/\w{1,10}/g) || []).filter((w) => w.length <= 10),
          message_count = messages.length,
          // Messages since implementation of typing speed counter, used for PC only since mobile_count was reset
          // at about the same time.
          pc_count = messages.filter((m) => m.mobile === false).length,
          // Mobile count, but affected by deleted messages.
          _mobile_count = messages.length - pc_count,
          currentAvgWordLen = words.length > 0 ? words.map((w) => w.length).reduce((a, b) => a + b) / words.length : 0;

        msg_len_avg = addToAvg(msg_len_avg, m.content.length, message_count);
        word_len_avg = addToAvg(word_len_avg, currentAvgWordLen, message_count);

        if (currentAvgTypeLen) {
          if (m.mobile)
            mobile_type_len_avg = addToAvg(mobile_type_len_avg, currentAvgTypeLen, _mobile_count);
          else
            type_len_avg = addToAvg(type_len_avg, currentAvgTypeLen, pc_count);
        }

        if (m.bad) {
          swear_count++;
        } else {
          safe_count++;

          if (m.mobile)
            mobile_count++;
        }

        Object.assign(m, { currentAvgTypeLen, currentAvgWordLen });

        const allWords = getWords(messages),
          [favorite_word, favorite_word_count] = mode(allWords);

        messages.push({ id: m.id, channel: m.channel.id, created: m.createdTimestamp, content: m.content, mobile: m.mobile });

        clientPG.query(`UPDATE public.chat
					SET messages = $2, msg_len_avg = $3,
					word_len_avg = $4, type_len_avg = $5,
					mobile_type_len_avg = $6,
					safe_count = $7, swear_count = $8, mobile_count = $9,
					favorite_word = $10, favorite_word_count = $11
					WHERE "user" = $1;`, [m.author.id, JSON.stringify(messages),
          msg_len_avg, word_len_avg, type_len_avg, mobile_type_len_avg,
          safe_count, swear_count, mobile_count,
          favorite_word, favorite_word_count]);
      })
    // Server Stats
      .on('message', async (m) => {
        if (m.channel.id !== STREAK_CHANNEL)
          return;

        if (longestStreak instanceof Promise)
          longestStreak = await longestStreak;

        const lastStreak = streak[streak.length - 1];

        if (lastStreak && (m.author.bot || !m.content || m.content.toLowerCase() !== lastStreak.content.toLowerCase())) {
          if (streak.length < longestStreak)
            return streak.length = 0;

          clientPG.query('INSERT INTO public.streaks ("messages", "length", "content") VALUES($1, $2, $3)',
            [JSON.stringify(streak.map((s) => ({ id: s.id, content: s.content, author: s.author.id, url: s.url }))), streak.length, streak[0].content.toLowerCase()]);

          streak.length = 0;
        }

        if (streak.every((s) => s.author !== m.author))
          streak.push(m);
      });
  }
};