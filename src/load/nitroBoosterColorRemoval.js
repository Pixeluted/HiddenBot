'use strict';

// For removing the nitro booster color after a user loses the nitro booster role.

module.exports = {
  id: 'nitro-booster-color-removal',
  exec: (client) => {
    client.on('guildMemberUpdate', (oldMember, newMember) => {
      if (oldMember.roles.cache.has(client.NITRO_BOOSTER) && !newMember.roles.cache.has(client.NITRO_BOOSTER))
        newMember.roles.remove('626509458457231361');
    });
  }
};