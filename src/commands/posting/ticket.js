'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders'),
  fs = require('fs');

const options = fs.readdirSync(`${__dirname}/ticket-options`).map((name) => {
    try {
      return require(`./ticket-options/${name}`);
    } catch (err) {
      process.emit('logBotError', err);
    }
  }).filter((o) => o != null),
  filter = options.map((opt) => opt.id);

module.exports = {
  useAnywhere: false,
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Starts a prompt to create a ticket.'),
  exec: async function(call) {
	return call.interaction.reply({ content: "This command has been disabled. Go to <#535514713870565376> and run the command there.", ephemeral: true });
	
    const member = await call.client.HD?.members.fetch(call.user.id).catch(() => null);

    if (!member)
      return call.interaction.reply({ content: 'You cannot use this command as you are not in the Hidden Developers server.', ephemeral: true });

    try {
      await call.user.createDM();

      call.interaction.reply({ content: 'The prompt will continue in your direct messages.', ephemeral: true });

      var type = await call.dmPrompt(`Would you like to create a ticket, close a ticket, edit a ticket, move a ticket, or view your ticket(s)?\n> \`${filter.join('`, `')}\``, { filter }, true);
    } catch (err) {
      if (err.message === 'Prompt ended: trigger message failed to send')
        return call.interaction.editReply('Failed to direct message you. Please check your privacy settings and try again.');

      return;
    }

    call.member = member;

    try {
      await options.find((o) => o.id === type.toLowerCase()).exec(call);
    } catch (err) {
      if (err.message.endsWith('time') || err.message.endsWith('cancelled'))
        return;

      process.emit('logBotError', err);
      call.user.send('An error occurred with the prompt. Please report this issue in the <#669267304101707777> channel.');
    }
  }
};
