'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders'),
  { getClient } = require('../../load/database.js'),
  { cachedReactionRoles } = require('../../load/reactionRoles.js'),
  { getRole } = require('./toggle.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('Creates a role message on the given message.')
    .setDMPermission(false)
    .addStringOption((option) =>
      option.setName('operation')
        .setDescription('Whether to add or remove a reaction.')
        .setRequired(true)
        .addChoices({ name: 'add', value: 'add' }, { name: 'remove', value: 'remove' }))
    .addStringOption((option) =>
      option.setName('message_link')
        .setDescription('The message link that contains the reaction.')
        .setRequired(true))
    .addStringOption((option) =>
      option.setName('emoji')
        .setDescription('The emoji of the reaction.')
        .setRequired(true))
    .addRoleOption((option) =>
      option.setName('role')
        .setDescription('The role that should be added upon reaction.')
        .setRequired(false))
    .addStringOption((option) =>
      option.setName('toggle_role')
        .setDescription('The toggleable role from the toggle command that should be added upon reaction.')
        .setRequired(false)),
  canUse: {
    users: ['118496586299998209'],
    cant: 'You do not have permission to run this command.',
  },
  exec: async (call) => {
    const operation = call.interaction.options.getString('operation'),
      messageLink = call.interaction.options.getString('message_link'),
      emoji = call.interaction.options.getString('emoji'),
      role = call.interaction.options.getRole('role') ??
        (call.interaction.options.getString('toggle_role') && getRole(call.interaction.options.getString('toggle_role'))),
      [, channel, message] = messageLink.match(/\d+/g) ?? [],
      messageObject = await call.client.channels.cache
        .get(channel)
        ?.messages.fetch(message)
        .catch(() => null);

    if (!messageObject)
      return call.interaction.reply({ content: 'Please rerun the command with a valid message link of the role message.', ephemeral: true });

    if (!role)
      return call.interaction.reply({ content: 'Please provide either the `role` argument or a valid `toggle_role` argument.', ephemeral: true });

    if (operation === 'add') {
      if (!emoji)
        return call.interaction.reply({ content: 'Please rerun the command with the emoji that is used to role the user.', ephemeral: true });

      const reacted = await messageObject.react(emoji).catch(() => null);

      if (!reacted)
        return call.interaction.reply({ content: 'Please rerun the command with a valid emoji that is used to role the user.', ephemeral: true });

      getClient().query('INSERT INTO public.role_messages ("message", "emoji", "role", "toggle") VALUES($1, $2, $3, $4)', [message, emoji, role.id ?? null, !role.id ? role.name : null]).then(
        () => {
          call.interaction.reply(`Successfully created a role message in <#${channel}>, with emoji <:${emoji}> and role ${role.name}. If you need to cancel this role message, run the \`/reactionrole remove ...\` command.`);

          cachedReactionRoles.push({ channel, message, emoji, role: role.id });
        },
        (err) => {
          process.emit('logBotError', err);

          call.interaction.reply({ content: 'Something went wrong creating this reaction role. Please report this issue in the <#669267304101707777> channel.', ephemeral: true });
        }
      );
    } else if (operation === 'remove') {
      if (!emoji)
        return call.interaction.reply({ content: 'Please rerun the command with the emoji that is used to role the user.', ephemeral: true });

      if (cachedReactionRoles.every((reactionRole) => reactionRole.message !== message)) return call.interaction.reply({ content: 'There are no reaction roles on this message.', ephemeral: true });

      if (!emoji || cachedReactionRoles.every((reactionRole) => reactionRole.message !== message && reactionRole.emoji !== emoji))
        return call.interaction.reply({ content: 'There is no reaction role on this message that uses that emoji.', ephemeral: true });

      getClient().query('DELETE FROM public.role_messages WHERE message = $1 AND emoji = $2', [message, emoji]).then(
        () => {
          call.interaction.reply('Successfully deleted this reaction role.');

          messageObject.reactions.cache.get(emoji.replace(/.+:|>/g, '')).remove();

          const index = cachedReactionRoles.findIndex((reactionRole) => reactionRole.message === message && reactionRole.emoji === emoji);

          if (index > -1) cachedReactionRoles.splice(index, 1);
        },
        (err) => {
          process.emit('logBotError', err);

          message.channel.send('Something went wrong deleting this reaction role. Please report this issue in the <#669267304101707777> channel.');
        }
      );
    }
  },
};
