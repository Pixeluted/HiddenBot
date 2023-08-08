'use strict';

const { getClient } = require('./database.js'),
  { getRole, addRole } = require('../commands/roles/toggle.js');

function isEmoji(reaction, emoji) {
  return reaction.emoji.name === emoji || reaction.emoji.id === emoji.replace(/.+:|>/g, '');
}

const hireable_role = '438643836487598080',
  not_hireable_role = '438643983371993089',
  region_roles = [
    '774465239373709322',
    '774465231815966790',
    '774465227398971422',
    '774465225599746108',
    '781703231729303552',
    '774465229324812339',
    '774465237592178709',
    '774465233666310174',
    '774465235351240755',
  ];

module.exports = {
  id: 'reaction-roles',
  cachedReactionRoles: [],
  exec: async function(client) {
    this.cachedReactionRoles.push(...(await getClient().query('SELECT "message", "emoji", "role", "toggle" FROM public.role_messages').then((res) => res.rows)));

    client
      .on('messageReactionAdd', async (reaction, user) => {
        if (reaction.message.channel.type !== 'GUILD_TEXT' || user.bot) return;

        const roleMessage = this.cachedReactionRoles.find((reactionRole) => reactionRole.message === reaction.message.id && isEmoji(reaction, reactionRole.emoji));

        if (!roleMessage) return;

        const member = await reaction.message.guild.members.fetch(user.id);

        if (roleMessage.role) {
          if (region_roles.includes(roleMessage.role)) {
            const hasOneOf = member.roles.cache.some((role) => region_roles.includes(role.id));

            if (hasOneOf) {
              member.roles.remove(region_roles, 'Applying a different region role to the user.');
            }
          } else if (roleMessage.role === hireable_role) {
            await member.roles.remove(not_hireable_role);
          }

          reaction.message.guild.members.cache
            .get(user.id)
            .roles.add(roleMessage.role)
            .then(() => user.send(`Added you to the \`${reaction.message.guild.roles.cache.get(roleMessage.role).name}\` role.`))
            .catch(() => user.send('Failed to role you. Potential reasons: role deleted or the bot lacks permissions. Please report this issue in the <#669267304101707777> channel.'));
        } else if (roleMessage.toggle) {
          addRole(reaction.message.guild, member, null, getRole(roleMessage.toggle));
        }
      })
      .on('messageReactionRemove', async (reaction, user) => {
        if (reaction.message.channel.type !== 'GUILD_TEXT' || user.bot) return;

        const roleMessage = this.cachedReactionRoles.find((reactionRole) => reactionRole.message === reaction.message.id && isEmoji(reaction, reactionRole.emoji));

        if (!roleMessage) return;

        const member = await reaction.message.guild.members.fetch(user.id);

        if (roleMessage.role) {
          const hasRole = member.roles.cache.find((role) => role.id === roleMessage.role);

          if (!hasRole) return;

          if (roleMessage.role === hireable_role) {
            await member.roles.add(not_hireable_role);
          }

          reaction.message.guild.members.cache
            .get(user.id)
            .roles.remove(roleMessage.role)
            .then(() => user.send(`Removed you from the \`${reaction.message.guild.roles.cache.get(roleMessage.role).name}\` role.`))
            .catch(() => user.send('Failed to unrole you. Potential reasons: role deleted or the bot lacks permissions. Please report this issue in the <#669267304101707777> channel.'));
        } else if (roleMessage.toggle) {
          addRole(reaction.message.guild, member, null, getRole(roleMessage.toggle));
        }
      });
  },
};
