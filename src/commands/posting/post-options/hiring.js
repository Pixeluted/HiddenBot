'use strict';

const prettyMs = require('pretty-ms'),
  MarketplacePost = require('../../../util/post.js'),
  { parseImage } = require('../../../util/common.js'),
  bigPrompts = require('../../../util/multistepPrompts.js'),
  { list } = require('../../../load/timers.js');

module.exports = {
  id: 'hiring',
  exec: async (call, preview) => {
    const options = Object.keys(call.client.HIRING_MARKETPLACE),
      category = await call.dmPrompt(
        `Please specify the category you are looking for:\n> ${options.map((m) => `\`${m}\``).join(', ')}

> **NOTE:** Please select the \`scripter\` option for Roblox programming, and the \`programmer\` option for other programming requests.`,
        { filter: options },
        true
      ),
      channel = call.client.channels.cache.get(call.client.HIRING_MARKETPLACE[category]),
      timer = list.find((timer) => timer.type === 'post' && timer.info.userId === call.user.id);

    if (timer) {
      return call.user.send(
        `Please wait \`${prettyMs(timer.time - Date.now(), {
          verbose: true,
          secondsDecimalDigits: 0,
          unitCount: 2,
        })}\` before attempting to create another post.`
      );
    }

    const post = new MarketplacePost(
      null,
      {
        channel: channel.id,
        category: 'hiring',
        type: category,
        description: await call.dmPrompt('Please specify all information regarding the desired task.', { time: 600000 }),
        payment: await bigPrompts.hirePayments(call, category),
        paymentType: await bigPrompts.getPaymentType(call),
        contact: await bigPrompts.getContacts(call),
        image: await call
          .dmPrompt(
            'Please specify any images or media you wish to include with the post. Send any images as a link or attachment. Say `skip` to if you do not desire to send any images along with your post.',
            false,
            false
          )
          .then(parseImage)
      },
      {
        authorId: call.user.id,
        status: 'confirming'
      },
      call.client,
      true
    );

    preview(call, post);
  },
};
