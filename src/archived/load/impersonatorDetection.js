const { RichEmbed } = require('discord.js'),
  { normalize } = require('./filter'),
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
  const user = member.user || member,

    detectCheck = member.guild.members.filter((m) => m.roles.has(member.client.IMPERSONATOR_ROLE)).array();

  for (const toDetect of detectCheck) {
    toDetect.simplifedName = simplify(toDetect.user.username);
    toDetect.simplifiedDisplayName = simplify(toDetect.displayName);
  }

  user.simplifedName = simplify(user.username);

  const detected = detectCheck.filter((m) => (similar(user.simplifedName, m.simplifedName) || similar(user.simplifedName, m.simplifiedDisplayName)) && m.id !== user.id);

  if (detected.length > 0) {
    const embed = new RichEmbed()
      .setColor('BLUE')
      .setThumbnail(detected[0].displayAvatarURL)
      .setAuthor('Potential Impersonator')
      .addField('Impersonator', `${member} ${member.user.tag}`);

    if (detected.length === 1)
      embed.addField('User Affected', `${detected[0]} ${detected[0].user.tag}`);
    else
      embed.addField('Users Affected', detected.map((m) => `${m} ${m.user.tag}`).join(', '));

    if (channel)
      channel.send(user.toString() + '\n' + detected.map((m) => m.toString()).join(', '), { embed })
        .then((m) => m.reactMultiple(['542767733675393034', '❌']));
  }
}

module.exports = {
  id: 'impersonatorDetection',
  exec: async (client) => {
    if (!client.HD)
      return;

    const channel = client.channels.get(client.IMPERSONATOR_CHANNEL),
      modLogs = client.channels.get(client.MOD_LOGS_CHANNEL);

    client.on('guildMemberAdd', (member) => {
      if (member.guild.id === client.HD_GUILD)
        detect(member, channel);
    });

    client.on('userUpdate', (oldUser, newUser) => {
      const member = client.HD.member(oldUser.id);

      if (member && oldUser.username !== newUser.username)
        detect(member, channel);
    });

    client.on('messageReactionAdd', async (messageReaction, user) => {
      if (messageReaction.message.channel.id !== client.IMPERSONATOR_CHANNEL || user.bot)
        return;

      if (messageReaction.emoji.name === '❌') {
        messageReaction.message.delete();
      } else if (messageReaction.emoji.id === '542767733675393034') {
        const toBan = await client._fetchUser(messageReaction.message.embeds[0].fields[0].value.match(/\d+/)[0]);

        if (!toBan)
          return;

        client.HD.ban(toBan, `Banned by ${user.username} for impersonator detection`)
          .then(() => {
            messageReaction.message.delete().catch(() => { });

            modLogs.send(
              new RichEmbed()
                .setTimestamp()
                .setColor('RED')
                .setAuthor(`${toBan.username} Banned`, toBan.displayAvatarURL)
                .addField('Target', toBan.toString(), true)
                .addField('Moderator', user.toString(), true)
                .addField('Reason', 'Impersonator.')
            ).catch(() => { });
          }, () => { });
      }
    });
  }
};
