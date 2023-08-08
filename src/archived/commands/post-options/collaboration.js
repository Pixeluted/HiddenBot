const { MessageEmbed } = require('discord.js'),
  { parseImage, parseTime } = require('../../../util/common.js'),
  bigPrompts = require('../../../util/multistepPrompts.js'),
  timeouts = require('../../../util/timeouts.js');

async function getInfo(call) { return call.dmPrompt('Please specify all information regarding the desired task.', { time: 600000 }); }
async function getContacts(call) { return bigPrompts.getContacts(call); }

module.exports = {
  id: 'collaboration',
  exec: async (call, preview) => {
    const channel = call.client.channels.cache.get(call.client.OTHER_MARKETPLACE.collaboration),
      timeout = timeouts.post.find(['id', call.user.id], ['channel', channel.id]);

    if (timeout)
      return call.user.send(`Please wait ${parseTime(((timeout.date ?? Date.now()) + 18000000) - Date.now())} before attempting to post in the ${channel.name} channel again.`);

    const information = await getInfo(call),
      contact = await getContacts(call),
      image = await call.dmPrompt('Please specify any images or media you wish to include with the post. Send any images as a link or attachment. Say `skip` to if you do not desire to send any images along with your post.', false, false)
        .then(parseImage),

      hireEmbed = new MessageEmbed()
        .setTitle('Collaboration Request')
        .setColor(call.client.hex)
        .setDescription(information);

    if (contact.toLowerCase() !== 'skip')
      hireEmbed.addField('Contact', contact);

    if (image && image.toLowerCase() !== 'skip')
      hireEmbed.setImage(image);

    preview(call, hireEmbed, channel);
  }
};
