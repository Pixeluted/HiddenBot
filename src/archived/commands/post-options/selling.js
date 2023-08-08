const { RichEmbed } = require('discord.js'),
  { parseImage, parseTime } = require('../../../util/common.js'),
  bigPrompts = require('../../../util/multistepPrompts.js'),
  timeouts = require('../../../util/timeouts.js');


async function getContacts(call) { return bigPrompts.getContacts(call); }

module.exports = {
  id: 'selling',
  exec: async (call, preview) => {
    const channel = call.client.channels.get(call.client.MARKETPLACE.selling),
      timeout = timeouts.post.find(['id', call.user.id], ['channel', channel.id]);

    if (timeout)
      return call.user.send(`Please wait ${parseTime(((timeout.date ?? Date.now()) + 18000000) - Date.now())} before attempting to post in the selling channel again.`);

    const information = await call.dmPrompt('> **NOTE:** You may only sell assets that you have created, reselling another user\'s work as your own will result in a ban.\n\nPlease send all of information regarding what you are selling.'),
      payment = await bigPrompts.sellPayments(call),
      contact = await getContacts(call),
      image = await call.dmPrompt('Please specify any images or media you wish to include with the post. Send any images as a link or attachment. Say `skip` to if you do not desire to send any images along with your post.', false, false)
        .then(parseImage),

      sellEmbed = new RichEmbed()
        .setTitle('Selling')
        .setColor(call.client.hex)
        .setImage(image)
        .setDescription(information)
        .addField('Payment', payment);

    if (contact !== 'skip')
      sellEmbed.addField('Contact', contact);

    preview(call, sellEmbed, channel);
  }
};