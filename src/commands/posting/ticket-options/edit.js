'use strict';

const Ticket = require('../../../util/ticket.js'),
  { addDots, asyncMap } = require('../../../util/common.js');

module.exports = {
  id: 'edit',
  exec: async (call) => {
    const tickets = Ticket.tickets.filter((t) => t.author?.id === call.user.id && !t.deleted);

    if (!tickets.size) return call.user.send('You have no tickets to edit.');

    let ticket = await call.dmPrompt(
      `What is the number of the ticket you want to edit?\n\n${(
        await asyncMap(tickets.filter((t) => t.id != null).values(), async (t) => `ID: \`${t.id.toString()}\` Type: \`${t.categoryName}\` Synopsis: \`${addDots(t.issue.replace(/`|\n/g, ' '), 50)}\``)
      ).join('\n')}`,
      { filter: (m) => Ticket.tickets.get(parseInt(m.content))?.author?.id === call.user.id }
    );

    ticket = Ticket.tickets.get(parseInt(ticket));

    let embed = await ticket.embed();

    const newIssue = await call.dmPrompt(
      {
        content: 'Here is your current ticket, What would you like to change the problem to? (Maximum 1024 Characters)\nRespond with `cancel` to end this prompt.',
        embeds: [embed]
      },
      { filter: 1024 }
    );

    ticket.issue = newIssue;
    embed = await ticket.embed(null, false, true);
  
    if (!(await call.confirmationPrompt({
      content: 'Here is your edited ticket. Are you sure you want to edit this ticket?, If so, click `Yes`. Otherwise, click `No`', 
      embeds: [embed],
    }))) 
      return call.user.send('The ticket was not edited.');

    await ticket.update();
    await ticket.getMessage();
		
    ticket.message
      .edit({ embeds: [embed] })
      .then(() => call.user.send({ content: 'Successfully edited your ticket.', embeds: [embed] }).catch(() => { }))
      .catch(() => call.user.send('Could not edit your ticket, please try again.'));
  },
};
