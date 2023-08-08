const { Message, MessageEmbed, User, GuildMember, Collection, MessageActionRow, MessageButton } = require('discord.js'),
  { getClient } = require('../load/database.js'),
  constants = require('./constants.js'),
  { sentenceCase, titleCase, makeId } = require('./common.js'),
  { stripIndents } = require('common-tags');

/**
 * Information that forms the post embed.
 * @typedef {object} PostInfo
 * @property {string} channel The channel that the marketplace post is directed to.
 * @property {'hiring'|'hireable'|'tutor'} category The category of post.
 * @property {string} type The type of post. e.g. "ui", "building"
 * @property {string} description The description of the post.
 * @property {string} payment The payment of the post.
 * @property {string} paymentType The payment type of the post.
 * @property {string} contact The contacts of the post.
 * @property {string} image The image url of the post.
 * @property {string} portfolio The portfolio of the post creator.
 * @property {string} previousWorks The previous works of the post creator.
*/
class MarketplacePost {
  /**
   * Creates the components for a marketplace post using the interest count provided.
   * @param {number} interestCount
   * @returns {MessageActionRow[]}
   */
  static makeComponents(interestCount) {
    return [
      new MessageActionRow()
        .addComponents(
          new MessageButton()
            .setCustomId('post_show_interest')
            .setLabel(`Show Interest (${interestCount})`)
            .setStyle('PRIMARY'),
          new MessageButton()
            .setCustomId('post_delete')
            .setLabel('Delete')
            .setStyle('DANGER'),
          new MessageButton()
            .setCustomId('post_report')
            .setLabel('Report Scam')
            .setStyle('DANGER')
        )
    ];
  }

  /**
   * Finds the channel id of the provided category.
   * @param {'tutor'|'hireable'|'hiring'} category
   * @param {string} type
   * @returns {import('discord.js').Snowflake|void}
   */
  static findChannel(category, type) {
    if (category === 'tutor') return constants.OTHER_MARKETPLACE.tutor;

    const marketplace =
        category === 'hireable'
          ? constants.FOR_HIRE_MARKETPLACE
          : constants.HIRING_MARKETPLACE,
      channel = marketplace[type];

    return channel ?? null;
  }

  /**
   * Gets the marketplace post quota that the provided member needs to get weekly.
   * @param {GuildMember} member
   * @returns {number}
   */
  static getManagedQuota(member) {
    if (!(member instanceof GuildMember))
      throw new TypeError('Parameter "member" is not an instance of "DiscordJS.GuildMember"');

    return Object.entries(MarketplacePost.QUOTAS).find(([id]) => member.roles.cache.has(id))?.[1] ?? 0;
  }

  /**
   * Gets the posts that a user has managed in the provided timeframe.
   * @param {import('discord.js').Snowflake} userId
   * @param {number} startDate
   * @param {number} endDate
   * @returns {MarketplacePost[]}
   */
  static getManaged(userId, startDate, endDate) {
    return getClient()
      .query('SELECT "mp" FROM public.quotas WHERE "user" = $1', [userId])
      .then((res) => res.rows[0]?.mp?.filter((p) => p.date > startDate && p.date < endDate) ?? []);
  }

  /**
   * Comparison function to sort posts in the queue.
   * @param {*} a
   * @param {*} b
   * @returns {number}
   */
  static queueSort(a, b) {
    const aPremium = a.client.isPatreon(a.info.authorId, ['gold', 'champion']),
      bPremium = a.client.isPatreon(b.info.authorId, ['gold', 'champion']);

    return aPremium && bPremium ? a.info.createdAt - b.info.createdAt
      : aPremium ? -1
      : bPremium ? 1
      : a.info.createdAt - b.info.createdAt;
  }

  /**
   * Represents a post.
   */
  constructor(
    id,
    /**
     * Contains properties that affect the formation of the post embed.
     * @param {PostInfo} postInfo
     */
    postInfo = {},
    /**
     * Contains properties that don't affect the formation of the post embed.
     * @param {object} info
     */
    info = {},
    client,
    insert = false
  ) {
    this.id = id ?? makeId();
    this.postInfo = postInfo;
    this.info = info;
    this.info.status = this.info.status ?? 'pending';
    this.info.createdAt = this.info.createdAt ?? Date.now();
    this.info.claimed = this.info.claimed ?? false;
    this.client = client;

    if (this.info.status === 'pending') {
      MarketplacePost.pendingList.set(id, this);
    } else {
      if (!MarketplacePost.list.has(id) || MarketplacePost.list.get(id).info.createdAt < this.info.createdAt)
        MarketplacePost.list.set(id, this);
    }

    if (insert)
      this.insert();
  }

  /**
   * Whether or not the provided member can manage this post.
   * @param {import('discord.js').Snowflake|import('discord.js').User} user
   * @returns {boolean}
   */
  canManage(user) {
    return this.info.status === 'pending'
      && (process.env.NODE_ENV !== 'production' || this.info.authorId !== (user.id || user))
      && !this.active;
  }

  /**
   * Fetches the author of this post.
   * @returns {Promise<import('discord.js').User>}
   */
  getAuthor() {
    return this.client.users.fetch(this.info.authorId).catch(() => null);
  }

  /**
   * Gets the channel of this post.
   * @returns {Promise<import('discord.js').TextChannel}
   */
  getChannel() {
    return this.client.channels.fetch(this.postInfo?.channel).catch(() => null);
  }

  /**
   * Enables this post as active (a marketplace staff is currently managing it) for 3 minutes..
   * @returns {void}
   */
  enableActive() {
    this.active = true;
    this.activeTimeout = setTimeout(() => {
      this.active = false;
    }, 180000);
  }

  /**
   * Disables this post as active.
   * @returns {void}
   */
  disableActive() {
    this.active = false;

    clearTimeout(this.activeTimeout);
  }

  /**
   * Toggles this post active or inactive.
   * @returns {void}
   */
  toggleActive() {
    if (this.active)
      return this.disableActive();
    else
      return this.enableActive();
  }

  /**
   * Inserts this post into the database.
   * @returns {Promise<boolean>}
   */
  insert() {
    return getClient()
      .query(
        'INSERT INTO public.posts ("id", "info", "post_info", "created_at") VALUES ($1, $2, $3, $4)',
        [this.id, this.info, this.postInfo, new Date(this.info.createdAt)]
      )
      .then(() => true, (err) => process.emit('logBotError', err));
  }

  /**
   * Updates this post in the database based on its current properties.
   * @returns {Promise<boolean>}
   */
  update() {
    return getClient()
      .query('UPDATE public.posts SET "info" = $2, "post_info" = $3 WHERE "id" = $1', [this.id, this.info, this.postInfo])
      .then(() => true, (err) => process.emit('logBotError', err));
  }

  /**
   * Fetches the message of this post.
   * @returns {Message}
   */
  async getMessage() {
    if (!this.info.message) throw new TypeError('Invalid .message property.');

    if (this.info.message instanceof Message) return this.info.message;

    if (!this.info?.channel)
      throw new TypeError('Invalid .info.channel property.');

    const channel = await this.getChannel();

    if (!channel) return;

    const message = await channel.messages
      .fetch(this.info.message)
      .catch(() => null);

    if (!message) return;

    return (this.info.message = message);
  }

  /**
   * Creates an embed of this post.
   * @param {Object} overwrites API embed data to overwrite the embed created.
   * @returns {MessageEmbed}
   */
  async embed(overwrites = {}) {
    const author = await this.getAuthor(),
      champion = this.client.isPatreon(author.id, ['champion', 'gold']),
      embed = new MessageEmbed()
        .setColor(champion ? this.client.PATREON_COLOR : this.client.DEFAULT_EMBED_COLOR)
        .setAuthor({ name: author.tag, iconURL: author.displayAvatarURL() })
        .setTitle(
          `${champion ? '⭐ ' : ''}${
            this.postInfo.category === 'hiring' ? 'Hiring Request'
            : this.postInfo.category === 'hireable' ? `${this.postInfo.type === 'ui' ? this.postInfo.type.toUpperCase() : titleCase(this.postInfo.type)} For Hire`
            : this.postInfo.category === 'tutor' ? `${titleCase(this.postInfo.type)} Tutor`
            : 'Unknown Marketplace Category'
          }`
        )
        .setDescription(this.postInfo.description)
        .addField(this.postInfo.category === 'tutor' ? 'Pricing' : 'Payment', this.postInfo.payment);

    if (this.postInfo.paymentType)
      embed.addField('Payment Type', sentenceCase(this.postInfo.paymentType));

    if (this.postInfo.portfolio)
      embed.addField('Portfolio', `[**Link**](${this.postInfo.portfolio})`);

    if (this.postInfo.previousWorks)
      embed.addField('Previous Works', this.postInfo.previousWorks);

    if (this.postInfo.contact)
      embed.addField('Contact', this.postInfo.contact);

    if (this.postInfo.image && constants.ONLY_LINK_REGEX.test(this.postInfo.image))
      embed.setImage(this.postInfo.image);

    Object.assign(embed, overwrites);

    return embed;
  }

  /**
   * Approves this post.
   * @param {User} staff The staff that approved this post.
   * @param {boolean} update Whether or not to update the post in the database after approving.
   * @returns {Promise<Message>}
   */
  async approve(staff, update = true) {
    if (!(staff instanceof User))
      throw new TypeError('Parameter "moderator" is not an instance of "DiscordJS.User"');

    const channel = await this.getChannel();

    if (!channel)
      throw new Error('Failed to locate channel to send post to.');

    return channel.send({
      content: `<@!${this.info.authorId}> ${this.client.isPatreon(this.info.authorId, 'champion') ? `<@&${this.client.HIGHLIGHT_PING}>` : ''}`,
      embeds: [await this.embed({ footer: { text: `User ID: ${this.info.authorId} Approved by ${staff.username}` } })],
      components: MarketplacePost.makeComponents(0)
    }).then((m) => {
      this.info.status = 'approved';
      this.info.message = m;
      this.info.managedAt = Date.now();
      this.info.staffId = staff.id;
      this.postInfo.approvedCount = this.postInfo.approvedCount ? this.postInfo.approvedCount + 1 : 1;

      MarketplacePost.list.set(this.id, this);

      if (update)
        this.update();

      m.post = this;

      return m;
    });
  }

  /**
   * Denies this post.
   * @param {User} staff The staff that deined this post.
   * @param {string} reason The reason for denying the post.
   * @param {boolean} update Whether or not to update this post in the database after denying.
   * @returns {Promise<boolean>} Whether or not the author of the post was DMed.
   */
  async deny(staff, reason, update = true) {
    if (!(staff instanceof User))
      throw new TypeError('Parameter "moderator" is not an instance of "DiscordJS.User"');

    this.info.status = 'denied';
    this.info.managedAt = Date.now();
    this.info.staffId = staff.id;

    MarketplacePost.list.set(this.id, this);

    if (update)
      this.update();

    const author = await this.getAuthor(),
      sent = await author.send(
        {
          content: stripIndents`Your post was declined by ${staff} (${staff.tag}) for:
      
            \`\`\`${reason}\`\`\``,
          embeds: [await this.embed()]
        }
      ).then(() => true, () => false);

    return sent;
  }
}
/**
 * A list of all approved/denied posts.
 * @type {Collection<string, MarketplacePost>}
 */
MarketplacePost.list = new Collection();
/**
 * A list of all active posts awaiting management. Posts are loaded on startup and more posts can be added, but not removed.
 * @type {Collection<string, MarketplacePost>}
 */
MarketplacePost.pendingList = new Collection();
/**
 * An object keyed by roles and valued by how many posts said role is expected to manage for their quota.
 * @type {Object}
 */
MarketplacePost.QUOTAS = {
  [constants.MARKETPLACE_LEADER]: 5,
  [constants.MARKETPLACE_MANAGEMENT]: 0,
  [constants.SENIOR_MARKETPLACE_STAFF]: 10,
  [constants.MARKETPLACE_STAFF]: 40,
  [constants.TRIAL_MARKETPLACE_STAFF]: 50,
};

module.exports = MarketplacePost;
