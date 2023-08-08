'use strict';

const { getClient } = require('./database.js'),
  { setTimeout, clearTimeout } = require('safe-timers'),
  events = require('events');

const timerEmitter = new events.EventEmitter();

timerEmitter.id = 'timers';
timerEmitter.list = [];

timerEmitter.exec = async function() {
  const active = await getClient().query('SELECT "type", "info", "time" FROM public.timers').then((res) => res.rows);

  for (const timer of active) {
    timerEmitter.create(timer.type, timer.info, timer.time, false);
  }
};

timerEmitter.create = function(type, info, time, load = true) {
  this.list.push({
    timeout: setTimeout(() => {
      timerEmitter.emit(type, info);
      timerEmitter.delete(time);
    }, time - Date.now()),
    type,
    info,
    time
  });

  if (load)
    return getClient().query('INSERT INTO public.timers ("type", "info", "time") VALUES ($1, $2, $3)', [type, info, time]);
};

timerEmitter.delete = function(time) {
  if (!time)
    return;

  const index = this.list.findIndex((t) => t.time === time);

  if (index > -1) {
    clearTimeout(this.list[index].timeout);
    this.list.splice(index, 1);
  }

  return getClient().query('DELETE FROM public.timers WHERE "time" = $1', [time]);
};

module.exports = timerEmitter;