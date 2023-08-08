'use strict';

const { MessageEmbed } = require('discord.js');


const NUMBER_EMOJIS = ['1⃣', '2⃣', '3⃣', '4⃣', '5⃣', '6⃣', '7⃣', '8⃣', '9⃣'],
  ROLES = require('../../util/roles.json');

module.exports = {
  id: 'poll',
  desc: 'Sends a embedded message to the current channel with a title and options to select. `,poll (title):(option1), (option2), [option3],+',
  canUse: {
    users: ['118496586299998209', '577761994904698881'],
    roles: [ROLES.ADMINISTRATOR],
    cant: 'You do not have permission to run this command.',
  },
  exec: async (call) => {
    const content = call.args.join(' '),
      title = content.split(':')[0].trim();

    if (!title.trim()) return call.message.channel.send('Please rerun the command with a valid title. e.g. `!poll title: option1, option2`');

    const options = content.substring(title.length + 1).split(/\s*(?<!\\),\s*/g);

    if (options.length < 2 || options.length > 9) return call.message.channel.send('Please rerun the command with a valid amount of options (2-9). e.g. `!poll title: option1, option2`');

    const message = await call.message.channel.send(
      {
        embeds: [
          new MessageEmbed()
            .setTitle(title)
            .setDescription(options.map((option, i) => `${i + 1} - ${option}`))
            .setColor(call.client.DEFAULT_EMBED_COLOR)
        ]
      }
    );

    for (const emoji of NUMBER_EMOJIS.slice(0, options.length)) await message.react(emoji);
  },
};
