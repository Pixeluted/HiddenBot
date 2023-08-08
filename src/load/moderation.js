'use strict';

const timers = require('./timers.js');

module.exports = {
  id: 'unban',
  exec: async function(client) {
    // Ban removal 
    timers.on('unban', (ban) => {
      const guild = client.guilds.cache.get(ban.guild);

      if (!guild) return;

      guild.members.unban(ban.member);
    });
    
    // Mute removal
    timers.on('unmute', async (mute) => {
      const guild = client.guilds.cache.get(mute.guild);

      if (!guild) return;

      const member = await guild.members.fetch(mute.member).catch(() => null);

      if (!member) return;

      console.warn(`Removing ${member.user.username}'s mute.`);

      const role = guild.roles.cache.find(({ name }) => name.toLowerCase() === `${mute.type} mute`);

      if (role) member.roles.remove(role);
    });

    client.on('guildMemberAdd', (member) => {
      const mutes = timers.list.filter((t) => t.type === 'unmute' && t.info.member === member.id);

      for (const { info: mute } of mutes) {
        const role = member.guild.roles.cache.find(({ name }) => name.toLowerCase() === `${mute.type} mute`);

        if (role) member.roles.add(role);
      }
    });
  }
};
