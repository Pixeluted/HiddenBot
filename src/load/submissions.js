'use strict';

const { getClient } = require('./database.js'),
  { SUBMISSION_LINKS, SUBMISSION_FILE_TYPES } = require('../util/constants.js');

const LINKS = SUBMISSION_LINKS.map((link) => new RegExp(`(https?://(www\\.)?)${link.replace(/\./, '\\.')}`, 'i')),
  WHITELISTED_ROLES = [
    '211229166861942784', // Admin
    '211229509150572544', // Full Staff Member
    '429114417461067778', // Trial Representatives
  ],
  validType = new RegExp(`\\.(${SUBMISSION_FILE_TYPES.join('|')})$`, 'i'),
  channels = [];

function messageHandle(message, newMessage) {
  if (newMessage)
    message = newMessage;

  if (!channels.includes(message.channel.id) || message.author.bot || message.member.roles.cache.some((r) => WHITELISTED_ROLES.includes(r.id)))
    return;

  if (!LINKS.some((link) => link.test(message.content)) && !message.attachments.some((att) => validType.test(att.name))) {
    message.reason = 'submission with no link';

    message.delete()
      .then(() => message.author.send('Your submission was deleted because it did not contain a valid link or an attachment. Your message: ```' + message.content.substring(0, 1897) + '```'));
  }
}

module.exports = {
  id: 'submissions',
  channels,
  exec: async (client) => {
    channels.push(...await getClient().query('SELECT channel FROM public.submissions').then((res) => res.rows.map((row) => row.channel)));

    client.on('messageCreate', messageHandle);
    client.on('messageUpdate', messageHandle);
  }
};