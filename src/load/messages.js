'use strict';

const { MessageEmbed } = require('discord.js');

// For sending messages on restart
const MESSAGES = [
  {
    channel: '535514713870565376',
    message: {
      embeds: [
        new MessageEmbed()
          .setColor('RED')
          .setTitle('Bot Restart')
          .setDescription(`HiddenBot has restarted. This is due to an automatic restart or a manual bot update. 
  If you were in an ongoing prompt before this restart, you will have to rerun the prompt command.`)
      ]
    }
  }
];

module.exports = {
  id: 'messages',
  exec: (client) => {
    for (let { channel, message } of MESSAGES) {
      channel = client.channels.cache.get(channel);

      if (!channel)
        continue;

      channel.send(typeof message !== 'function' ? message : message(client, channel));
    }
  }
};