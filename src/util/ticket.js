'use strict';

const { MessageEmbed, Collection, Message, MessageActionRow, MessageButton, GuildMember, MessageSelectMenu } = require('discord.js'),
  { getClient } = require('../load/database.js'),
  { asyncMap, correctGrammar } = require('./common.js'),
  constants = require('../util/constants.js');

function ifLocal(local, production) {
  return process.env.NODE_ENV === 'production' ? production : local;
}

function titleCase(str) {
  return str.replace(/_/g, ' ').replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

async function formatValue(client, val) {
  if ((typeof val === 'string' && /^\d+$/.test(val)) || (Array.isArray(val) && val.every((id) => /^\d+$/.test(id)))) {
    val = await asyncMap(Array.isArray(val) ? val : [val], async (id) => {
      const user = await client.users.fetch(id).catch(() => { });

      if (user) return `${user} (${user.tag})`;
    }).then((arr) => arr.filter((u) => u).join('\n'));
  }

  return val.toString();
}

const TEST_GUILD_TICKET_ROLE = '744447726376190042',
  ALL_STAFF = ['211229509150572544', '488121290880974848'],
  ADMIN = ['534790670234419211', '211229166861942784', '488147987340722196'],
  LEAD_MODERATOR = ['605855715902357535', '488427574012149780'],
  SCAM_INVESTIGATOR = ['539152555557650432', '534791872389054466', '655841344715096104', '655841048257495073', '655004812324372490', '655841048257495073'],
  SENIOR_MODERATOR = ['394532546542567424', '488197484984795157'],
  MODERATOR = ['319327459625402369', '488136652909445121'],
  APPLICATION_READER = ['319328357147738122', '707139104885964802', '735947738000261220', '605855708768108564'],
  REPRESENTATIVE = ['334511990678487050', '501484302941552660', '735947741422813224', '605855650940977152'],
  DEPARTMENT_HEADS = ['654980555850645541', '605855650940977152', '706159545063440444', '605855715902357535', '605855708768108564'],

  /* eslint-disable max-len */
  CATEGORIES = {
    scam: {
      channel: ifLocal('724713720399265843', '749807604737507469'),
      roles: [TEST_GUILD_TICKET_ROLE, ...ADMIN, ...SCAM_INVESTIGATOR],
      info: '**Scam Report Ticket:**\n- Carefully read the following information.\n- Your Ticket will be sent to a Scam Investigator to be reviewed.\n- Your ticket may take up to a month to be reviewed, we typically have a large backlog of tickets before yours that we are already handling. Please be extremely patient.\n- You MUST follow the format below when submitting your Ticket.\n- You will be asked one question at a time and should respond with your answer.\n- If you do not respond within 10 minutes your prompt will be cancelled.\n- Provide as much information as possible, proof of payment, proof of the agreement between you and the other individual, a clear understanding of how the user has scammed you.\n- Scam Reports take a HUGE amount of our time, we need to wait for users to respond to us when requesting additional information. Help us by responding AS SOON AS POSSIBLE and make the details clear and simple to understand.\n- If you take longer than 24 hours to respond to a Scam Investigator when asked for more details to support your ticket, your ticket will be closed.\n\n**Breakdown of the following sections:**\n1. Provide the User ID of the Users that you want to report\n2. Description of how this user scammed you/is a scammer\n3. Provide supporting evidence (REQUIRED!)\n4. Preview Ticket and Confirmation',
    },
    appeal: {
      channel: ifLocal('724713629164896276', '718262654858166345'),
      roles: [TEST_GUILD_TICKET_ROLE, ...ADMIN, ...MODERATOR, ...SENIOR_MODERATOR, ...LEAD_MODERATOR],
      info: '**Appeal Ticket:**\n- Carefully read the following information.\n- Your Ticket will be sent to a Moderator to be reviewed.\n- Your ticket may take up to 48 hours to be reviewed.\n- You MUST follow the format below when submitting your Ticket.\n- You will be asked one question at a time and should respond with your answer.\n- If you do not respond within 10 minutes your prompt will be cancelled.\n\n**Breakdown of the following sections:**\n1. Select the infraction you want to appeal\n2. Why should your appeal be accepted\n3. Provide supporting evidence\n4. Preview Ticket and Confirmation',
    },
    verification: {
      channel: ifLocal('919994296575332423', '920024399145476116'),
      roles: [TEST_GUILD_TICKET_ROLE, ...ADMIN, ...REPRESENTATIVE, '621840529700814890'],
      info: '**Verification Ticket:**\n- Carefully read the following information.\n- Your ticket may take up to 48 hours to be reviewed.\n- You MUST follow the format below when submitting your Ticket.\n- You will be asked one question at a time and should respond with your answer.\n- If you do not respond within 10 minutes your prompt will be cancelled.\n- **We cannot and will not verify you if your account was disabled because of a Discord ban.** \n\n*To expedite your ticket* \n- Include in the evidence section a video of your roblox profile (with a refresh) or some other valid form of account ownership. \n\n**Breakdown of the following sections:**\n1. Explain your problem\n2. Supporting evidence\n3. Preview Ticket and Confirmation',
    },
    general: {
      channel: ifLocal('772549168165814312', '718261126701252688'),
      roles: [TEST_GUILD_TICKET_ROLE, ...ADMIN, ...ALL_STAFF, '429114417461067778'], // Trial Reps
      info: '**General Ticket:**\n- Carefully read the following information.\n- Your ticket may take up to 48 hours to be reviewed.\n- You MUST follow the format below when submitting your Ticket.\n- You will be asked one question at a time and should respond with your answer.\n- If you do not respond within 10 minutes your prompt will be cancelled.\n\n**Breakdown of the following sections:**\n1. Explain your problem\n2. Supporting evidence\n3. Preview Ticket and Confirmation',
    },
    application: {
      channel: ifLocal('868466410706329601', '868481120390479882'),
      roles: [TEST_GUILD_TICKET_ROLE, ...ADMIN, ...APPLICATION_READER],
      info: '**Application Ticket:**\n- Carefully read the following information.\n- Your ticket may take up to 48 hours to be reviewed.\n- You MUST follow the format below when submitting your Ticket.\n- You will be asked one question at a time and should respond with your answer.\n- If you do not respond within 10 minutes your prompt will be cancelled.\n\n**Breakdown of the following sections:**\n1. Explain your problem\n2. Supporting evidence\n3. Preview Ticket and Confirmation',
    },
    user_report: {
      channel: ifLocal('724713674232561714', '749807554921627718'),
      roles: [TEST_GUILD_TICKET_ROLE, ...ADMIN, ...MODERATOR, ...SENIOR_MODERATOR, ...LEAD_MODERATOR],
      info: '**User Report Ticket:**\n- Carefully read the following information.\n- Your Ticket will be sent to a Moderator to be reviewed.\n- Your ticket may take up to 48 hours to be reviewed.\n- You MUST follow the format below when submitting your Ticket.\n- You will be asked one question at a time and should respond with your answer.\n- If you do not respond within 10 minutes your prompt will be cancelled.\n\n**Breakdown of the following sections:**\n1. Provide the User ID of the user that you want to report\n2. Explain why you\'re reporting this user\n3. Provide supporting evidence\n4. Preview Ticket and Confirmation',
      logChannel: '771397278753357884',
    },
    staff_report: {
      channel: ifLocal('724713692423520427', '718262745065324594'),
      roles: [TEST_GUILD_TICKET_ROLE, ...ADMIN, ...DEPARTMENT_HEADS],
      info: '**Staff Report Ticket:**\n- Carefully read the following information.\n- Your Ticket will be sent to the Staff Member\'s Department Head to be reviewed.\n- Your ticket may take up to 72 hours to be reviewed.\n- You MUST follow the format below when submitting your Ticket.\n- You will be asked one question at a time and should respond with your answer.\n- If you do not respond within 10 minutes your prompt will be cancelled.\n\n**Breakdown of the following sections:**\n1. Provide the User ID of the Staff Member that you want to report\n2. Explain why you\'re reporting this Member of Staff\n3. Provide supporting evidence\n4. Preview Ticket and Confirmation',
      logChannel: '804750838143909988',
    },
  };
/* eslint-enable max-len */

/**
 * @typedef {'scam'|'appeal'|'verification'|'general'|'application'|'user_report'|'staff_report'} TicketCategory
 * @typedef {'report'|'general'} TicketType
 * @typedef {'scam'|'marketplace'} QuotaCategory
 */
class Ticket {
  /**
   * Fetches all tickets from the database and creates Ticket instances.
   * @param {Client} discordClient 
   * @returns {Promise<Ticket[]>}
   */
  static getTickets(discordClient) {
    return getClient()
      .query('SELECT "id", "message", "type", issue, author, "info", "deleted" FROM public.tickets')
      .then((res) => res.rows.map((t) => new Ticket(t.id, t.message, discordClient, t.type, t.issue, t.author, t.info, true, t.deleted)));
  }

  /**
   * Increments the ID referenced when generating tickets in the provided guild.
   * @param {import('discord.js').Guild} guild 
   * @returns {Promise<import('pg').QueryResult>}
   */
  static incrementId(guild = '211228845771063296') {
    return getClient().query('UPDATE public.last_ids SET ticket_id = ticket_id + 1 WHERE guild = $1', [guild]);
  }

  /**
   * Fetches the last ticket ID in the provided guild.
   * @param {import('discord.js').Guild} guild 
   * @returns {Promise<number>}
   */
  static getLastId(guild = '211228845771063296') {
    return getClient().query('SELECT ticket_id FROM public.last_ids WHERE guild = $1', [guild]).then((res) => res.rows[0].ticket_id);
  }

  /**
   * Returns whether the provided member is able to manage tickets in the provided category.
   * @param {TicketCategory} category 
   * @param {GuildMember} member 
   * @returns {boolean}
   */
  static isManager(category, member) {
    return member.roles.cache.some((r) => CATEGORIES[category].roles.includes(r.id));
  }

  /**
   * Returns whether or not the category is of the provided type.
   * @param {TicketCategory} category 
   * @param {TicketType} type 
   * @returns {boolean}
   */
  static isType(category, type = 'report') {
    return Ticket[type === 'report' ? 'reportCategories' : 'generalCategories'].includes(category.toLowerCase());
  }

  /**
   * Gets the ticket quota that the provided member needs to get weekly.
   * @param {GuildMember} member 
   * @param {QuotaCategory} category 
   * @returns {number}
   */
  static getManagedQuota(member, category) {
    if (!(member instanceof GuildMember))
      throw new TypeError('Parameter "member" is not an instance of "DiscordJS.GuildMember"');

    return Object.entries(Ticket.QUOTAS[category]).find(([id]) => member.roles.cache.has(id))?.[1] ?? 0;
  }

  /**
   * Gets the tickets that a user has closed in the provided timeframe in the provided category.
   * @param {import('discord.js').Snowflake} userId 
   * @param {TicketCategory} category 
   * @param {number} startDate 
   * @param {number} endDate 
   * @returns {Ticket[]}
   */
  static getManaged(userId, category, startDate, endDate) {
    return Ticket.closedTickets
      .filter((ticket) => {
        const date = ticket.info._closedAt ?? ticket.info._lastUpdated;

        return ticket.categoryName === category
          && ticket.info.closed_by === userId
          && date > startDate
          && date < endDate;
      });
  }

  /**
   * Represents a Ticket.
   */
  constructor(id, message, client, category, issue, author, info, stored, deleted = false) {
    if (typeof id !== 'number') throw new TypeError('First parameter (id) is not a number.');

    (deleted ? Ticket.closedTickets : Ticket.tickets).set(id, this);

    this.id = id;
    this.message = message;
    this.client = client;
    this.categoryName = category;
    this.category = CATEGORIES[category];
    this.issue = issue;
    this.author = this.client.users.cache.get(author.id ?? author);
    this.authorId = this.author?.id ?? author;
    this.info = info;
    this.stored = stored;
    this.deleted = deleted;

    this.load().catch((err) => process.emit('logBotError', err));
  }

  /**
   * Whether or not the provided member can manage this ticket.
   * @param {GuildMember} member 
   * @returns {boolean}
   */
  canManage(member) {
    return (!!member && member.id === this.author?.id) || Ticket.isManager(this.categoryName, member);
  }

  /**
   * Loads this ticket.
   * @returns {void}
   */
  async load() {
    if (!this.info._lastUpdated) {
      this.info._lastUpdated = Date.now();

      await this.update();
    }

    // Changes the color of the ticket embed to red once/if it has been 24 hours since the ticket has last been updated.
    const time = 86400000 + this.info._lastUpdated - Date.now();

    if (!this.deleted && time > 0) {
      setTimeout(async () => {
        if (this.deleted) return;

        await this.getMessage();

        if (this.message instanceof Message) this.message.edit({ embeds: [await this.embed('RED')] });

        if (this.info._claimer)
          this.client.users.fetch(this.info._claimer)
            .then((u) => u.send({ content: `**Ticket #${this.id}**\nYour claimed ticket is overdue.\n<${this.message.url}>`, embeds: [this.embed()] }));
      }, time);
    }
  }

  /**
   * Fetches the message of this tikcet.
   * @returns {Promise<Message>}
   */
  async getMessage() {
    if (this.message instanceof Message) return this.message;

    if (!this.client.channels.cache.has(this.category.channel))
      return Ticket.tickets.delete(this.id);

    const channel = this.client.channels.cache.get(this.deleted ? this.category.logChannel ?? this.client.TICKET_LOGS_CHANNEL : this.category.channel);

    if (!channel)
      return Ticket.tickets.delete(this.id);

    if (!this.message)
      throw new Error(`Ticket ID #${this.id} has an invalid .message property.`);

    const message = await channel.messages.fetch(this.message.toString()).catch(() => null);

    if (!message)
      return Ticket.tickets.delete(this.id);

    return (this.message = message);
  }

  /**
   * Deletes this ticket.
   * @returns {Promise<Promise<import('pg').QueryResult>>}
   */
  async delete() {
    await this.getMessage();

    this.message.delete();
    this.message = await this.client.channels.cache
      .get(this.category.logChannel ?? this.client.TICKET_LOGS_CHANNEL)
      .send({
        embeds: [await this.embed('RED')],
        components: [new MessageActionRow().addComponents(new MessageButton().setCustomId('ticket_reopen').setLabel('Reopen').setStyle('SUCCESS'))]
      })
      .catch(() => null);
    this.deleted = true;

    Ticket.tickets.delete(this.id);
    Ticket.closedTickets.set(this.id, this);

    return getClient().query('UPDATE public.tickets SET "message" = $2, deleted = true WHERE "id" = $1', [this.id, this.message && this.message.id]).then(
      () => true,
      () => false
    );
  }

  /**
   * Creates an embed of this ticket.
   * @param {import('discord.js').ColorResolvable} color The color of this ticket.
   * @param {boolean} updateTimestamp Whether or not to timestamp this embed.
   * @param {boolean} preview Whether or not this is an embed preview or the actual ticket embed.
   * @returns {MessageEmbed}
   */
  async embed(color, updateTimestamp = false, preview = false) {
    const member = await this.client.HD.members.fetch(this.author?.id ?? '1').catch(() => null);

    if (!color && member)
      color = (this.categoryName === 'scam' && this.client.isPatreon(member)) || (this.client.isPatreon(member, 'champion')) ? this.client.PATREON_COLOR : this.client.INVISIBLE_COLOR;

    const embed = new MessageEmbed()
      .setDescription(!preview && this.info._status ? `**Status**\n${this.info._status}` : '')
      .setColor(color)
      .setTitle(`#${this.id.toLocaleString()} - ${titleCase(this.categoryName)}`);

    if (this.embedFooter) embed.setFooter(this.embedFooter);

    if (updateTimestamp) embed.setTimestamp();

    embed.fields = await asyncMap(
      Object.entries(this.info).filter(([name]) => !name.startsWith('_')),
      async ([n, v]) => ({ name: titleCase(n), value: await formatValue(this.client, v) })
    );

    embed.addField('Issue', this.issue);

    return embed;
  }

  /**
   * Updates this ticket in the database using its current properties.
   * @returns {Promise<void>}
   */
  async update() {
    this.info._lastUpdated = Date.now();

    return getClient().query('UPDATE public.tickets SET "info" = $2 WHERE "id" = $1', [this.id, this.info]).then(() => {}, (err) => process.emit('logBotError', err));
  }

  /**
   * Inserts this ticket into the database.
   * @returns {Promise<void>}
   */
  async store() {
    await this.getMessage();

    return getClient()
      .query('INSERT INTO public.tickets ("id", "message", "type", issue, author, "info") VALUES($1, $2, $3, $4, $5, $6)', [
        this.id,
        this.message.id ?? this.message,
        this.categoryName,
        this.issue,
        this.author.id,
        this.info,
      ])
      .then(() => {}, (err) => process.emit('logBotError', err));
  }

  /**
   * Gets the componenets of this ticket.
   * @returns {MessageActionRow[]}
   */
  getComponents() {
    const claimed = this.info._claimer !== undefined,
      components = [
        new MessageActionRow().addComponents(
          new MessageButton().setCustomId('ticket_close').setLabel('Close').setStyle('DANGER'),
          new MessageButton().setCustomId('ticket_edit').setLabel('Edit').setStyle('PRIMARY'),
          new MessageButton().setCustomId(claimed ? 'ticket_unclaim' : 'ticket_claim').setLabel(claimed ? 'Unclaim' : 'Claim').setStyle(claimed ? 'DANGER' : 'SUCCESS'),
          // new MessageButton().setCustomId('ticket_user_id').setLabel('User IDs').setStyle('SECONDARY')
        )
      ],
      idRow = new MessageSelectMenu()
        .setMaxValues(1)
        .setCustomId('ticket_select_user_id')
        .setPlaceholder('Get User ID');

    if (this.info.suspects?.length) {
      idRow.setOptions([
        this.info.suspects.map((s, i) => ({ label: this.client.users.cache.get(s)?.tag ?? `Suspect #${i + 1}`, value: s, description: `Suspect #${i + 1}` })),
        {
          label: this.author?.tag ?? 'User not found',
          value: this.authorId,
          description: 'The author of this ticket'
        }
      ]);
    } else {
      idRow.setOptions([
        {
          label: this.author?.tag ?? 'User not found',
          value: this.authorId,
          description: 'The author of this ticket'
        }
      ]);
    }

    components.push(new MessageActionRow().setComponents(idRow));

    if (this.categoryName !== 'appeal') components.push(
      new MessageActionRow().addComponents(
        new MessageSelectMenu()
          .setCustomId('ticket_change_type')
          .setPlaceholder('Change the ticket\'s type')
          .setMaxValues(1)
          .addOptions(
            (Ticket.isType(this.categoryName) ? Ticket.reportCategories : Ticket.generalCategories)
              .filter((c) => c !== this.categoryName)
              .map((c) => ({ label: titleCase(c.replace('_', ' ')), value: `change-to-${c}`, description: `Change the ticket to ${correctGrammar(c)} ${c.replace('_', ' ')} ticket.` }))
          )
      )
    );

    return components;
  }

  /**
   * Sends this ticket with the provided content using the Ticket#embed function.
   * @param {string} content 
   * @returns {Promise<Message>}
   */
  async send(content) {
    const embed = await this.embed(),
      message = await this.client.channels.cache.get(this.category.channel)
        .send({
          content,
          embeds: [embed],
          components: this.getComponents(),
        }).catch((err) => process.emit('logBotError', err));

    if (!message && !this.deleted)
      return this.author.send('Failed to send the ticket. Please report this issue in the <#669267304101707777> channel.');

    this.message = message;
    message.ticket = this;

    if (!this.stored) {
      this.store();

      this.stored = true;
    }

    if (!this.deleted && !content) {
      this.author.send({ content: 'Ticket sent successfully, here is a copy of your ticket:', embeds: [embed] });
    } else {
      this.deleted = false;

      Ticket.closedTickets.delete(this.id);
      Ticket.tickets.set(this.id, this);

      getClient().query('UPDATE public.tickets SET "message" = $2, deleted = false WHERE "id" = $1', [this.id, this.message.id]);
    }

    return message;
  }

  /**
   * Changes the category of this ticket.
   * @param {import('discord.js').User} user The user changing the ticket category.
   * @param {TicketCategory} currCategory 
   * @param {TicketCategory} newCategory
   * @returns {void}
   */
  async changeCategory(user, currCategory, newCategory) {
    this.categoryName = newCategory;
    this.category = CATEGORIES[newCategory];

    await this.getMessage();
    this.message.delete();
    this.update();

    await this.send(`\`${user.tag}\` has updated this ticket from ${correctGrammar(currCategory)} \`${currCategory.replace('_', ' ')}\` ticket to ${correctGrammar(newCategory)} \`${newCategory.replace('_', ' ')}\` ticket.`);

    await getClient().query('UPDATE public.tickets SET type = $2, message = $3 WHERE "id" = $1', [this.id, newCategory, this.message.id]).then(() => true, (err) => process.emit('logBotError', err));
  }
}

/**
 * An object keyed by category name and valued by information about that category.
 * @type {Object<TicketCategory, any>}
 */
Ticket.categoryInfo = CATEGORIES;
/**
 * A list of category names.
 * @type {TicketCategory[]}
 */
Ticket.categories = Object.keys(CATEGORIES);
Ticket.reportCategories = ['scam', 'staff_report', 'user_report'];
Ticket.generalCategories = ['application', 'verification', 'general'];
/**
 * A list of closed tickets.
 * @type {Collection<number,Ticket>}
 */
Ticket.closedTickets = new Collection();
/**
 * A list of active tickets
 * @type {Collection<number, Ticket>}
 */
Ticket.tickets = new Collection();
/**
 * An object keyed by roles and valued by how many tickets said role is expected to manage for their quota.
 * @type {Object}
 */
Ticket.QUOTAS = {
  scam: {
    [constants.TRIAL_SCAM_INVESTIGATOR]: 3,
    [constants.SCAM_INVESTIGATOR]: 3,
  },
  marketplace: {
    [constants.SENIOR_MARKETPLACE_STAFF]: 1,
    [constants.MARKETPLACE_STAFF]: 1,
    [constants.HD_GUILD]: 0,
  }
};

module.exports = Ticket;
