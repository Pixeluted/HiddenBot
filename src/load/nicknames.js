'use strict';

const { updateNickname } = require('../commands/utility/nickname.js');

module.exports = {
  id: 'nicknames',
  exec: (client) => {
    if (!client.HD)
      return;

    client.on('guildMemberUpdate', async (oldMember, newMember) => {
      if (!oldMember.roles.cache.equals(newMember.roles.cache)) {
        // Removes emojis from people who have their corresponding emoji role removed.

        const nickname = await updateNickname(newMember);

        if (newMember.displayName !== nickname)
          newMember.setNickname(nickname);
      }
    });

    client.on('userUpdate', async (oldUser, newUser) => {
      // Revert nicknames of users trying to bypass nickname restrictions

      if (oldUser.username === newUser.username)
        return;

      const member = await client.HD.members.fetch(newUser.id).catch(() => null);

      if (!member)
        return;

      const nickname = await updateNickname(member);

      if (member.nickname !== nickname)
        member.setNickname(nickname.trim());
    });
  }
};
