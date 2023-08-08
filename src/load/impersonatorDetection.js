'use strict';

const { normalize } = require('./filter'),
  levenshtein = require('fast-levenshtein');

function simplify(string) {
  return normalize(string)
    .toLowerCase()
    .replace(/\s/g, '')
    .replace(/l/g, 'i');
}

function similar(str1, str2) {
  return levenshtein.get(str1, str2) <= Math.max(str1.length, str2.length) / 4 ||
		(str2.length > 3 && str1.includes(str2)) ||
		(str1.length > 3 && str2.includes(str1));
}

function detect(member, channel) {
  const user = member.user ?? member,

    detectCheck = [...member.guild.members.cache.filter((m) => m.roles.cache.has(member.client.IMPERSONATOR_ROLE)).values()];

  for (const toDetect of detectCheck) {
    toDetect.simplifedName = simplify(toDetect.user.username);
    toDetect.simplifiedDisplayName = simplify(toDetect.displayName);
  }

  user.simplifedName = simplify(user.username);

  const detected = detectCheck.find((m) => (similar(user.simplifedName, m.simplifedName) || similar(user.simplifedName, m.simplifiedDisplayName)) && m.id !== user.id);

  if (detected && channel)
    channel.send(`The account ${user} is suspiciously similar to ${detected}.`);
}

module.exports = {
  id: 'impersonatorDetection',
  exec: async (client) => {
    if (!client.HD)
      return;

    const channel = client.channels.cache.get(client.IMPERSONATOR_CHANNEL);

    client.on('guildMemberAdd', (member) => {
      if (member.guild.id === client.HD_GUILD)
        detect(member, channel);
    });

    client.on('userUpdate', async (oldUser, newUser) => {
      if (oldUser.username === newUser.username)
        return;

      const member = await client.HD.members.fetch(oldUser.id).catch(() => null);

      if (member)
        detect(member, channel);
    });
  }
};
