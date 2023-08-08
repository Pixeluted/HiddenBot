const { MessageEmbed } = require('discord.js'),
  timeouts = require('../util/timeouts.js');

module.exports = {
  id: 'ad',
  exec: (client) => {
    client.on('messageReactionAdd', (reaction, user) => {
      const { message } = reaction;

      // ad delete
      if (message && message.channel.id !== client.AD_CHANNEL)
        return;

      const embed = message.embeds[0];

      if ((reaction.emoji.name === '🗑' || reaction.emoji.id === client.TRASHBIN_EMOJI_ID) && embed && embed.footer && (user.client.isMod(user.id) || embed.footer.text.endsWith(user.id))) {
        message.reason = user.client.isMod(user.id) ? 'ad mod delete' : 'ad self delete';

        // message.delete();
      } else {
        // reaction.users.remove(user);
      }
    });

    client.on('messageReactionAdd', async (reaction, user) => {
      const { message } = reaction;

      // ad approval
      if (user.bot || message.channel.id !== client.AD_APPROVAL_CHANNEL)
        return;

      const modLogs = client.channels.cache.get(client.MOD_LOGS_CHANNEL);

      if (reaction.emoji.name === '✅') {
        if (!client.channels.cache.has(client.AD_CHANNEL))
          return;

        // const m = await client.channels.cache.get(client.AD_CHANNEL).send(new MessageEmbed(message.embeds[0]).setFooter(message.embeds[0].footer.text + ` Approved by ${user.username}`));

        message.reason = 'ad approved';

        // message.delete();

        const author = client.users.cache.get(message.embeds[0].footer.text.split(': ')[1].trim());

        if (author)
          author.send(`Your advertisement was approved by ${user} (${user.tag}).`);

        const embed = new MessageEmbed()
          .setTimestamp()
          .setFooter(`Approved by ${user.id} (${user.username})`, user.displayAvatarURL())
          .setTitle('Advertisement Approved')
          .setDescription(`[**Advertisement**](${m.url})`)
          .setColor('BLUE');

        if (modLogs)
          modLogs.send(embed).catch(() => null);
      } else if (reaction.emoji.name === '❌') {
        const authorID = message.embeds[0].footer.text.split(': ')[1].trim();

        timeouts.ad.remove(authorID);

        client.channels.cache.get(client.BOT_LOGS_CHANNEL).send({
          embed: new MessageEmbed(message.embeds[0])
            .setColor('RED')
            .setTitle('Advertisement Denied')
        }).then((m) => {
          message.reason = 'ad denied';

        //   message.delete();

          const author = client.users.cache.get(authorID);

          if (author)
            author.send(`Your advertisement was denied by ${user} (${user.tag}).`);

          const embed = new MessageEmbed()
            .setTimestamp()
            .setFooter(`Denied by ${user.id} (${user.username})`, user.displayAvatarURL())
            .setTitle('Advertisement Denied')
            .setDescription(`[**Advertisement**](${m.url})`)
            .setColor('BLUE');

          if (modLogs)
            modLogs.send(embed).catch(() => null);
        });
      }
    });
  }
};
