'use strict';

const { getClient } = require('./database.js');

const DEFAULT_COLUMNS = 'id, guild_id, monthly_data, total_xp, length, total_minutes, length_last_updated';

function createUser(userId, guildId) {
  return getClient().query('INSERT INTO public.voice_activity (id, guild_id) VALUES ($1, $2) RETURNING id, guild_id, monthly_data, total_xp, length, total_minutes, length_last_updated', [userId, guildId]).then((res) => res.rows[0]);
}

function getUser(userId, guildId, columns) {
  return getClient().query(`SELECT ${columns ?? DEFAULT_COLUMNS} FROM public.voice_activity WHERE id = $1 AND guild_id = $2`, [userId, guildId]).then((res) => res.rows[0]);
}

function getUsers(guildId, limit, skip, columns) {
  return getClient().query(`SELECT ${columns ?? DEFAULT_COLUMNS} FROM public.voice_activity WHERE guild_id = $1 ORDER BY total_minutes DESC LIMIT ${limit} OFFSET ${skip}`, [guildId]).then((res) => res.rows);
}

function resetLastUpdated(member) {
  return getClient().query('UPDATE public.voice_activity SET length_last_updated = 0 WHERE id = $1 AND guild_id = $2', [member.id, member.guild.id]);
}

function validVoiceState(voiceState) {
  return !!voiceState.channel && !voiceState.mute && voiceState.channel.members.size >= 2;
}

// Equivalent to the following equation: https://imgur.com/a/2eNWg9f
function xpForLevel(level) {
  return (level * (10 * (level ** 2) + (level * 35) + 155))/2;
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
    remainingXp: nextLevelXp - xp
  };
}

async function updateTimer(member) {
  const dbUser = await getUser(member.id, member.client.HD.id) || await createUser(member.id, member.client.HD.id),
    now = Date.now(),
    length = member.voiceLevelUpdated ? now - member.voiceLevelUpdated : 0;

  if (length < 60000) return;

  member.voiceLevelUpdated = now;
  
  // Managing XP and whether the user should get a new level
  const minutes = Math.floor(length / 60000),
    gold = member.client.isPatreon(member.id, ['gold', 'champion']),
    silver = member.client.isPatreon(member.id, 'silver'),
    min = gold ? 25 : silver ? 20 : 15,
    max = gold ? 35 : silver ? 30 : 25;
    
  let xpToAdd = 0;

  for (let i = 0; i < minutes; i++)
    xpToAdd += Math.floor(Math.random() * (max - min + 1)) + min;

  const newXpInfo = getLevelInfo(dbUser.total_xp + xpToAdd);

  await getClient().query('UPDATE public.voice_activity SET total_xp = total_xp + $3, length = length + $4, total_minutes = total_minutes + $4, length_last_updated = $5 WHERE id = $1 AND guild_id = $2',
    [member.id, dbUser.guild_id, xpToAdd, minutes, now]);

  // Managing user's roles
  const newRole = Object.entries(member.client.VOICE_ACTIVITY_ROLES).reverse().find(([lvl]) => lvl <= newXpInfo.level)?.[1];

  if (!newRole || member.roles.cache.has(newRole)) return;

  const rolesToRemove = Object.entries(member.client.VOICE_ACTIVITY_ROLES).filter(([lvl, roleId]) => lvl < newXpInfo.level && member.roles.cache.has(roleId)).map(([_, roleId]) => roleId);

//   member.roles.set(member.roles.cache.filter((r) => !rolesToRemove.includes(r.id)).map((r) => r.id).concat(newRole), 'Updating rank roles.');
}

async function startUpdate(member, lastUpdated) {
  if (!member.voice || member.voiceLevelInterval)
    return;

  member.voiceLevelUpdated = lastUpdated || Date.now();
  member.voiceLevelInterval = setInterval(() => updateTimer(member), 120000);
}

async function stopUpdate(member) {
  if (!member.voiceLevelInterval)
    return;

  await resetLastUpdated(member);

  updateTimer(member);
  clearInterval(member.voiceLevelInterval);

  member.voiceLevelUpdated = null;
  member.voiceLevelInterval = null;
}

function resetVoiceDaily(client) {
  return getClient().query('UPDATE public.voice_activity SET monthly_data = array_append(monthly_data, length), length = 0 WHERE guild_id = $1', [client.HD.id]);
}

module.exports = {
  id: 'voice-levels',
  createUser,
  getUsers,
  getUser,
  getLevelInfo,
  resetVoiceDaily,
  exec: async (client) => {
    // Checks for those who were in vc prior to bot going down, and whether they are still in the vc when the bot comes back online
    const usersBeforeDowntime = await getClient()
      .query('SELECT "id", "length_last_updated" FROM public.voice_activity WHERE length_last_updated != 0')
      .then((res) => res.rows);

    for (const userDb of usersBeforeDowntime) {
      const member = await client.HD.members.fetch(userDb.id).catch(() => null);

      if (!member) {
        resetLastUpdated({ 
          id: userDb.id,
          guild: {
            id: client.HD.id
          } 
        });

        continue;
      }

      if (member.voice.channel) 
        startUpdate(member, userDb.length_last_updated);
      else
        resetLastUpdated(member);
    }

    for (const voiceState of client.HD.voiceStates.cache.filter(validVoiceState).values())
      startUpdate(voiceState.member);

    client
      .on('voiceStateUpdate', async (oldState, newState) => {
        if (newState.member.user.bot || newState.guild?.id !== client.HD.id) return;

        if (validVoiceState(newState))
          for (const member of newState.channel.members.filter((m) => !m.voice.mute).values()) 
            startUpdate(member);
        else
          stopUpdate(newState.member);

        // If user leaves voice call and there was one other member in the voice call.
        if (oldState.channel?.members.size === 1)
          stopUpdate(oldState.channel.members.first());
      })
      .on('guildMemberAdd', async (member) => {
        const userDb = await getUser(member.id, client.HD.id);

        if (!userDb) return;
        
        const role = Object.entries(member.client.VOICE_ACTIVITY_ROLES).reverse().find(([lvl]) => lvl <= getLevelInfo(userDb.total_xp)?.level)?.[1];

        if (role) 
          member.roles.add(role);
      });
  }
};
