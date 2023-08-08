'use strict';

const { stripIndents } = require('common-tags');

const CHATS = ['653106039247601664', '827544340053884949'], // Private-testing, Chat (main server)
  { MessageEmbed } = require('discord.js'),
  ROLES = require('../util/roles.json');

module.exports = {
  id: 'patreon_threads',
  exec: (client) => {
    client
      .on('threadCreate', async (thread) => {
        if (!CHATS.includes(thread.parentId) || thread.ownerId === client.user.id)
          return;

        const champion = client.isPatreon(thread.ownerId, 'champion'), 
          numThreads = (await thread.guild.channels.fetchActiveThreads())?.threads.filter((th) => th.ownerId === thread.ownerId && CHATS.includes(th.parentId)).size;

        if ((numThreads > 1 && !champion) || (numThreads > 2 && champion)) return thread.delete('User had more than 2 threads open.');
        
        await thread.setLocked(true);
        await thread.setAutoArchiveDuration(champion ? 4320 : 1440);

        thread.send({
          embeds: [
            new MessageEmbed()
              .setColor(client.DEFAULT_EMBED_COLOR)
              .setDescription(stripIndents`Welcome to your private thread. You are allowed up to ${champion ? 20 : 10} users in this thread, just mention anyone to add them. If you would like to remove someone from your thread, right click their user on the members list and click \`Remove from thread\`. You may have a maximum of ${champion ? '2' : '1'} private thread${champion ? 's' : ''}.
                ${!champion ? '\nIf you would like to add up to 20 people, have your thread archive after 24 hours of activity instead of 1 hour, and to have two threads at once, you will need to upgrade to the Champion rank.\n' : ''}
                To report a user, contact a moderator or add them to this thread by mentioning them.\nAfter the channel is archived, the channel is subject for a review by a moderator+ for any inappropriate behavior displayed.`)
          ]
        });
      })
      .on('threadUpdate', (_, newThread) => {
        if (!CHATS.includes(newThread.parentId) || newThread.ownerId === client.user.id)
          return;

        const champion = client.isPatreon(newThread.ownerId, 'champion');

        if (newThread.autoArchiveDuration > 1440 && !champion)
          newThread.setAutoArchiveDuration(1440);
        else if (newThread.autoArchiveDuration > 4320)
          newThread.setAutoArchiveDuration(4320);

        if (newThread.invitable) newThread.setInvitable(false);
      })
      .on('threadMembersUpdate', async (oldMembers, newMembers) => {
        if (oldMembers.size > newMembers.size || newMembers.size === 0)
          return;

        const newCount = newMembers.filter((m) => !m.guildMember.roles.cache.has(ROLES.MOD) && !m.user.bot).size,
          memberAdded = newMembers.difference(oldMembers).first();

        if (!memberAdded) return;

        const champion = client.isPatreon(memberAdded.thread.ownerId, 'champion');

        if (!CHATS.includes(memberAdded.thread.parentId)) return;

        if (newCount > (champion ? 20 : 10)) {
          memberAdded.remove();

          memberAdded.thread.send({
            embeds: [
              new MessageEmbed()
                .setColor(client.DEFAULT_EMBED_COLOR)
                .setDescription(stripIndents`You have reached the maximum number of users added to your thread (${champion ? 20 : 10}).
                  ${!champion ? 'If you would like to add up to 20 people, have your thread archive after 24 hours of activity instead of 1 hour, and to have two threads at once, you will need to upgrade to the Champion rank.' : ''}`)
            ]
          });
        }
      });
  },
};