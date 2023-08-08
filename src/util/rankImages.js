'use strict';

const { roundedRect } = require('../commands/information/user'),
  { abbreviateNumber } = require('./common'),
  { createCanvas, loadImage } = require('@napi-rs/canvas'),
  { getLevelInfo: getVoiceLevelInfo, getUsers: voiceGetUsers } = require('../load/voiceLevels'),
  { getLevelInfo: getChatLevelInfo, getUsers: chatGetUsers } = require('../load/chatLevels'),
  { DEFAULT_EMBED_COLOR } = require('./constants'),
  { Chart } = require('chart.js'),
  ChartDataLabels = require('chartjs-plugin-datalabels'),
  dayjs = require('dayjs'),
  utc = require('dayjs/plugin/utc'),
  timezone = require('dayjs/plugin/timezone'),
  CHAT_COLOR = '#5865F2';

async function getRank(dbUser, chat) {
  return (chat ? await chatGetUsers(dbUser.guild_id, 'ALL', 0, '"id", total_minutes') : await voiceGetUsers(dbUser.guild_id, 'ALL', 0, '"id", total_minutes'))
    .findIndex((o) => o.id === dbUser.id) + 1;
}

async function createImage(call, dbUser, user, chat) {
  const canvas = createCanvas(2500, 1220),
    ctx = canvas.getContext('2d'),
    xpInfo = chat ? getChatLevelInfo(dbUser.total_xp) : getVoiceLevelInfo(dbUser.total_xp),
    member = await call.client.HD.members.fetch(user.id).catch(() => null);

  // Background
  ctx.fillStyle = '#1b1b1b';
  ctx.save();
  roundedRect(ctx, 0, 0, canvas.width, 600, 50);
  ctx.fill();

  // Second background rect
  roundedRect(ctx, 0, 620, canvas.width, 600, 50);
  ctx.restore();
  ctx.fill();

  // Profile Image
  ctx.strokeStyle = '#FFF';
  ctx.lineWidth = 8;

  ctx.save();
  roundedRect(ctx, 100, 100, 400, 400, 50);
  ctx.clip();
  ctx.drawImage(await loadImage(user.displayAvatarURL({ format: 'png', size: 4096 })), 100, 100, 400, 400);
  ctx.restore();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(500, 500, 40, 0, Math.PI * 2, true);
  //ctx.clip();
  ctx.fillStyle = call.client.PRESENCE_COLORS[member?.presence?.status] || call.client.PRESENCE_COLORS.offline;
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Progress Bar
  ctx.fillStyle = '#525252';
  ctx.strokeStyle = '#FFF';
  ctx.lineWidth = 10;
  const progressBarWidth = 1800, // will end at width of canvas - 100px
    howFarIn = xpInfo.currentXp / xpInfo.neededXp,
    xpWidth = howFarIn * progressBarWidth;

  ctx.save();
  roundedRect(ctx, 600, 420, progressBarWidth, 80, 40);
  ctx.fill();

  ctx.fillStyle = call.client.DEFAULT_EMBED_COLOR;
  roundedRect(ctx, 600, 420, xpWidth, 80, 40);
  ctx.fill();

  // Tag
  const discrimSize = 60;

  let usernameSize = 120;

  ////// Username
  ctx.fillStyle = 'white';

  do {
    ctx.font = `${usernameSize -= 5}px verdana`;
  } while (ctx.measureText(user.username).width > 900);

  ctx.strokeText(user.username, 600, 360);

  ////// Discriminator
  ctx.fillStyle = 'grey';

  const usernameMetrics = ctx.measureText(user.username);

  ctx.font = `${discrimSize}px verdana`;
  ctx.fillText(`#${user.discriminator}`, 600 + usernameMetrics.width + 10, 360);

  // XP
  //1700 and 2400 is the gap
  const xpLevelSize = 80,
    xpSize = 120;

  ////// Level XP
  ctx.font = `${xpLevelSize}px verdana`;

  const abbreviatedXpLevel = ` / ${xpInfo.neededXp >= 100 ? abbreviateNumber(xpInfo.neededXp) : Math.round(xpInfo.neededXp)} XP`,
    xpLevelMetrics = ctx.measureText(abbreviatedXpLevel),
    startPosXpLevel = 2400 - xpLevelMetrics.width;

  ctx.fillText(abbreviatedXpLevel, startPosXpLevel, 360);

  ////// Current XP
  ctx.font = `${xpSize}px verdana`;

  const abbreviatedCurrXp = `${xpInfo.currentXp >= 100 ? abbreviateNumber(xpInfo.currentXp) : Math.round(xpInfo.currentXp)}`,
    xpMetrics = ctx.measureText(abbreviatedCurrXp),
    startPosXp = startPosXpLevel - xpMetrics.width;

  ctx.fillStyle = call.client.DEFAULT_EMBED_COLOR;
  ctx.fillText(abbreviatedCurrXp, startPosXp, 360);

  // Level Data
  const levelSize = 150,
    levelTextSize = 80;

  ////// Level
  ctx.font = `${levelSize}px verdana`;

  const levelMetrics = ctx.measureText(`${xpInfo.level}`),
    startPosLevel = 2400 - levelMetrics.width;

  ctx.fillText(`${xpInfo.level}`, startPosLevel, 210);

  ////// Level Text
  ctx.font = `${levelTextSize}px verdana`;

  const levelText = 'LEVEL | ',
    levelTextMetrics = ctx.measureText(levelText),
    startPosLevelText = startPosLevel - levelTextMetrics.width;

  ctx.fillStyle = 'grey';
  ctx.fillText(levelText, startPosLevelText, 210);

  // Statistics
  // Start of second rectangle is at 620px y-axis
  const valuesSize = 150,
    textSize = 80;

  /////// Rank
  ctx.font = `${valuesSize}px verdana`;

  const userRank = `#${await getRank(dbUser, chat) || 'N/A'}`,
    rankMetrics = ctx.measureText(userRank),
    startPosRank = 2400 - rankMetrics.width;

  ctx.fillStyle = call.client.DEFAULT_EMBED_COLOR;
  ctx.fillText(userRank, startPosRank, 840);

  ////// Rank Text
  ctx.font = `${textSize}px verdana`;

  const userRankText = 'RANK | ',
    rankTextMetrics = ctx.measureText(userRankText),
    startPosRankText = startPosRank - rankTextMetrics.width;

  ctx.fillStyle = 'grey';
  ctx.fillText(userRankText, startPosRankText, 840);

  ////// Minutes Today
  ctx.font = `${valuesSize}px verdana`;

  const minutesToday = Math.floor(chat ? dbUser.daily_data : dbUser.length),
    minutesTodayMetrics = ctx.measureText(`${minutesToday}`),
    startPosMinutesToday = 2400 - minutesTodayMetrics.width;

  ctx.fillStyle = call.client.DEFAULT_EMBED_COLOR;
  ctx.fillText(`${minutesToday}`, startPosMinutesToday, 1120);

  ////// Minutes Today Text
  ctx.font = `${textSize}px verdana`;

  const minutesTodayText = 'MIN TODAY | ',
    minutesTodayTextMetrics = ctx.measureText(minutesTodayText),
    startPosMinutesTodayText = startPosMinutesToday - minutesTodayTextMetrics.width;

  ctx.fillStyle = 'grey';
  ctx.fillText(minutesTodayText, startPosMinutesTodayText, 1120);

  ////// All Time XP
  ctx.font = `${valuesSize}px verdana`;

  const allTimeXp = xpInfo.totalXp >= 100 ? abbreviateNumber(xpInfo.totalXp) : xpInfo.totalXp,
    xpAllTimeMetrics = ctx.measureText(allTimeXp);

  ctx.fillStyle = call.client.DEFAULT_EMBED_COLOR;
  ctx.fillText(allTimeXp, 100, 840);

  ////// All Time XP Text
  const allTimeXpText = ' | ALL TIME XP';

  ctx.font = `${textSize}px verdana`;
  ctx.fillStyle = 'grey';
  ctx.fillText(allTimeXpText, 100 + xpAllTimeMetrics.width, 840);

  ////// All Time Minutes
  ctx.font = `${valuesSize}px verdana`;

  const allTimeValue = dbUser.total_minutes,
    allTimeMin = allTimeValue >= 100 ? abbreviateNumber(allTimeValue) : allTimeValue,
    allTimeMinMetrics = ctx.measureText(`${allTimeMin}`);

  ctx.fillStyle = call.client.DEFAULT_EMBED_COLOR;
  ctx.fillText(`${allTimeMin}`, 100, 1120);

  ////// All Time Minutes Text
  const allTimeMinText = ' | ALL TIME MIN';

  ctx.font = `${textSize}px verdana`;
  ctx.fillStyle = 'grey';
  ctx.fillText(allTimeMinText, 100 + allTimeMinMetrics.width, 1120);

  return canvas;
}

async function createStatsImage(chatDbUser, voiceDbUser, count) {
  const canvas = createCanvas(1800, 1000),
    ctx = canvas.getContext('2d'),
    chartCanvas = createCanvas(1700, 600),
    margin_top = 75,
    margin_left = 50;

  // Background
  ctx.fillStyle = '#1b1b1b';
  ctx.save();
  roundedRect(ctx, 0, 0, canvas.width, 700, 50);
  ctx.fill();

  // Second Background
  ctx.restore();
  roundedRect(ctx, 0, 715, canvas.width, 285, 50);
  ctx.fill();

  // Labels
  const labels_y = 50,
    labels_height = 12;

  ctx.font = '40px verdana';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = DEFAULT_EMBED_COLOR;
  roundedRect(ctx, 100, labels_y, 120, labels_height, labels_height / 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(160, labels_y + (labels_height / 2), 20, 0, Math.PI * 2, true);
  ctx.fill();

  ctx.fillStyle = '#adadad';
  ctx.textAlign = 'left';
  ctx.fillText(' Minutes | VOICE', 220, labels_y);

  ctx.fillStyle = CHAT_COLOR;
  roundedRect(ctx, 1580, labels_y, 120, labels_height, labels_height / 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(1640, labels_y + (labels_height / 2), 20, 0, Math.PI * 2, true);
  ctx.fill();

  ctx.fillStyle = '#adadad';
  ctx.textAlign = 'right';
  ctx.fillText('CHAT | Minutes ', 1580, labels_y);

  dayjs.extend(utc);
  dayjs.extend(timezone);
  dayjs.tz.setDefault('America/New_York');

  const voiceValues = voiceDbUser?.monthly_data.concat(voiceDbUser.length).reverse().slice(0, count === 'all' ? Infinity : count) ?? [],
    chatValues = chatDbUser?.monthly_data.concat(chatDbUser.daily_data).reverse().slice(0, count === 'all' ? Infinity : count) ?? [],
    averageChat = [],
    averageVoice = [],
    xAxisLabels = [],
    pointRadius = 15,
    borderWidth = 9;

  for (let i = 0; i < Math.max(voiceValues.length, chatValues.length); i++) {
    averageChat.push(chatValues.length ? chatValues.average() : 0);
    averageVoice.push(voiceValues.length ? voiceValues.average() : 0);
    xAxisLabels.push(dayjs().subtract(i, 'day').format('MMM D'));
  }

  const data = {
      labels: xAxisLabels,
      datasets: [
        {
          data: averageChat,
          borderColor: CHAT_COLOR,
          backgroundColor: CHAT_COLOR,
          pointRadius: 0,
          borderWidth: 3,
          borderDash: [10, 5],
          order: 1,
          datalabels: { labels: { title: null } }
        },
        {
          data: averageVoice,
          borderColor: DEFAULT_EMBED_COLOR,
          backgroundColor: DEFAULT_EMBED_COLOR,
          pointRadius: 0,
          borderWidth: 3,
          borderDash: [10, 5],
          order: 2,
          datalabels: { labels: { title: null } }
        },
        {
          data: chatValues,
          borderColor: CHAT_COLOR,
          backgroundColor: CHAT_COLOR,
          pointRadius,
          borderWidth,
          datalabels: { color: CHAT_COLOR, align: 'top', offset: 14, display: 'auto' },
        },
        {
          data: voiceValues,
          borderColor: DEFAULT_EMBED_COLOR,
          backgroundColor: DEFAULT_EMBED_COLOR,
          pointRadius,
          borderWidth,
          datalabels: { color: DEFAULT_EMBED_COLOR, align: 'top', offset: 14, display: 'auto' },
        },
      ],
    },

    max = Math.max(...voiceValues, ...chatValues),
    suggestedMax = !max ? 5 : (Math.ceil(max / 5) + 2) * 5;

  Chart.register(ChartDataLabels);
  new Chart(chartCanvas, {
    type: 'line',
    data,
    options: {
      responsive: false,
      animation: false,
      layout: {
        padding: {
          right: 75,
          //width: 10
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          suggestedMax,
          ticks: {
            stepSize: suggestedMax / 5,
            color: '#adadad',
            font: {
              family: 'Verdana',
              size: 35,
            },
            padding: 20,
          },
          grid: {
            drawBorder: false,
            color: (context) => {
              if (context.tick.value === 0) return '#a8a8a8';

              return '#4f4f4f';
            }
          }
        },
        x: {
          ticks: {
            autoSkip: true,
            autoSkipPadding: 20,
            color: '#adadad',
            font: {
              family: 'Verdana',
              size: 35,
            },
            padding: 20,
          },
          grid: {
            display: false,
          },
          reverse: true,
        }
      },
      plugins: {
        legend: {
          display: false
        },
        datalabels: {
          textStrokeColor: '#1b1b1b',
          textStrokeWidth: 8,
          align: 'center',
          font: {
            family: 'Verdana',
            size: 30
          },
          textAlign: 'center',
          clamp: true,
        }
      }
    }
  });

  // Stats 2nd Rectangle
  const currentChatMin = chatValues[0] ?? 0,
    currentVoiceMin = voiceValues[0] ?? 0,
    valuesSize = 100,
    textSize = 40,
    heightTop = 825,
    heightBottom = 960;

  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';

  ////// Current Voice Min
  ctx.font = `${valuesSize}px verdana`;

  const currVoiceMin = currentVoiceMin >= 100 ? abbreviateNumber(currentVoiceMin) : currentVoiceMin,
    currVoiceMinMetrics = ctx.measureText(currVoiceMin);

  ctx.fillStyle = DEFAULT_EMBED_COLOR;
  ctx.fillText(currVoiceMin, 50, heightTop);

  ////// Current Voice Min Text
  ctx.font = `${textSize}px verdana`;
  ctx.fillStyle = 'grey';
  ctx.fillText(' | VOICE MIN TODAY', 50 + currVoiceMinMetrics.width, heightTop);

  ////// Average Voice Min
  ctx.font = `${valuesSize}px verdana`;

  const aveVoice = Math.floor(averageVoice[0]),
    averageVoiceValue = aveVoice >= 100 ? abbreviateNumber(aveVoice) : aveVoice,
    averageVoiceMinMetrics = ctx.measureText(averageVoiceValue);

  ctx.fillStyle = DEFAULT_EMBED_COLOR;
  ctx.fillText(averageVoiceValue, 50, heightBottom);

  ////// Average Voice Min Text
  ctx.font = `${textSize}px verdana`;
  ctx.fillStyle = 'grey';
  ctx.fillText(' | AVERAGE VOICE MIN', 50 + averageVoiceMinMetrics.width, heightBottom);

  ////// Current Chat Min
  ctx.font = `${valuesSize}px verdana`;

  const currChatMin = currentChatMin >= 100 ? abbreviateNumber(currentChatMin) : currentChatMin,
    currChatMinMetrics = ctx.measureText(currChatMin),
    startPosChatMinutesToday = 1750 - currChatMinMetrics.width;

  ctx.fillStyle = CHAT_COLOR;
  ctx.fillText(currChatMin, startPosChatMinutesToday, heightTop);

  ////// Current Chat Min Text
  ctx.font = `${textSize}px verdana`;

  const minutesTodayText = 'CHAT MIN TODAY | ',
    minutesTodayTextMetrics = ctx.measureText(minutesTodayText);

  ctx.fillStyle = 'grey';
  ctx.fillText(minutesTodayText, startPosChatMinutesToday - minutesTodayTextMetrics.width, heightTop);

  ////// Average Chat Min
  ctx.font = `${valuesSize}px verdana`;

  const aveChat = Math.floor(averageChat[0]),
    averageChatValue = aveChat >= 100 ? abbreviateNumber(aveChat) : aveChat,
    averageChatMinMetrics = ctx.measureText(averageChatValue),
    startPosChatMinutesAverage = 1750 - averageChatMinMetrics.width;

  ctx.fillStyle = CHAT_COLOR;
  ctx.fillText(averageChatValue, startPosChatMinutesAverage, heightBottom);

  ////// average Chat Min Text
  ctx.font = `${textSize}px verdana`;

  const minutesAverageText = 'AVERAGE CHAT MIN | ',
    minutesAverageTextMetrics = ctx.measureText(minutesAverageText);

  ctx.fillStyle = 'grey';
  ctx.fillText(minutesAverageText, startPosChatMinutesAverage - minutesAverageTextMetrics.width, heightBottom);

  ctx.drawImage(chartCanvas, margin_left, margin_top);

  return { canvas };
}

module.exports = {
  createImage,
  createStatsImage
};
