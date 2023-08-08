'use strict';

const { getClient } = require('./database.js'),
  { resetVoiceDaily } = require('./voiceLevels.js'),
  userActivity = {};

const DEFAULT_COLUMNS = '"id", guild_id, daily_data, monthly_data, total_xp, total_minutes';

function createUser(userId, guildId) {
  return getClient().query('INSERT INTO public.chat_activity ("id", guild_id) VALUES ($1, $2) RETURNING "id", guild_id, daily_data, monthly_data, total_xp, total_minutes', [userId, guildId]).then((res) => res.rows[0]);
}

function getUser(userId, guildId, columns) {
  return getClient().query(`SELECT  ${columns ?? DEFAULT_COLUMNS} FROM public.chat_activity WHERE "id" = $1 AND guild_id = $2`, [userId, guildId]).then((res) => res.rows[0]);
}

function getUsers(guildId, limit, skip, columns) {
  return getClient().query(`SELECT ${columns ?? DEFAULT_COLUMNS} FROM public.chat_activity WHERE guild_id = $1 ORDER BY total_minutes DESC LIMIT ${limit} OFFSET ${skip}`, [guildId]).then((res) => res.rows);
}

// Equivelant to the following equation: https://imgur.com/a/XGrqke7
function xpForLevel(level) {
  return (5/6) * level * (2 * (level ** 2) + (level * 27) + 91);
}

function getLevelInfo(xp) {
  let level = -1,
    baseLevelXp = 0,
    nextLevelXp = 0;

  while (xp >= nextLevelXp) {
    level++;
    baseLevelXp = xpForLevel(level);
    nextLevelXp = xpForLevel(level + 1);
  }

  return {
    level,
    totalXp: xp,
    baseLevelXp,
    nextLevelXp,
    neededXp: nextLevelXp - baseLevelXp,
    currentXp: xp - baseLevelXp,
    remainingXp: Math.abs(nextLevelXp - xp)
  };
}

function deleteUserActivity(userId) {
  const activityUser = userActivity[userId];

  if (!activityUser)
    return;
  
  clearTimeout(activityUser.timeout);

  delete userActivity[userId];
}

async function updateUserStats(user, guild) {
  const dbUser = await getUser(user.id, guild.id) || await createUser(user.id, guild.id);

  deleteUserActivity(user.id);

  // Managing XP
  const gold = this.isPatreon(user.id, ['gold', 'champion']),
    silver = this.isPatreon(user.id, 'silver'),
    min = gold ? 25 : silver ? 20 : 15,
    max = gold ? 35 : silver ? 30 : 25,
    xpToAdd = Math.floor(Math.random() * (max - min + 1)) + min,
    newXpInfo = getLevelInfo(dbUser.total_xp + xpToAdd),
    member = await this.HD.members.fetch(user.id);

  await getClient().query('UPDATE public.chat_activity SET daily_data = daily_data + 1, total_minutes = total_minutes + 1, total_xp = total_xp + $3 WHERE "id" = $1 AND guild_id = $2', [user.id, guild.id, xpToAdd]);

  // Managing user's roles
  const newRole = Object.entries(this.CHAT_ACTIVITY_ROLES).reverse().find(([lvl]) => lvl <= newXpInfo.level)?.[1];

  if (!newRole || member.roles.cache.has(newRole)) return;

  const rolesToRemove =  Object.entries(this.CHAT_ACTIVITY_ROLES).filter(([lvl, roleId]) => lvl < newXpInfo.level && member.roles.cache.has(roleId)).map(([_, roleId]) => roleId);

//   member.roles.set(member.roles.cache.filter((r) => !rolesToRemove.includes(r.id)).map((r) => r.id).concat(newRole), 'Updating rank roles.');
}

async function createTimeout(user) {
  if (userActivity[user.id]) return;
  
  userActivity[user.id] = {
    timeout: setTimeout(async () => updateUserStats.bind(this)(user, this.HD), 60000),
  };
}

function resetChatDaily(client) {
  return getClient().query('UPDATE public.chat_activity SET monthly_data = array_append(monthly_data, daily_data), daily_data = 0 WHERE guild_id = $1', [client.HD.id]);
}

module.exports = {
  id: 'chat_levels',
  createUser,
  getUsers,
  getUser,
  getLevelInfo,
  exec: (client) => {
    setTimeout(async () => {
      console.log('Resetting daily chat and voice stat columns.');

      await resetChatDaily(client);
      await resetVoiceDaily(client);
    }, new Date().setUTCHours(23, 59, 59, 999) - Date.now());

    client
      .on('messageCreate', async (message) => {
        if (!message.author.bot && message.guild?.id === client.HD.id)
          createTimeout.bind(client)(message.author);
      });
  }
};
