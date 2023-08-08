'use strict';

const { MessageEmbed } = require('discord.js'),
  fetch = require('node-fetch'),
  { Agent } = require('https'),
  ROLES = require('../../util/roles.json');

const CATEGORIES = ['360584952137646083', '432960534984261662'], // "Important", "Verification" --categories in main server
  OPTIONS = { // Option name: { pastebin code, array of messages that shouldn't be deleted }
    scam: { code: 'KR6NxSwQ', doNotDelete: [''] },
    marketplace: { code: '5UgDk5wL', doNotDelete: [''] },
    information: { code: '8Xv74ave', doNotDelete: [''] },
    faq: { code: 'V58nVihH', doNotDelete: ['788453962771595314', '788454041411518495', '788454283451301889', '788454508736151583', '788454960093200465'] },
    rules: { code: 'w9wvjquE', doNotDelete: [''] },
  };

module.exports = {
  id: 'update',
  desc: 'Updates the channel that\'s provided\'s content. `,update (channel) (type)`',
  channels: 'GUILD',
  canUse: {
    users: ['118496586299998209', '577761994904698881'],
    roles: [ROLES.ADMINISTRATOR, ROLES.DEPARTMENT_HEAD],
    cant: 'You do not have permission to run this command.',
  },
  exec: async (call) => {
    const channelId = call.args[0];

    if (!/\d+/.test(channelId) || !call.interaction.guild.channels.cache.has(channelId.match(/\d+/)[0]))
      return call.message.channel.send('You did not specify a valid channel to update the contents of. i.e. `,update #scam-prevention scam`');

    const channel = call.client.channels.cache.get(channelId.match(/\d+/)[0]);

    if (!CATEGORIES.includes(channel?.parentId))
      return call.message.channel.send('You did not specify a valid channel to update the contents of. Valid channels include channels with the categories of either "Verification" or "Important"');

    const option = call.args[1];

    if (!Object.keys(OPTIONS).includes(option))
      return call.message.channel.send(`You did not specify a valid option. Possible options include: ${Object.keys(OPTIONS).map((o) => `\`${o}\``).join(', ')}`);

    const agent = new Agent({ rejectUnauthorized: false });

    let rawData = await fetch(`https://pastebin.com/raw/${OPTIONS[option].code}`, { agent }).then((res) => res.text().then());

    const separators = rawData.match(/(\/\/\/)/g) ?? [''],

      embeds = [];

    let i = 0;

    do {
      i++;

      const rawDateLC = rawData.toLowerCase(),
        _title = rawDateLC.indexOf('title:'),
        _text = rawDateLC.indexOf('text:'),
        _color = rawDateLC.indexOf('color:'),
        _type = rawDateLC.indexOf('type:'),
        _separator = rawDateLC.indexOf('///'),

        title = rawData.substring(_title + 6, _text).trim() ?? '',
        text = rawData.substring(_text + 5, _color).trim() ?? '',
        color = rawData.substring(_color + 6, _type).trim() ?? '',
        type = rawData.substring(_type + 5, _separator === -1 ? undefined : _separator).trim() ?? '';

      rawData = _separator === -1 ? rawData : rawData.substring(_separator + 3);

      if (text === '') return call.message.channel.send('Text parameter cannot be empty.');

      if (text.length > 4096) return call.message.channel.send(`The text length is too high for my tiny brain to handle. Embed ${i}.`);

      if (!['everyone', 'here', 'normal', ''].includes(type)) return call.message.channel.send('An invalid type was provided. Valid types include: `everyone`, `here`');

      if (i > 1) separators.shift();

      const embed = new MessageEmbed().setDescription(text);

      if (title) embed.setTitle(title);

      if (color) embed.setColor(color);

      embeds.push({ embed, type: (type !== 'everyone' && type !== 'here') ? null : type });
    } while (separators.length > 0);
  
    (await channel.messages.fetch())
      .filter((m) => !OPTIONS[option].doNotDelete.includes(m.id))
      .each(async (m) => m.delete());

    embeds.forEach(({ embed, type }) => {
      channel.send({
        content: type ? `@${type}` : type,
        embeds: [embed],
      });
    });

    call.message.channel.send(`Successfully updated ${channel.name}.`);
  }
};
