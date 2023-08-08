'use strict';

const prettyMs = require('pretty-ms'),
  MarketplacePost = require('../../../util/post.js'),
  { formatFile, parseImage } = require('../../../util/common.js'),
  bigPrompts = require('../../../util/multistepPrompts.js'),
  { list } = require('../../../load/timers.js'),
  { tags, embedTag } = require('../../information/tags.js');

module.exports = {
  id: 'hireable',
  exec: async (call, preview, postExecs) => {
    const options = Object.keys(call.client.FOR_HIRE_MARKETPLACE),
      category = await call.dmPrompt(`Please specify the category you are looking for:\n> ${options.map((m) => `\`${m}\``).join(', ')}`, { filter: options }, true);

    if (category.toLowerCase() === 'tutor' && postExecs.find((o) => o.id === category.toLowerCase())) return postExecs.find((o) => o.id === category.toLowerCase()).exec(call, preview);

    const channel = call.client.channels.cache.get(call.client.FOR_HIRE_MARKETPLACE[category]),
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

    if (
      category !== 'other'
			&& !(await call.client.HD?.members.fetch(call.user.id)).roles?.cache.some((role) => call.client.FOR_HIRE_SKILL_ROLES[category].includes(role.id))
    ) {
      return call.user
        .send({
          content: `You cannot post in this category as it requires you to have one of the following roles: ${call.client.FOR_HIRE_SKILL_ROLES[category]
            .map((r_id) => `\`${call.client.HD?.roles.cache.get(r_id)?.name}\``)
            .join(', ')}\nTo gain access to one of the above roles, you need to apply for them on our website. Below is a tag that shows you how to apply.`,
          embeds: [embedTag(call.user, tags.find((tag) => tag.name === 'apps'))]
        });
    }

    const previousWorks = await call.dmPrompt(
        `Please provide any proof of work. 
> Up to 5 HTTP(s) links are allowed and you may keep sending links until you reach that number, or reply with \`done\` once you have sent all your evidence/information.`,
        {
          messages: 5,
          filter: (m) => m.content.toLowerCase() === 'done' || call.client.ONLY_LINK_REGEX.test(m.content),
          correct: 'An invalid HTTP(s) link or no attachment was provided. If finished, reply with "done"',
          matchUntil: (m) => m.content.toLowerCase() === 'done',
          time: 600000,
        },
        false,
        false
      ),
      post = new MarketplacePost(
        null,
        {
          channel: channel.id,
          category: 'hireable',
          type: category,
          description: await call.dmPrompt('Please specify all information about your work.'),
          payment: await bigPrompts.hirePayments(call, category, false),
          paymentType: await bigPrompts.getPaymentType(call, false),
          portfolio: await call.dmPrompt('Please provide a link to your portfolio. If you do not have a portfolio, you cannot create a hiring post.', {
            filter: (m) => call.client.ONLY_LINK_REGEX.test(m.content),
            correct: 'Input must either be a link to your portfolio',
          }),
          contact: await bigPrompts.getContacts(call),
          previousWorks: previousWorks ? (previousWorks.size ? previousWorks.map(formatFile).join(', ') : formatFile(previousWorks)) : 'None provided.',
          image: await call
            .dmPrompt('Provide an image (link or attachment) to include with your post. Say `skip` to if you do not desire to include an image with your post.', false, false)
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
