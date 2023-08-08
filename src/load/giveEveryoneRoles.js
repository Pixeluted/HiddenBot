'use strict';

const ROLES = ['740531464730574878', '674061692673589281', '674057136572989459', '740531464730574878', '674059420833021952', '626509478807994408'];

module.exports = {
  id: 'everyone-roles',
  exec: async (client) => {
    if (!ROLES.length || !client.HD)
      return;

    let i = 0;

    // Filters users that are not verified or identified as a non roblox user, or if they already have all the roles.
    const members = client.HD.members.cache.filter((m) => (m.roles.cache.has('468146454440181770') || m.roles.cache.has('674423522101297180')) && ROLES.filter((id) => !m.roles.cache.has(id)).length > 0);

    for (const member of members.values()) {
      const filtered = ROLES.filter((id) => !member.roles.cache.has(id)),

        test = await member.roles.add(filtered).catch(() => console.log('Failed to add roles to user'));

      if (test) console.log(`Added roles to member ${++i}/${members.size}`);

      await new Promise((resolve) => setTimeout(resolve, 15000));
    }
  }
};