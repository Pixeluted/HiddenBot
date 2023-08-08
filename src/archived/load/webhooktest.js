const { WebhookClient } = require('discord.js'),

  webhook = new WebhookClient('632727185890869248', 'RdkZkepX385-FtP74lhx3eHFqHOdDKyX-287CS-ehwykOjW4ebCtrZ0VW6unXXa_55dg');

module.exports = {
  id: 'webhooktest',
  exec: (client) => {
    client.on('message', (m) => {
      if (m.author.id !== '432650511825633317' || m.channel.type !== 'dm')
        return;

      webhook.send(m.content);
    });
  }
};