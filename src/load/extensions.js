'use strict';

const { Message, Collection, Guild, CommandInteraction } = require('discord.js'),
  { SlashCommandBuilder, SlashCommandSubcommandBuilder } = require('@discordjs/builders'),
  { default: fetch } = require('node-fetch'),
  constants = require('../util/constants.js');

// Server role IDs
const FULL_MOD = '211229509150572544',
  INTERN_MOD = '319479808990117888',
  MARKETPLACE_MUTE = '493940571023605775',
  POLL_MUTE = '865733315764289596', // '865612945786667061';
  MODS = ['319327459625402369', '394532546542567424', '211229166861942784'],
  ASSISTANT = '345964577307230208',
  INTERN = '443556382286020612',
  // User IDs
  SOLO = '118496586299998209',
  DEVS = ['118496586299998209'];

module.exports = {
  id: 'extensions',
  prepend: true,
  exec: (client) => {
    // PROPERTIES

    Object.assign(client, constants);

    client.prefix = ',';
    client.paginations = new Collection();
    client.HD = client.guilds.cache.get('211228845771063296') || client.guilds.cache.get('652673441761067028');
    client.ownerId = SOLO;
    client.blacklistedUsers = [];
    client.prompts = [];
    client.whitelistDisabled = false;

    // <Guild>.messages property

    client.on('messageCreate', (message) => {
      if (!message.channel.guild)
        return;

      if (message.guild.messages)
        message.guild._messages.set(message.id, message);
      else
        message.guild._messages = new Collection([[message.id, message]]);
    });

    Object.defineProperty(Guild.prototype, 'messages', {
      get: function() {
        if (!this._messages)
          this._messages = new Collection();

        return this._messages;
      }
    });

    Array.prototype.average = function() {
      return this.reduce((a, b) => a + b) / this.length;
    };

    if (client.HD && client.HD.id === '211228845771063296')
      fetch(
        `https://hiddendevs.com/api/discordbot?key=${process.env.OUTWARDS_API_KEY}&action=membercount&value={"day":"${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()]
        }","amount":"${client.HD.memberCount}"}`
      );

    // FUNCTIONS

    client.getRobloxNameFromId = function(id) {
      return fetch(`https://api.roblox.com/users/${id}`)
        .then((res) => res.json())
        .then((res) => res.Username)
        .catch(() => null);
    };

    client.getMessageFromLink = async function(link) {
      if (!constants.MESSAGE_LINK_REGEX.test(link)) return null;

      const [, , channel, message] = link.match(constants.MESSAGE_LINK_REGEX);

      return (
        client.channels.cache
          .get(channel)
          ?.messages.fetch(message)
          .catch(() => null) || null
      );
    };

    client.getAllMembers = function() {
      return client.guilds.cache.reduce((a, b) => a.concat(b.members.cache), new Collection());
    };

    client.prompts.remove = function(user) {
      const index = this.indexOf(user);

      if (index > -1) this.splice(index, 1);
    };

    client.cantPost = function(call, member) {
      if (!client.HD || process.env.NODE_ENV !== 'production') return false;

      member = client.HD.members.cache.get(member.id ?? member);

      const notEligible = Date.now() - member.joinedTimestamp < 600000,
        muted = member.roles.cache.has(MARKETPLACE_MUTE);

      if (!member.roles.cache.has(constants.DISCORD_VERIFIED))
        return call.interaction.reply({ content: 'You must be verified to use our marketplace. Please view <#678252217681051669> for more instructions.', ephemeral: true });

      if (notEligible || muted)
        return call.interaction.reply({ content: `You are not allowed to use this command. ${notEligible ? 'You must be in the server for at least ten minutes & be verified' : 'You are currently banned from the marketplace'}.`, ephemeral: true });
    };

    // client.cantSuggest = (call, member) => {
    //   // if (!client.HD || process.env.NODE_ENV !== 'production') return false;
    //
    //   member = client.HD.members.cache.get(member.id ?? member);
    //
    //   const notEligible = Date.now() - member.joinedTimestamp < 600000,
    //     muted = member.roles.cache.has(POLL_MUTE);
    //
    //   if (!member.roles.cache.has(constants.DISCORD_VERIFIED))
    //     return call.interaction.reply({ content: 'You must be verified to suggest new features.', ephemeral: true });
    //
    //   if (notEligible || muted)
    //     return call.interaction.reply({ content: `You are not allowed to use this command. ${notEligible ? 'You must be in the server for at least ten minutes & be verified' : 'You are currently banned from suggesting new features'}.`, ephemeral: true });
    // };

    client._fetchUser = function(call, param, r = false) {
      return new Promise(async (resolve, reject) => {
        if (!param) return r ? reject(new TypeError('Invalid User')) : resolve(null);

        let user = await client.users.fetch(param.replace(/\D+/g, '')).catch(() => null)
					?? client.users.cache.find((u) => u.username?.toLowerCase() === param.toLowerCase());

        const member = !user && call?.message.guild?.members.cache.find((u) => u.displayName.toLowerCase() === param.toLowerCase());

        user = member?.user ?? user;

        if (user) resolve(user);
        else if (r) reject(new TypeError('Invalid User'));
        else resolve(null);
      });
    };

    client.isTicketAdmin = function(member) {
      member = member.id ?? member;

      return DEVS.includes(member) || MODS.some((role) => this.HD.members.cache.get(member).roles.cache.has(role));
    };

    client.isMod = function(member) {
      member = member.id ?? member;

      return DEVS.includes(member) || this.HD.members.cache.get(member)?.roles.cache.has(FULL_MOD) || this.HD.members.cache.get(member)?.roles.cache.has(INTERN_MOD);
    };

    client.isIntern = function(member) {
      member = member.id ?? member;

      return DEVS.includes(member) || this.HD.members.cache.get(member)?.roles.cache.has(INTERN) || this.HD.members.cache.get(member)?.roles.cache.has(ASSISTANT);
    };

    client.isPatreon = function(member, type = 'either') {
      member = member.id ?? member;

      return (
        DEVS.includes(member) ||
        ((type === 'either' || type === 'silver' || type.includes('silver')) && this.HD.members.cache.get(member)?.roles.cache.has(this.DISCORD_SILVER)) ||
        ((type === 'either' || type === 'gold' || type.includes('gold')) && this.HD.members.cache.get(member)?.roles.cache.some((r) => [this.PATREON_STANDARD, this.DISCORD_GOLD].includes(r.id))) ||
				((type === 'either' || type === 'champion' || type.includes('champion')) && this.HD.members.cache.get(member)?.roles.cache.some((r) => [this.PATREON_PREMIUM, this.DISCORD_CHAMPION].includes(r.id)))
      );
    };

    Message.prototype.reactMultiple = async function(reactions) {
      for (const reaction of reactions) if (reaction) await this.react(reaction);

      return this;
    };

    CommandInteraction.prototype.safeReply = function(...args) {
      if (this.deferred)
        return this.editReply(...args);
      else if (this.replied)
        return this.followUp(...args);
      else
        return this.reply(...args);
    };

    const messageDelete = Message.prototype.delete;

    Message.prototype.delete = function(...args) {
      if (!this.reason) this.reason = 'HiddenBot message delete';

      return messageDelete.bind(this)(...args);
    };

    SlashCommandBuilder.prototype.addAutocompleteUserOption = function(name, description, required) {
      this.addStringOption((option) =>
        option.setName(name)
          .setDescription(description)
          .setRequired(required)
          .setAutocomplete(true));

      return this;
    };

    SlashCommandSubcommandBuilder.prototype.addAutocompleteUserOption = function(name, description, required) {
      this.addStringOption((option) =>
        option.setName(name)
          .setDescription(description)
          .setRequired(required)
          .setAutocomplete(true));

      return this;
    };
  },
};
