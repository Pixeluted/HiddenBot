'use strict';

const { MessageEmbed } = require('discord.js'),
  timers = require('./timers'),
  Call = require('../handler/Call'),
  Suggestion = require('../util/suggestion.js');

const REFRESH_STATS_INTERVAL = 300000;
// PING_ROLE_INTERVAL = 43200000,
// PING_ROLE_ID = '865615416487706635';

module.exports = {
  id: 'suggestions',
  exec: async (client) => {
    await Suggestion.getSuggestions(client);

    timers.on('removeSuggestion', (obj) => Suggestion.suggestions.get(obj.messageId)?.sendToResults());

    // Updating statistics and mentioning of the poll ping role
    setInterval(async () => {
      Suggestion.updateStats();

      // const suggestionsChannel = client.channels.cache.get(client.SUGGESTIONS_CHANNEL),
      //   messages = (await suggestionsChannel?.messages.fetch()).filter((m) => m.content?.startsWith(`<@&${PING_ROLE_ID}>`) && m.author.bot).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
      //
      // let lastMentionTimestamp = 0;
      //
      // messages.each(async (message) => {
      //   lastMentionTimestamp = message.createdTimestamp;
      //
      //   if (Date.now() - message.createdTimestamp >= PING_ROLE_INTERVAL * 2) await message.delete();
      // });
      //
      // if (Suggestion.suggestions.filter((s) => s.approved).size <= 4) return;
      //
      // if (Date.now() - lastMentionTimestamp >= PING_ROLE_INTERVAL) suggestionsChannel.send(`<@&${PING_ROLE_ID}> Don't forget to check out these suggestions!`);
    }, REFRESH_STATS_INTERVAL);

    client
      .on('interactionCreate', async (interaction) => {
        if (!interaction.isButton())
          return;

        const { user, message } = interaction,
          suggestion = Suggestion.suggestions.get(message.id);

        if (!suggestion || user.bot || message.channel.id !== client.SUGGESTIONS_APPROVAL_CHANNEL || !interaction.customId.startsWith('suggestion_'))
          return;

        if (interaction.customId === 'suggestion_approve')
          suggestion.approve(user);
        else {
          interaction.deferUpdate();

          const reason = await Call.prompt({
            message: {
              embeds: [
                new MessageEmbed()
                  .setTitle('Prompt')
                  .setDescription( 'Please state the reason why this suggestion is being declined.\n**This will be sent to the user, you do not have to DM them.**\n\nRespond with `cancel` to end this prompt.')
                  .setColor(client.DEFAULT_EMBED_COLOR)
                  .setFooter({ text: 'This prompt will end in 3 minutes.' })
              ]
            },
            channel: user,
            user
          }).then((msg) => msg.content);

          suggestion.reject(user, reason);
        }
      })
      .on('messageReactionAdd', async (reaction, user) => {
        // If user reacts with thumbs up, removes their thumbs down reaction (if there is any), and vice versa
        if (!user.bot && reaction.message.channel.id === client.SUGGESTIONS_CHANNEL && [client.THUMBSUP_EMOJI_ID, client.THUMBSDOWN_EMOJI_ID].includes(reaction.emoji.id)) {
          if (reaction.emoji.id === client.THUMBSUP_EMOJI_ID) {
            await reaction.message.reactions.cache
              .get(client.THUMBSDOWN_EMOJI_ID)
              ?.users.remove(user)
              .catch(() => null);
          } else {
            await reaction.message.reactions.cache
              .get(client.THUMBSUP_EMOJI_ID)
              ?.users.remove(user)
              .catch(() => null);
          }
        }
      })
      .on('messageDelete', (message) => {
        const suggestion = Suggestion.suggestions.get(message.id);

        if (suggestion) suggestion.delete();
      });
  },
};
