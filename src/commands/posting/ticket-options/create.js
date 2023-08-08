'use strict';

const Ticket = require('../../../util/ticket.js'),
  Infractions = require('../../../util/infractions.js'),
  { formatInfraction } = require('../../moderation/infractions.js'),
  { formatDateEmbed, formatFile } = require('../../../util/common.js'),
  { MessageEmbed } = require('discord.js'),
  Call = require('../../../handler/Call.js');

const onCooldown = {};

function removeCooldown(user) {
  const timeout = onCooldown[user.id];

  clearTimeout(timeout);

  delete onCooldown[user.id];
}

function cooldown(user) {
  onCooldown[user.id] = setTimeout(removeCooldown.bind(null, user), 600000);
}

async function ticketPrompt(category, user) {
  const call = new Call({ user, channel: await user.createDM(), client: user.client }, null, [], '', []),
    report = Ticket.isType(category),
    info = {};

  info[report ? 'Victim' : 'User'] = call.user.id;

  if (!(await call.confirmationPrompt({
    embeds: [
      new MessageEmbed()
        .setColor(user.client.DEFAULT_EMBED_COLOR)
        .setTitle('Prompt')
        .setDescription(
          `${Ticket.categoryInfo[category].info}\n\nOnce you have read and understood all the above information, please click \`Next\`.\n\nClick \`Cancel\` to cancel the prompt.`
        )
        .setFooter({ text: 'The prompt will end in 3 minutes.' })
    ],
    button1Text: 'Next',
    button2Text: 'Cancel',
    promptOptions: {
      timeout: 180000,
    },
  }))) 
    return call.user.send('Cancelled Prompt.');

  if (report) {
    const users = [];

    info.suspects = await call
      .dmPrompt(
        `Please provide the user ids of each suspect.
> You may keep sending User IDs until you reach a total of 5, or reply with \`done\` once you have provided all relevant users.
Click [here](https://support.discordapp.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID) if you do not know how to get these.`,
        {
          messages: 5,
          filter: async (m) => {
            if (m.content.toLowerCase() === 'done') {
              if (users.length) return true;

              m.correct = 'At least one user ID is necessary';

              return false;
            }

            if (!/^\d{17,}$/.test(m.content)) {
              m.correct = 'Please provide a valid user ID. User IDs are typically a string of at least 18 numbers.';

              return false;
            }

            if (users.includes(m.content)) {
              m.correct = `You have already provided the user id "${m.content}"`;

              return false;
            }

            if (!(await call.client.users.fetch(m.content).catch(() => null))) {
              m.correct = `Unable to find user "${m.content}"`;

              return false;
            }

            if ((await call.client.users.fetch(m.content).catch(() => null)).id === call.user.id) {
              m.correct = 'You may not add yourself as a suspect.';

              return false;
            }

            if (category === 'staff_report' && !(await call.client.HD.members.fetch(m.content).catch(() => null))?.roles.cache.some((r) => [call.client.FULL_STAFF_MEMBER, call.client.TRIAL_STAFF_MEMBER].includes(r.id))) {
              m.correct = `The user "${m.content}" is not a staff member.`;

              return false;
            }

            users.push(m.content);

            return true;
          },
          correct: (m) => m.correct,
          matchUntil: (m) => m.content.toLowerCase() === 'done' && users.length,
          time: 600000,
        },
        false,
        false
      )
      .then(() => users);

    const evidence = await call.dmPrompt(
      `Please specify any evidence/information you wish to include on this ticket. 
> Up to 5 HTTP(s) links/attachments are allowed and you may keep sending links/attachments until you reach that number, or reply with \`done\` once you have sent all your evidence/information.`,
      {
        messages: 5,
        filter: (m) => m.content.toLowerCase() === 'done' || m.attachments.size || call.client.ONLY_LINK_REGEX.test(m.content),
        correct: 'An invalid HTTP(s) link or no attachment was provided. If finished, reply with "done"',
        matchUntil: (m) => m.content.toLowerCase() === 'done',
        time: 600000,
      },
      false,
      false
    );

    info.evidence = evidence ? (evidence.size ? evidence.map(formatFile).join(', ') : formatFile(evidence)) : 'none';
  }

  if (category === 'appeal') {
    let infractions = Infractions.infractionsOf(call.user, call.client.HD.id);

    await infractions.ready;

    infractions = infractions.current;

    if (!infractions.length) return call.user.send('You have no infractions to appeal.');

    const infraction = await call
        .dmPrompt(
          `Please specify the ID of the infraction you are appealing. Your infractions:\n\n${infractions
            .sort((a, b) => b.date - a.date)
            .slice(0, 10)
            .map((i) => `ID: \`${i.id.toString().padStart(Infractions.ids[call.client.HD.id].toString().length)}\` Type: \`${i.type.padEnd(4)}\` Date: ${formatDateEmbed(i.date)}`)
            .join('\n')}` +
      `${infractions.length > 10 ? '\n\n> **NOTE:** Only your 10 most recent infractions have been shown. To see older infractions, please run the `/infractions check` command.' : ''}`,
          {
            correct: (m) => m.correct,
            filter: (m) => {
              if (!infractions.some((i) => m.content === i.id.toString())) {
                m.correct = 'Invalid infraction ID provided.';

                return false;
              }

              return true;
            },
          }
        )
        .then((m) => infractions.find((i) => m === i.id.toString())),
      
      index = infractions.findIndex((i) => infraction.id.toString() === i.id.toString());

    info.Infraction = await formatInfraction.bind(call.client)(infraction, index);
  }

  const issue = await call.dmPrompt('Please describe the problem you are having (maximum 1,024 characters).', { filter: 1024, time: 600000 });

  if (!report) {
    const media = await call.dmPrompt(
      `Please specify any media (i.e. images, links, etc) you wish to include on this ticket. 
> Up to 5 HTTP(s) links/attachments are allowed and you may keep sending links/attachments until you reach that number, or reply with \`done\` once you have sent all your evidence/information.`,
      {
        messages: 5,
        filter: (m) => m.content.toLowerCase() === 'done' || m.attachments.size || call.client.ONLY_LINK_REGEX.test(m.content),
        correct: 'An invalid HTTP(s) link or no attachment was provided. If finished, reply with "done"',
        matchUntil: (m) => m.content.toLowerCase() === 'done',
        time: 600000,
      },
      false,
      false
    );

    info.media = media ? (media.size ? media.map(formatFile).join(', ') : formatFile(media)) : 'none';
  }

  await Ticket.incrementId();

  const ticket = new Ticket((await Ticket.getLastId()) + 1, null, call.client, category.replace(/ /g, '_'), issue, call.user, info, false);

  if (!(await call.confirmationPrompt({ 
    content: 'Here is your ticket. If you are ready to send your ticket, click `Yes`. Otherwise, click `No`.', 
    embeds: [await ticket.embed(null, false, true)],
  }))) 
    return call.user.send('The ticket was not sent.');

  cooldown(call.user);

  ticket.send().catch((err) => {
    process.emit('logBotError', err);
    removeCooldown(call.user);
  });
}

module.exports = {
  id: 'create',
  ticketPrompt,
  exec: async (call) => {
    if (call.user.id in onCooldown)
      return call.user.send('You can only open up a ticket every 10 minutes.');

    const category = await call.dmPrompt(`What category does your ticket belong with?\n> ${Ticket.categories.map((m) => `\`${m}\``).join(', ')}`, { filter: Ticket.categories }, true);

    ticketPrompt(category, call.user);
  },
};
