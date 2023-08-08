const { MessageEmbed } = require('discord.js'),
  { parseImage, parseTime } = require('../../util/common.js'),
  timeouts = require('../../util/timeouts.js');

module.exports = {
  id: 'advert',
  desc: 'Sends your ad for approval.',
  exec: async (call) => {
    const timeout = timeouts.ad.find(call.user.id);

    if (timeout)
      return call.message.channel.send(`Please wait ${parseTime((timeout + 86400000) - Date.now())} before attempting to send an advertisement again.`);

    if (call.message.channel.type !== 'dm')
      call.message.channel.send('The prompt will continue in your direct messages. If you do not receive a prompt, please check your privacy settings and try again.');

    const content = await call.prompt('What would you like the content of this advertisement to be?', { channel: call.user.dmChannel ?? await call.user.createDM() })
        .then((m) => m.content),
      image = await call.dmPrompt('Please specify any images or media you wish to include with the post. Send any images as a link or attachment. Say `skip` to if you do not desire to send any images along with your post.', false, false)
        .then(parseImage),
      approval = call.client.channels.cache.get(call.client.AD_APPROVAL_CHANNEL),
      embed = new MessageEmbed()
        .setColor(call.client.hex)
        .setImage(image)
        .setDescription(content)
        .setAuthor(call.user.tag, call.user.avatarURL())
        .setFooter(`User ID: ${call.user.id}`);

    await call.user.send('Would you like to send your advertisement? Respond with `yes` or `no`.', { embed })
      .catch(() => call.user.send('Would you like to send your advertisement? Respond with `yes` or `no`.', { embed: embed.setImage(null) }));

    const confirmation = await call.prompt(null,
      { channel: call.user.dmChannel, filter: ['yes', 'no'] })
      .then((m) => m.content.toLowerCase() === 'yes');

    if (!confirmation)
      return call.user.send('Cancelled prompt.');

    if (!approval)
      return call.message.channel.send('Failed to find the approval channel. Please contact an admin or the owner.');

    approval.send(call.user.toString(), { embed }).then(async (message) => {
      call.user.send('Successfully sent your advertisement for approval. To view the approval queue, run `,queue`.');

      for (const emoji of ['✅', '❌'])
        await message.react(emoji);

      timeouts.ad.add(call.user.id);
    }).catch(() => {
      call.user.send('Failed to send your advertisement for approval.');
    });
  }
};
