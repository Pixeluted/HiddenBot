'use strict';

const prettyMs = require('pretty-ms'),
  MarketplacePost = require('../../../util/post.js'),
  { parseImage, titleCase } = require('../../../util/common.js'),
  bigPrompts = require('../../../util/multistepPrompts.js'),
  { list } = require('../../../load/timers.js');

module.exports = {
  id: 'tutor',
  exec: async (call, preview) => {
    const channel = call.client.channels.cache.get(call.client.OTHER_MARKETPLACE.tutor);

    if (!channel) return call.user.send('Failed to find the tutor channel.');

    const timer = list.find((timer) => timer.type === 'post' && timer.info.userId === call.user.id);

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
        category: 'tutor',
        type: await call
          .dmPrompt('What are you tutoring people in? Keep this short, e.g. `LUA Scripting` or `ROBLOX Building`.', { filter: 30 })
          .then((t) => titleCase(t.replace(/tutor$/i, '').trim())),
        description: await call.dmPrompt('Please specify information regarding how you tutor.'),
        payment: await call.dmPrompt('Please specify information on your pricing.\n\nExamples:\n> 5,000 Robux a lesson\n> $15 an hour'),
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
