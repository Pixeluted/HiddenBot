'use strict';

const { getClient } = require('../load/database');

module.exports = {
  getEvents: () => getClient().query('SELECT * FROM public.events').then((res) => res.rows),
  getEvent: (channelId) => getClient().query('SELECT * FROM public.events WHERE channel = $1', [channelId]).then((res) => res.rows[0]),
  addEvent: (eventType, id, channel, user, channel2 = null) => getClient().query('INSERT INTO public.events (id, channel, channel2, "user", event_type) VALUES($1, $2, $3, $4, $5)', [id, channel, channel2, user, eventType]),
  removeEvent: (id, channel) => getClient().query('DELETE FROM public.events WHERE id = $1 AND channel = $2', [id, channel]),
  updatechannel2: (channel2, type) => getClient().query('UPDATE public.events SET channel2_open = $2 WHERE channel2 = $1', [channel2, type]),
  incrementId: (guild = '211228845771063296') => getClient().query('UPDATE public.last_ids SET event_id = event_id + 1 WHERE guild = $1', [guild]),
  getLastId: (guild = '211228845771063296') => getClient().query('SELECT event_id FROM public.last_ids WHERE guild = $1', [guild]).then((res) => res.rows[0].event_id)
};