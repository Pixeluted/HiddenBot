'use strict';

const { getClient } = require('../load/database');

const objects = [];

/**
 * @typedef InfractionObject
 * @property {'ban'|'mute'|'kick'|'softban'|'warn'} type The type of punishment the user received.
 * @property {?string} reason The reason supplied by the committer, null if no reason.
 * @property {string} committer The user id of the person who punished the user.
 * @property {?number} length If a mute, the length of the mute.
 * @property {?number} date The timestamp representing when the punishment was taken out.
 * @property {?number} id The incremental id of the infraction, limited per each guild
 * @property {'events', 'server', 'poll', 'marketplace', 'voice', 'image'} mute_type The type of mute punishment the user received.
 * @property {?number} edit_date A timestamp representing when the infraction was edited.
 */
class Infractions {
  static infractionsOf(member, guildId) {
    guildId = guildId?.id ?? guildId ?? member.guild.id;

    return objects.find((inf) => inf.member.id === member.id && inf.guildId === guildId) || new Infractions(member, guildId);
  }

  /**
   * Gets the total amount of infractions in the database.
   * @returns {number} The count.
   */
  static count() {
    return getClient().query('SELECT COUNT(*) FROM public.infractions').then((result) => parseInt(result.rows[0].count));
  }

  /**
   * Gets the all of the infractions in the database.
   * @returns {InfractionObject[]} The infractions.
   */
  static get() {
    return getClient().query('SELECT "user", guild, "type", date, reason, "id", committer, "length", log_url, mute_type, edit_date, edit_log_url FROM public.infractions').then((result) => result.rows);
  }

  /**
   * Removes all of the infractions in the database.
   * @returns {void}
   */
  static remove() {
    return getClient().query('DELETE FROM public.infractions');
  }

  /**
   * Gets the infractions of a specified user in the specified guild.
   * @param {string} guildId The id of the guild the user was punished in.
   * @param {string} userId The id of the user.
   * @returns {InfractionObject[]} The infractions of the user.
   */
  static getInfractions(guildId, userId) {
    return getClient()
      .query('SELECT "type", reason, "length", "date", "id", committer, log_url, mute_type, edit_date, edit_log_url FROM public.infractions WHERE guild = $1 AND "user" = $2', [guildId, userId])
      .then((result) => result.rows)
      .catch(console.error);
  }

  /**
   * Gets a single infraction from an ID.
   * @param {string} guildId
   * @param {number} id
   */
  static getInfraction(guildId, id) {
    return getClient()
      .query('SELECT guild, "user", "type", reason, "length", "date", "id", committer, log_url, mute_type, edit_date, edit_log_url FROM public.infractions WHERE guild = $1 AND "id" = $2', [
        guildId,
        id,
      ])
      .then((result) => result.rows[0]);
  }

  /**
   * Adds an infraction to a user in the specified guild.
   * @param {string} guildId The guild ID.
   * @param {string} userId The user ID.
   * @param {InfractionObject} infraction The infraction.
   * @returns {Promise<void>}
   */
  static addInfraction(guildId, userId, { type, reason, length, date, id, committer, log_url, mute_type, edit_log_url }) {
    return getClient()
      .query(
        `INSERT INTO public.infractions (guild, "user", "type", reason, "length", "date", "id", committer, log_url, mute_type, edit_log_url)
      VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [guildId, userId, type, reason, length, date, id, committer, log_url, mute_type, edit_log_url]
      )
      .then(() => null);
  }

  static updateInfraction(guildId, infractionId, { type, reason, length, date, id, committer, log_url, mute_type, edit_date, edit_log_url }) {
    return getClient()
      .query(
        'UPDATE public.infractions SET guild = $1, type = $3, reason = $4, length = $5, date = $6, id = $7, committer = $8, log_url = $9, mute_type = $10, edit_date = $11, edit_log_url = $12 WHERE guild = $1 AND "id" = $2',
        [guildId, infractionId, type, reason, length, date, id, committer, log_url, mute_type, edit_date, edit_log_url]
      )
      .then(() => null);
  }

  /**
   * Removes a infraction from a user in the specified guild.
   * @param {string} guildId The guild ID.
   * @param {InfractionObject} infractionId The infraction's id.
   * @returns {Promise<void>}
   */
  static removeInfraction(guildId, infractionId) {
    return getClient()
      .query(
        `DELETE FROM public.infractions
      WHERE guild = $1 AND "id" = $2`,
        [guildId, infractionId]
      )
      .then(() => null);
  }

  /**
   * Removes all infractions from a user in the specified guild.
   * @param {string} guildId The guild ID.
   * @param {string} userId The user ID.
   * @returns {Promise<void>}
   */
  static removeAllInfractions(guildId, userId, filter) {
    return getClient()
      .query(
        `DELETE FROM public.infractions
      WHERE guild = $1 AND "user" = $2${filter && filter !== 'all' ? ` AND "type" = '${filter}'` : ''}`,
        [guildId, userId]
      )
      .then(() => null);
  }

  /**
   * Increments the latest id by one for the specified guild.
   * @param {string} guildId The guild ID.
   * @returns {voice}
   */
  static incrementLastId(guildId) {
    getClient().query('UPDATE public.last_ids SET "id" = "id" + 1 WHERE guild = $1', [guildId]);

    Infractions.ids[guildId]++;

    for (const infraction of objects.filter((inf) => inf.guildId === guildId)) infraction.lastId++;
  }

  /**
   * Gets the current latest infraction id in the specified guild.
   * @param {string} guildId The id of the guild where the current infraction number is needed.
   * @returns {number} The latest infraction id, zero if no infractions in guild.
   */
  static async lastId(guildId) {
    let result;

    if (guildId in Infractions.ids) {
      result = Infractions.ids[guildId];
    } else {
      result = await getClient().query('SELECT "id" FROM public.last_ids WHERE guild = $1', [guildId]).then((result) => result.rows[0]?.id);

      if (result == null) {
        result = 0;

        getClient().query('INSERT INTO public.last_ids (guild, "id") VALUES($1, $2)', [guildId, result]);
      }

      Infractions.ids[guildId] = result;
    }

    return result;
  }

  constructor(member, guildId) {
    this.member = member;
    this.guildId = guildId || member.guild.id;

    (this.member.user ?? this.member).infractions = this;

    // Promise resolving once the object is ready to be used. Resolves immediately if called again after already resolved.
    this.ready = new Promise(async (resolve) => {
      // Can be replaced with something else if more efficient method known.
      this.current = await Infractions.getInfractions(guildId, member.id).then((arr) => arr.sort((a, b) => b.date - a.date));

      // Asynchronous function, only call once when member instance created.
      this.lastId = await Infractions.lastId(guildId);

      const oldUser = objects.findIndex((inf) => inf.member.id === member.id && inf.guildId === this.guildId);

      if (oldUser >= 0) objects.splice(oldUser, 1);

      objects.push(this);

      resolve();
    });
  }

  /**
   * Adds an infraction to the database under the current user.
   * @param {InfractionObject} inf The infraction to add to the database.
   * @returns {Promise<void>}
   */
  async addInfraction(inf) {
    await this.ready;

    const object = { date: Date.now(), ...inf, user: this.member.id, id: this.lastId + 1 };

    return Infractions.addInfraction(this.guildId, this.member.id, object).then(
      () => {
        Infractions.incrementLastId(this.guildId);

        this.current.push(object);
        this.current.sort((a, b) => b.date - a.date);
        this.member.client.emit('infractionAdded', object, this);
      },
      (err) => {
        process.emit('logBotError', err);
        --this.lastId;
      }
    );
  }

  /**
   * Updates an infraction in the database under the current user.
   * @param {number} id The id of the infraction to update.
   * @param {InfractionObject} inf The infraction to add to the database in place of the other infraction.
   * @returns {Promise<void>}
   */
  async updateInfraction(id, inf) {
    await this.ready;

    const index = this.current.findIndex((i) => parseInt(i.id) === parseInt(id)),
      object = { date: this.current[index]?.date, edit_date: Date.now(), ...inf, user: this.member.id, id: this.current[index]?.id };

    return Infractions.updateInfraction(this.guildId, this.current[index].id, object).then(
      () => {
        this.current.splice(index, 1, object);
        this.current.sort((a, b) => b.date - a.date);
      },
      (err) => {
        process.emit('logBotError', err);
        --this.lastId;
      }
    );
  }

  /**
   * Removes an infraction from the database on the current user.
   * @param {number} id The id of the infraction to remove.
   * @returns {Promise<void>}
   */
  async removeInfraction(id) {
    await this.ready;

    const index = this.current.findIndex((i) => parseInt(i.id) === parseInt(id));

    if (index === -1) return Promise.reject(new Error(`This user does not have an infraction with the id ${id}`));

    // Do not decrement database value of lastId.
    return Infractions.removeInfraction(this.guildId, this.current[index].id).then(() => this.current.splice(index, 1));
  }

  /**
   * Removes all infractions from the database under the current user.
   * @returns {Promise<void>}
   */
  async clearInfractions(filter) {
    await this.ready;

    // Do not decrement database value of lastId.
    return Infractions.removeAllInfractions(this.guildId, this.member.id, filter).then(() => this.current.length = 0);
  }
}

/**
 * An object keyed by guild ID and valued by the last infraction ID in that guild.
 * @type {Object}
 */
Infractions.ids = {};

module.exports = Infractions;
