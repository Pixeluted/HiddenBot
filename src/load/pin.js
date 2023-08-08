'use strict';

const { MessageEmbed } = require('discord.js');

const DEVS = ['118496586299998209'],
  allowedChannels = {
  // channel: [roles that can access the command in that channel]

    // code-discussion: Coding Helper, Lua Coding Helper
    '510573382623035408': ['528704059650342944', '528704025089146890'],
    // code-help: Coding Helper, Lua Coding Helper
    '781584867154198539': ['528704059650342944', '528704025089146890'],
    // 3d-graphics: Graphics Helper
    '719357147762262016': ['528704284460711946'],
    // 2d-graphics: Graphics Helper
    '867906733124091935': ['528704284460711946'],
    // modelling: Modelling Helper
    '719307464893399121': ['528703953026940948'],
    // building: Building Helper
    '756515537382539405': ['528703889839751178'],
    // interface: Interface Helper
    '757576733372448828': ['528704622416625688'],
    // animation: Animation Helper
    '757576922635960411': ['528704102008356907'],
    // effect: Effect Helper
    '757576882723225640': ['856580744712421378'],
    // sound: Sound Helper
    '757576808844755007': ['651818029339901962'],
    // private-testing: Full Staff Member
    '653106039247601664': ['710264519225770034'], // Testing purposes
  },
  PIN_EMOJI = '📌';

module.exports = {
  id: 'pin',
  exec: async (client) => {
    const botLogs = client.channels.cache.get(client.BOT_LOGS_CHANNEL);

    client.on('messageReactionAdd', async (reaction, user) => {
      const { message, emoji } = reaction;

      if (emoji.name !== PIN_EMOJI || !Object.keys(allowedChannels).includes(message.channel.id)) return;
  
      const member = await message.guild.members.fetch(user.id),

        allowedRoles = allowedChannels[message.channel.id];

      if (!DEVS.includes(user.id) && member.roles.cache.every((role) => !allowedRoles.includes(role.id))) return;

      const embed = new MessageEmbed().setAuthor({ name: user.tag, iconURL: user.displayAvatarURL({ dynamic: true }) }).setURL(message.url).setFooter({ text: 'Note that this action was committed by HiddenBot on behalf of a helper.' });

      try {
        if (!message.pinned) { 
          await message.pin();
          await message.reactions.cache.get(PIN_EMOJI).remove();
          
          embed.setTitle('Message Pinned');
          botLogs.send({ embeds: [embed] });
        } else if (message.pinned) {
          await message.unpin();
          await message.reactions.cache.get(PIN_EMOJI).remove();
          
          embed.setTitle('Message Unpinned');
          botLogs.send({ embeds: [embed] });
        }
      } catch (err) {
        process.emit('logBotError', err);
        message.channel.send('An error has occured. Please report this to a moderator.');
      }
    });

    client.on('messageCreate', async (message) => {
      if (message.type === 'CHANNEL_PINNED_MESSAGE' && Object.keys(allowedChannels).includes(message.channel.id)) {
        message.delete();
      }
    });
  }
};
