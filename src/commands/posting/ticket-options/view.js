'use strict';

const Ticket = require('../../../util/ticket'),
  { asyncMap } = require('../../../util/common.js');

module.exports = {
  id: 'view',
  exec: async (call) => {
    const tickets = await asyncMap([...Ticket.tickets.filter((t) => t.authorId === call.user.id && !t.deleted).values()], (t) => t.embed(null, false, true));

    if (!tickets.length) return call.user.send('You have no open tickets.');

    call.user.send('Sending all open tickets.');

    for (const [i, ticket] of Object.entries(tickets)) {
      call.user.send({ embeds: [ticket] });

      if (i != 4) continue;

      call.user.send(`There are ${tickets.length - 5} other open tickets that have not be displayed.`);
      
      break;
    }
  },
};
