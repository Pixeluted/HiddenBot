const Call = require('../handler/Call');

module.exports = {
  id: 'prompts',
  exec: (client) => {
    client.on('messageCreate', (message) => {
      const prompt = Call.prompts.find((p) => p.user.id === message.author.id && p.channel.id === message.channel.id);

      if (prompt)
        return prompt.addInput(message);
    });
  }
};