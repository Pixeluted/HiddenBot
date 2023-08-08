'use strict';

const { MessageEmbed, Modal, MessageActionRow, TextInputComponent } = require('discord.js'),
  timers = require('../load/timers.js'),
  { ticketPrompt } = require('../commands/posting/ticket-options/create.js'),
  { getClient } = require('./database'),
  Call = require('../handler/Call.js'),
  MarketplacePost = require('../util/post.js');

const REPORT_TIMEOUT = 3600000,
  // Object keyed by post message ids and valued by an array of people who have shown interest.
  postInterests = {};

module.exports = {
  id: 'post',
  exec: (client) => {
    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isButton() || !interaction.customId.startsWith('post_'))
        return;

      const call = new Call(interaction),
        embed = new MessageEmbed(interaction.message.embeds[0]),
        postUserId = (embed.footer.text.match(/\d+/) || [])[0],
        postUser = await client.users.fetch(postUserId).catch(() => { });

      if (interaction.customId === 'post_delete') {
        if (interaction.user.id === postUserId) {
          interaction.reply({ content: 'Successfully deleted your post.', ephemeral: true });
          interaction.message.delete();
        } else if (interaction.user.client.isMod(interaction.user.id)) {
          const reasonInteraction = await call.modalPrompt(
              new Modal()
                .setCustomId('post_delete')
                .setTitle('Post Deletion Prompt')
                .addComponents(
                  new MessageActionRow().addComponents(
                    new TextInputComponent()
                      .setCustomId('post_delete_reason')
                      .setLabel('Reason')
                      .setStyle('SHORT')))),
            reason = reasonInteraction.fields.getTextInputValue('post_delete_reason');
    
          postUser?.send({
            content: `Your post has been deleted for the following reason: \`${reason || 'none provided'}\` by ${interaction.user.tag}`,
            embeds: [embed]
          });
          reasonInteraction.reply({ content: 'Successfully deleted this post.', ephemeral: true });
          interaction.message.delete();
        } else {
          interaction.reply({ content: 'You do not have permission to delete this post.', ephemeral: true });
        }
      } else if (interaction.customId === 'post_report') {
        if (timers.list.some((timer) => timer.type === 'post_report' && timer.userId === interaction.user.id))
          return interaction.reply({ content: 'Please wait before attempting to report another post.', ephemeral: true });

        timers.create('post_report', { userId: interaction.user.id }, Date.now() + REPORT_TIMEOUT, false);
        ticketPrompt('scam', interaction.user);
        interaction.deferUpdate();
      } else if (interaction.customId === 'post_show_interest') {
        if (!postUser)
          return interaction.reply({ content: 'Failed to find the user who this post was created by. They may no longer be in the server.', ephemeral: true });

        if (postUserId === interaction.user.id)
          return interaction.reply({ content: 'You cannot show interest in your own post.', ephemeral: true });
          
        if (postInterests[interaction.message.id]?.includes(interaction.user.id))
          return interaction.reply({ content: 'You have already shown your interest in this post.', ephemeral: true });

        if (postInterests[interaction.message.id])
          postInterests[interaction.message.id].push(interaction.user.id);
        else
          postInterests[interaction.message.id] = [interaction.user.id];

        interaction.message.edit({ components: MarketplacePost.makeComponents(parseInt(interaction.message.components[0].components[0].label.match(/\d+/) ?? 0) + 1) });
        interaction.reply({ content: 'Successfully shown your interest in this post.', ephemeral: true });

        const fields = await getClient().query('SELECT fields FROM public.users WHERE "user" = $1', [interaction.user.id]).then((res) => res.rows[0]?.fields ?? {});

        postUser
          .send(
            `${interaction.user} (${interaction.user.tag})${fields?.portfolio ? `, with portfolio: ${fields?.portfolio},` : ''} is interested in the following marketplace post: **<${interaction.message.url}>**
						
In order to accept this offer, please react with <:Thumbsup:${client.THUMBSUP_EMOJI_ID}>. In order to decline this offer, please react to this message with <:Thumbsdown:${client.THUMBSDOWN_EMOJI_ID}>`)
          .then((m) => m.reactMultiple([client.THUMBSUP_EMOJI_ID, client.THUMBSDOWN_EMOJI_ID]));
      }
    });

    /**
     * 7/12/2022
     * REMOVE THIS EVENTUALLY IDEALLY ~3 MONTHS     REMOVE THIS EVENTUALLY IDEALLY ~3 MONTHS
     * REMOVE THIS EVENTUALLY IDEALLY ~3 MONTHS     REMOVE THIS EVENTUALLY IDEALLY ~3 MONTHS
     * REMOVE THIS EVENTUALLY IDEALLY ~3 MONTHS     REMOVE THIS EVENTUALLY IDEALLY ~3 MONTHS
     * REMOVE THIS EVENTUALLY IDEALLY ~3 MONTHS     REMOVE THIS EVENTUALLY IDEALLY ~3 MONTHS
     * REMOVE THIS EVENTUALLY IDEALLY ~3 MONTHS     REMOVE THIS EVENTUALLY IDEALLY ~3 MONTHS
     * 7/12/2022
     */

    client.on('messageReactionAdd', async (reaction, user) => {
      const { message, emoji } = reaction;

      if (!message || user.bot || !client.ALL_MARKETPLACE.includes(message.channel.id) || !message.embeds[0]) return;

      const embed = new MessageEmbed(message.embeds[0]),
        postUser = await client.users.fetch((embed.footer.text.match(/\d+/) || [])[0]).catch(() => { });

      if ((emoji.name === '🗑' || emoji.id === client.TRASHBIN_EMOJI_ID) && embed?.footer && (user.client.isMod(user.id) || embed.footer.text.includes(user.id))) {
        message.reason = user.client.isMod(user.id) ? 'post mod delete' : 'post self delete';

        message.delete();
      } else if (emoji.name === '⭐') {
        user.send('A star emoji on a selling post means that the poster is a certified seller.');

        reaction.users.remove(user);
      } else if (emoji.id === client.WARNING_EMOJI_ID) {
        if (timers.list.some((timer) => timer.type === 'post_report' && timer.userId === user.id)) return user.send('Please wait before attempting to report another post.');

        timers.create('post_report', { userId: user.id }, Date.now() + REPORT_TIMEOUT, false);
        reaction.users.remove(user);

        ticketPrompt('scam', user);
      } else if (emoji.name === '🔍') {
        if (message.usersInterested?.includes(user.id)) return user.send('You have already shown your interest in this post.');

        if (message.usersInterested) message.usersInterested.push(user.id);
        else message.usersInterested = [user.id];

        const postUser = await client.users.fetch((embed.footer.text.match(/\d+/) || [])[0]).catch(() => { });

        if (!postUser) return user.send('Failed to find the user who this post was created by. Please report this issue in the <#669267304101707777> channel.');

        if (postUser.id === user.id) return user.send('You cannot show interest in your own post.');

        const fields = await getClient().query('SELECT fields FROM public.users WHERE "user" = $1', [user.id]).then((res) => res.rows[0]?.fields ?? {});

        postUser
          .send(
            `${user} (${user.tag})${fields?.portfolio ? `, with portfolio: ${fields?.portfolio},` : ''} is interested in the following marketplace post: **<${message.url}>**
						
In order to accept this offer, please react with <:Thumbsup:${client.THUMBSUP_EMOJI_ID}>. In order to decline this offer, please react to this message with <:Thumbsdown:${client.THUMBSDOWN_EMOJI_ID}>`,
          )
          .then((m) => m.reactMultiple([client.THUMBSUP_EMOJI_ID, client.THUMBSDOWN_EMOJI_ID]));

        user.send({ content: 'Successfully showed your interest in this post.', embeds: [message.embeds[0]] });
      } else if (emoji.name === '✏️') {

        const dm = await Call.prompt({
          message: 'What do you want to send to this user?',
          channel: user,
          user
        }).then((msg) => msg.content);

        postUser.send(
          {
            embeds: [
              new MessageEmbed()
                .setTitle('Moderator Message')
                .setDescription(dm)
                .setColor(client.DEFAULT_EMBED_COLOR)
                .setFooter({ text: `Sent by ${user.username}`, iconURL: user.displayAvatarURL() })
            ]
          }
        ).then(
          () => user.send('Successfully sent the message'),
          () => user.send('Failed to send the message')
        );
      } else {
        reaction.users.remove(user);
      }
    });
  },
};
