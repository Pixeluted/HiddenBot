const ROLES = [];

module.exports = {
  id: 'everyone-roles',
  exec: async (client) => {
    if (!ROLES.length)
      return;

    const HD = client.guilds.cache.get('211228845771063296');

    let i = 0;

    // Filters users that are not verified or identified as a non roblox user, or if they already have all the roles.
    const members = HD.members.cache.filter((m) => (m.roles.cache.has('468146454440181770') || m.roles.cache.has('272113245895000067')) && ROLES.filter((id) => !m.roles.cache.has(id)).length > 0);

    for (const member of members.values()) {
      const filtered = ROLES.filter((id) => !member.roles.has(id)),

        test = await member.addRoles(filtered).catch(() => console.log('Failed to add role to user'));

      if (test) console.log(`Added roles to member ${++i}/${members.size}`);

      await new Promise((resolve) => setTimeout(resolve, 15000));
    }
  }
};
