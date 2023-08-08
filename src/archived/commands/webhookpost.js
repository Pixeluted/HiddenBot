const PERMS = [
    // CR, Intern CR: EventsPing
    { roles: ['334511990678487050', '429114417461067778'], ping: ['621872590415462414'] },
    // CR Social Media: TwitterPing
    { roles: ['624287710911266816'], ping: ['621872601626574893'] },
    // Full Mod, Intern Mod:
    { roles: ['319327459625402369', '319479808990117888'], ping: [] },
    // Full AR, Intern AR
    { roles: ['319328357147738122', '420215565496352769'], ping: [] },
    // Full Staff: Subscriber
    { roles: ['211229509150572544'], ping: ['558038218193502209'] },
    { roles: ['632740962480816158'], ping: ['632740962480816158'] }
  ],

  rolesAllowed = [].concat.apply([], PERMS.map((p) => p.roles));

module.exports = {
  id: 'webhookpost',
  desc: 'Posts to a channel using a webhook that looks like the poster.',
  channels: 'guild',
  canUse: {
    users: ['118496586299998209'],
    roles: rolesAllowed,
    cant: 'You do not have permission to run this command.'
  },
  exec: async (call) => {
    let channel = call.args[0];

    if (!/^<#\d+>$/.test(channel))
      return call.message.channel.send('Please rerun the command and mention a valid channel. e.g. `,webhookpost #news [Subscriber] Check this out!`');

    channel = call.interaction.guild.channels.get(channel.match(/\d+/)[0]);

    if (!channel)
      return call.message.channel.send('Please rerun the command and mention a valid channel. e.g. `,webhookpost #news [Subscriber] Check this out!`');

    const content = call.cut.substring(channel.id.length + 3);

    if (!content)
      return call.message.channel.send('Please rerun the command and supply content for the webhook to post. e.g. `,webhookpost #news [Subscriber] Check this out!`.');

    const emojis = (content.match(/<a?:[a-z0-9_]+:\d+>/gi) || [])
        .map((e) => ({ id: e.match(/(?<=:)\d+(?=>)/)[0], name: e.match(/(?<=:)[a-z0-9_]+(?=:)/gi)[0] })),
      badEmojis = emojis.filter((e) => !call.interaction.guild.emojis.has(e.id));

    if (badEmojis.length) {
      const send = await call.prompt(`This guild does not have the following emoji${badEmojis.length !== 1 ? 's' : ''}: ` +
				`\`${badEmojis.map((e) => e.name).join('`, `')}\`. Would you still like to send (yes/no)?`, { filter: ['yes', 'no'] })
        .then((r) => r.content.toLowerCase() === 'yes');

      if (!send)
        return call.message.channel.send('The message was not sent.');
    }

    const webhook = await channel.createWebhook(call.member.displayName, call.user.displayAvatarURL)
      .catch((exc) => console.warn(exc.stack));

    if (!webhook)
      return call.message.channel.send('An error occurred creating the webhook.');

    const roles = [];

    if (/\[(.*?)\]/g.test(content)) {
      for (let m of content.match(/\[(.*?)\]/g)) {
        m = m.replace(/[[\]]/g, '').toLowerCase();

        const role = call.interaction.guild.roles.find((r) => r.name.toLowerCase() === m);

        if (role && PERMS.some((perm) => perm.ping.includes(role.id) && perm.roles.some((r) => call.member.roles.has(r))))
          roles.push(await role.setMentionable(true));
      }
    }

    await webhook.send(content.replace(/\[(.*?)\]/g, (m) => {
      m = m.replace(/[[\]]/g, '').toLowerCase();

      const role = call.interaction.guild.roles.find((r) => r.name.toLowerCase() === m);

      return role ? `<@&${role.id}>` : m;
    }), { files: call.message.attachments.map((att) => att.url) })
      .then(() => call.message.channel.send('Successfully sent the webhook post.'),
        () => call.message.channel.send('An error occurred requesting the webhook to send the message.'));

    for (const role of roles) {
      role.setMentionable(false);
    }

    webhook.delete();
  }
};
