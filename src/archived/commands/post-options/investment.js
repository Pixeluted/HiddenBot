const { RichEmbed } = require('discord.js'),
  { parseImage, parseTime } = require('../../../util/common.js'),
  bigPrompts = require('../../../util/multistepPrompts.js'),
  timeouts = require('../../../util/timeouts.js');

async function getContacts(call) { return bigPrompts.getContacts(call); }

const OPTIONS = { filter: 1000 };

module.exports = {
  id: 'investment',
  exec: async (call, preview) => {
    const channel = call.client.channels.get(call.client.INVESTMENT_CHANNEL),
      timeout = timeouts.post.find(['id', call.user.id], ['channel', channel.id]);

    if (timeout)
      return call.user.send(`Please wait ${parseTime(((timeout.date ?? Date.now()) + 18000000) - Date.now())} before attempting to post in the investment channel again.`);

    const information = await call.dmPrompt('Please specify why you need this investment and what it is for.'),
      investment = await call.dmPrompt('Please specify how much is required for this investment.', OPTIONS),
      payBack = await call.dmPrompt('Please specify what the investor will receive in return.', OPTIONS),
      contact = await getContacts(call),
      image = await call.dmPrompt('Please specify any images or media you wish to include with the post. Send any images as a link or attachment. Say `skip` to if you do not desire to send any images along with your post.', false, false)
        .then(parseImage),

      investEmbed = new RichEmbed()
        .setTitle('Investment')
        .setColor(call.client.hex)
        .setImage(image)
        .setDescription(information)
        .addField('Investment Needed', investment)
        .addField('Return', payBack);

    if (contact !== 'skip')
      investEmbed.addField('Contact', contact);

    preview(call, investEmbed, channel);
  }
};