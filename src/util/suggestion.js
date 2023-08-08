'use strict';

const { MessageEmbed, MessageActionRow, MessageButton, Collection } = require('discord.js'),
  timers = require('../load/timers');

function getUserFromFooter(client, text) {
  return client.users.fetch(text.match(/\((\d+)\)/)[1]);
}

async function getVoteCount(client, votes, suggester, emoji) {
  // accounting for the possibility of reaction users not being fetched and removing them and the bot from the total count of reactions
  // limitations are that you can only fetch a max of 100 users
  return (await (await votes.get(emoji).fetch())?.users.fetch()).filter((u) => u.id !== client.user.id && u.id !== suggester.id).size;
}

async function updateStats(embed, votes, suggester, client) {
  const upCount = await getVoteCount(client, votes, suggester, client.THUMBSUP_EMOJI_ID),
    downCount = await getVoteCount(client, votes, suggester, client.THUMBSDOWN_EMOJI_ID),

    upvotes = upCount !== 100 ? upCount : votes.get(client.THUMBSUP_EMOJI_ID)?.count - 1, // Subtracting 1 because the bot reacted with upvote
    downvotes = downCount !== 100 ? downCount : votes.get(client.THUMBSDOWN_EMOJI_ID)?.count - 1, // Subtracting 1 because the bot reacted with downvote
    total = downvotes + upvotes,

    // Calculated
    percUpvote = Math.round(10 * ((upvotes / total) * 100)) / 10 || 0, // the 10 * and / 10 gets the percentage to one d.p.
    percDownvote = Math.round(10 * ((downvotes / total) * 100)) / 10 || 0;

  embed.fields[0] = {
    name: 'Community Feedback',
    value: `<:Thumbsup:${client.THUMBSUP_EMOJI_ID}> Upvotes: ${upvotes} (\`${percUpvote}%\`)\n<:Thumbsdown:${client.THUMBSDOWN_EMOJI_ID}> Downvotes: ${downvotes} (\`${percDownvote}%\`)\n🔄 Total Votes: ${total}`,
  };

  return embed;
}

class Suggestion {
  static async getSuggestions(client) {
    const removeUnwanted = (m) => m.embeds?.[0]?.footer,
      mapSuggestions = async (m) => {
        const suggester = await getUserFromFooter(client, m.embeds[0].footer.text),
          patreon = client.isPatreon(suggester, 'either');
        
        m.author = suggester;
        
        return new Suggestion(m.embeds[0].description, m.embeds[0].image, m, patreon, m.channel.name.toLowerCase() === 'suggestions');
      };

    (await client.channels.cache.get(client.SUGGESTIONS_APPROVAL_CHANNEL)?.messages.fetch())
      ?.filter(removeUnwanted)
      .map(mapSuggestions);

    (await client.channels.cache.get(client.SUGGESTIONS_CHANNEL)?.messages.fetch())
      ?.filter(removeUnwanted)
      .map(mapSuggestions);
  }

  static async updateStats() {
    Suggestion.suggestions.filter((s) => s.approved).each((s) => s.updateStats());
  }

  constructor(text, image, message, patreon, approved = false) {
    Suggestion.suggestions.set(message.id, this);

    this.client = message.client;
    this.suggester = message.author;
    this.message = message;
    this.embed = this.message.embeds?.[0];
    this.patreon = patreon;
    this.text = text;
    this.image = image === 'skip' ? null : image;
    this.approved = approved;
    this.emojis = [this.client.THUMBSUP_EMOJI_ID, this.client.THUMBSDOWN_EMOJI_ID];
    this.suggestionApprovalChannel = this.client.channels.cache.get(this.client.SUGGESTIONS_APPROVAL_CHANNEL);
    this.suggestionsChannel = this.client.channels.cache.get(this.client.SUGGESTIONS_CHANNEL);
    this.suggestionsResultChannel = this.client.channels.cache.get(this.client.SUGGESTIONS_RESULTS_CHANNEL);
  }

  approve(approver) {
    this.embed.footer.text += `\nApproved by ${approver.username}`;

    this.suggestionsChannel
      .send({ embeds: [new MessageEmbed(this.embed).addField('Community Feedback', `<:Thumbsup:${this.client.THUMBSUP_EMOJI_ID}> Upvotes: 0 (\`0%\`)\n<:Thumbsdown:${this.client.THUMBSDOWN_EMOJI_ID}> Downvotes: 0 (\`0%\`)\n🔄 Total Votes: 0`)] })
      .then(async (msg) => {
        msg.reactMultiple(this.emojis);
        await this.message.delete();
        await this.suggester?.send(`Your suggestion has been approved! View it here: <${msg.url}>`);
        timers.create('removeSuggestion', { messageId: msg.id }, Date.now() + 86400000);

        this.approved = true;
        this.update(msg);
      }, () => {
        approver.send('Failed to approve the suggestion');
      });
  }

  reject(user, reason) {
    this.suggester?.send({
      content: `Your suggestion (attached below) has been declined with reason: \`${reason}\``,
      embeds: [this.embed]
    });
    user.send('The suggestion has been successfully declined.');

    this.message.delete();
    this.delete();
  }

  sendForApproval() {
    this.suggestionApprovalChannel
      .send({
        embeds: [
          new MessageEmbed()
            .setColor(this.patreon ? 'FFD700' : this.client.DEFAULT_EMBED_COLOR)
            .setTitle(`${this.patreon ? '⭐ ' : ''}Suggestion`)
            .setDescription(this.text)
            .setImage(this.image)
            .setFooter({ text: `Suggestion by ${this.suggester.username} (${this.suggester.id})`, iconURL: this.suggester.displayAvatarURL() })
        ],
        components: [
          new MessageActionRow()
            .addComponents([
              new MessageButton()
                .setCustomId('suggestion_approve')
                .setLabel('Approve')
                .setStyle('SUCCESS'),
              new MessageButton()
                .setCustomId('suggestion_deny')
                .setLabel('Deny')
                .setStyle('DANGER')
            ])
        ]
      })
      .then((m) => {
        this.embed = m.embeds[0];
        this.update(m);
      });
  }

  sendToResults() {
    this.suggestionsResultChannel.send({ embeds: [this.embed] });
    this.message.delete();
    this.delete();
  }

  async updateStats() {
    await this.message.reactMultiple(this.emojis).catch(() => null);

    const statisticalEmbed = await updateStats(this.embed, this.message.reactions.cache, this.suggester, this.client);

    this.message.edit({ embeds: [statisticalEmbed] });
  }

  delete() {
    Suggestion.suggestions.delete(this.message.id);
  }

  update(msg) {
    this.delete();
    this.message = msg;
    Suggestion.suggestions.set(this.message.id, this);
  }
}

Suggestion.suggestions = new Collection();

module.exports = Suggestion;