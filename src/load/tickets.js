'use strict';

const Call = require('../handler/Call.js'),
  { MessageActionRow, MessageButton, ThreadChannel } = require('discord.js'),
  Ticket = require('../util/ticket.js'),
  { formatFile, formatDateEmbed } = require('../util/common.js'),
  { getClient } = require('./database.js'),
  { normalize } = require('./filter.js');

const EDITS = {
  note: {
    applicable: () => true,
    inquiry: 'Please provide the note that should be applied to the ticket.',
    exec: (ticket, _, response) => {
      ticket.info._note = response.content;
    }
  },
  evidence: {
    applicable: (ticket) => Ticket.isType(ticket.categoryName),
    inquiry: 'Please provide the additional evidence that should be applied to the ticket in HTTP(s) link or attachment format.',
    exec: (ticket, { client }, response) => {
      if (!response.attachments.size && !client.ONLY_LINK_REGEX.test(response.content))
        return 'invalid HTTP(s) link or no attachment was provided';

      if (!ticket.info.evidence || ticket.info.evidence === 'none')
        ticket.info.evidence = formatFile(response);
      else
        ticket.info.evidence += ', ' + formatFile(response);
    }
  },
  media: {
    applicable: (ticket) => !Ticket.isType(ticket.categoryName),
    inquiry: 'Please provide the additional media that should be applied to the ticket in HTTP(s) link or attachment format.',
    exec: (ticket, { client }, response) => {
      if (!response.attachments.size && !client.ONLY_LINK_REGEX.test(response.content))
        return 'invalid HTTP(s) link or no attachment was provided';

      if (!ticket.info.media || ticket.info.media === 'none')
        ticket.info.media = formatFile(response);
      else
        ticket.info.media += ', ' + formatFile(response);
    }
  },
  suspects: {
    applicable: (ticket) => Ticket.isType(ticket.categoryName),
    inquiry: 'Please provide the ID of the suspect you wish to add to this ticket.',
    exec: async (ticket, { client }, response) => {
      if (!/^\d{17,}$/.test(response.content) || !(await client.users.fetch(response.content)))
        return 'invalid user ID provided';

      if (ticket.info.suspects.includes(response.content))
        return 'provided user ID is already a suspect';

      ticket.info.suspects.push(response.content);
    }
  }
};

function formatStatus(user, ticket) {
  return `${user} - ${formatDateEmbed(Date.now())}\n${ticket.info._note ? `"${ticket.info._note}"` : ''}`;
}

async function getTicketThread(user) {
  return user.ticketThread ?? user.client.channels.cache.get(user.client.TICKET_THREAD_CHANNEL).threads.fetch(
    await getClient()
      .query('SELECT thread_id FROM public.ticket_threads WHERE user_id = $1', [user.id])
      .then((res) => res.rows[0]?.thread_id)
  ).then((t) => t instanceof ThreadChannel ? t : null, () => null);
}

async function deleteThreadMessage(user, ticket) {
  await ticket.getMessage();

  (await getTicketThread(user))
    ?.messages.fetch({ limit: 100 })
    .then((messages) => messages.find((m) => m.components[0]?.components[0].url === ticket.message.url)?.delete());
}

module.exports = {
  id: 'tickets',
  exec: async (client) => {
    await Ticket.getTickets(client);

    client.on('interactionCreate', async (interaction) => {
      if ((!interaction.isButton() && !interaction.isSelectMenu()) || !interaction.customId.startsWith('ticket_'))
        return;

      const { message, user } = interaction,
        ticket = (interaction.customId === 'ticket_reopen' ? Ticket.closedTickets : Ticket.tickets).find((t) => (t.message?.id ?? t.message) === message.id);

      if (user.bot || !ticket)
        return;

      if (!ticket.canManage(await message.guild.members.fetch(user.id).catch(() => null)) && !ticket.canManage(await client.HD?.members.fetch(user.id).catch(() => null)))
        return interaction.reply({ content: 'You do not have any of the necessary roles to moderate this ticket.', ephemeral: true });

      if (interaction.customId === 'ticket_edit') {
        const editable = Object.entries(EDITS).filter(([, edit]) => edit.applicable(ticket, user)).map(([id]) => id);

        interaction.deferUpdate();

        let edit = await Call.prompt({
          message: `Please specify which of the following portions of the ticket you wish to edit: \`${editable.join('`, `')}\``,
          channel: user,
          user,
          options: {
            filter: editable
          }
        }).then((msg) => msg.content);

        edit = EDITS[edit.toLowerCase()];

        const response = await Call.prompt({
            message: {
              content: edit.inquiry + ' Here is a copy of the ticket in it\'s current state:',
              embeds: [await ticket.embed()]
            },
            channel: user,
            user
          }),
          invalid = await edit.exec(ticket, user, response);

        if (invalid)
          return user.send(`Prompt to edit ticket failed: \`${invalid}\`. In order to try again, please react to the ticket with the ✏ emoji.`);

        ticket.info._status = formatStatus(user, ticket);
        ticket.update();

        await message.edit({ embeds: [await ticket.embed('ORANGE', true)] });

        user.send('Successfully edited the ticket.');
      } else if (interaction.customId === 'ticket_close') {
        ticket.info.closed_by = user.id;

        if (!ticket.info._closedAt)
          ticket.info._closedAt = Date.now();

        await deleteThreadMessage(user, ticket);

        ticket.delete();
        ticket.update();

        const embed = await ticket.embed('RED');

        if (ticket.author)
          ticket.author.send({ content: 'Your ticket was closed. Here is a copy of your ticket.', embeds: [embed] });
      } else if (interaction.customId === 'ticket_claim') {
        ticket.info._claimer = user.id;
        ticket.info._status = formatStatus(user, ticket);
        ticket.update();

        interaction.update({
          embeds: [await ticket.embed('ORANGE')],
          components: ticket.getComponents(),
        });

        const threadChannel = client.channels.cache.get(client.TICKET_THREAD_CHANNEL);

        user.ticketThread = await getTicketThread(user);

        if (!user.ticketThread) {
          user.ticketThread = await threadChannel.threads.create({
            name: normalize(user.username).replace(/[^\w_-]/g, ''),
            autoArchiveDuration: process.env.NODE_ENV === 'production' ? 10080 : 60,
            type: process.env.NODE_ENV === 'production' ? 'GUILD_PRIVATE_THREAD' : 'GUILD_PUBLIC_THREAD',
            reason: `${user.username}'s (${user.id}) ticket thread channel.`,
          });
          user.ticketThread.members.add(user.id);

          await getClient().query('DELETE FROM public.ticket_threads WHERE user_id = $1', [user.id]);
          getClient().query('INSERT INTO public.ticket_threads (thread_id, user_id, last_pinged) VALUES($1, $2, $3)', [user.ticketThread.id, user.id, Date.now()]);
        }

        user.ticketThread.send({
          embeds: [await ticket.embed('GREEN')],
          components: [new MessageActionRow().addComponents(new MessageButton().setLabel('Ticket Link').setURL(message.url).setStyle('LINK'))]
        });
      } else if (interaction.customId === 'ticket_unclaim') {
        ticket.info._claimer = undefined;
        ticket.info._status = undefined;
        ticket.update();

        deleteThreadMessage(user, ticket);

        interaction.update({
          embeds: [await ticket.embed()],
          components: ticket.getComponents(),
        });
      } else if (interaction.customId === 'ticket_user_id') {
        interaction.reply({ content: 'Author ID', ephemeral: true });
        interaction.followUp({ content: `${ticket.authorId}`, ephemeral: true });
        
        if (ticket.info.suspects) {
          interaction.followUp({ content: 'Suspects', ephemeral: true });
          ticket.info.suspects.forEach((s) => interaction.followUp({ content: s, ephemeral: true }));
        }
      } else if (interaction.customId === 'ticket_select_user_id') {
        interaction.reply({ content: `${interaction.values[0] || 'Command failed'}`, ephemeral: true });
      } else if (interaction.customId === 'ticket_reopen') {
        message.delete();
        ticket.send().then(() => user.send('Successfully reopened the ticket.'), () => user.send('Failed to reopen the ticket.'));
      } else if (interaction.customId === 'ticket_change_type') {
        const currCategory = ticket.categoryName,
          newCategory = interaction.values[0]?.split('-')[2];

        ticket.info._claimer = undefined;
        ticket.info._status = undefined;

        await deleteThreadMessage(user, ticket);

        ticket.changeCategory(user, currCategory, newCategory);
      }
    });
  }
};
