'use strict';

const Ticket = require('../../../util/ticket.js');

module.exports = {
  id: 'close',
  exec: async (call) => {
    let ticket = await call.dmPrompt('What is the number of the ticket you want to close?', {
      filter: async (m) => Ticket.tickets.get(parseInt(m.content))?.canManage(await call.client.HD?.members.fetch(call.user.id)),
    });

    ticket = Ticket.tickets.get(parseInt(ticket));

    const embed = await ticket.embed(null, false, !ticket.canManage(call.member));
    
    if (!(await call.confirmationPrompt({
      content: 'Here is the ticket you want to close. Are you sure you want to close this ticket?, If so, click `Yes`. Otherwise, click `No`', 
      embeds: [embed],
    }))) 
      return call.user.send('The ticket was not closed.');

    ticket
      .delete()
      .then(() => call.user.send({ content: 'Successfully closed your ticket.', embeds: [embed] }).catch(() => { }))
      .catch((err) => {
        call.user.send('Could not close your ticket, please try again.');

        process.emit('logBotError', err);
      });
  },
};