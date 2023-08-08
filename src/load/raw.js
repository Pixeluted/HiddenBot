'use strict';

const { MessageReaction, Message } = require('discord.js');

module.exports = {
  id: 'raw',
  exec: (client) => {
    client.on('raw', async (packet) => {
      if (packet.t === 'MESSAGE_REACTION_ADD') {
        const channel = client.channels.cache.get(packet.d.channel_id);

        if (channel && !channel.messages.cache.has(packet.d.message_id)) {
          const message = await channel.messages.fetch(packet.d.message_id),
            user = await client.users.fetch(packet.d.user_id);

          // messageReactionAdd, identical to the real event, used for emitting reactions added to messages created before startup.
          client.emit('messageReactionAdd', message.reactions.cache.get(packet.d.emoji.id || packet.d.emoji.name), user);
        }
      } else if (packet.t === 'MESSAGE_REACTION_REMOVE') {
        const channel = client.channels.cache.get(packet.d.channel_id);

        if (channel && !channel.messages.cache.has(packet.d.message_id)) {
          const message = await channel.messages.fetch(packet.d.message_id),
            user = await client.users.fetch(packet.d.user_id),
            reaction = message.reactions.cache.get(packet.d.emoji.id ?? packet.d.emoji.name) ||
							new MessageReaction(client, packet.d.emoji, 0, false);

          // messageReactionAdd, identical to the real event, used for emitting reactions added to messages created before startup.
          client.emit('messageReactionRemove', reaction, user);
        }
      } else if (packet.t === 'TYPING_START') {
        client.emit('realTypingStart', client.channels.cache.get(packet.d.channel_id), client.users.cache.get(packet.d.user_id));
      } else if (packet.t === 'MESSAGE_UPDATE') {
        if (!packet.d.author || !packet.d.guild_id)
          return;

        client.emit('rawMessageUpdate', new Message(client, packet.d, client.channels.cache.get(packet.d.channel_id)));
      }
    });
  }
};