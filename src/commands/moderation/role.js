'use strict';

const { MessageEmbed } = require('discord.js'),
  { SlashCommandBuilder } = require('@discordjs/builders'),
  { getClient } = require('../../load/database.js');

// Solo, TheBritGuy, gt_c
const PERMISSION_MANAGERS = ['118496586299998209', '269926271633326082'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Adds or removes roles to or from users.')
    .setDMPermission(false)
    .addSubcommandGroup((group) => 
      group
        .setName('manage')
        .setDescription('Add or remove a role from a user.')
        .addSubcommand((subcommand) => 
          subcommand
            .setName('add')
            .setDescription('Add a role to a user.')
            .addUserOption((option) => 
              option
                .setName('member')
                .setDescription('The member to add the role to.')
                .setRequired(true)
            )
            .addRoleOption((option) => 
              option
                .setName('role')
                .setDescription('The role to add to the member.')
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) => 
          subcommand
            .setName('remove')
            .setDescription('Remove a role from a user.')
            .addUserOption((option) => 
              option
                .setName('member')
                .setDescription('The member to remove the role from.')
                .setRequired(true)
            )
            .addRoleOption((option) => 
              option
                .setName('role')
                .setDescription('The role to remove from the member.')
                .setRequired(true)
            )
        )
    )
    .addSubcommandGroup((group) => 
      group
        .setName('permissions')
        .setDescription('Manage the permissions of a role.')
        .addSubcommand((subcommand) =>
          subcommand
            .setName('add')
            .setDescription('Allow a role to manage another role.')
            .addRoleOption((option) => 
              option
                .setName('role')
                .setDescription('The role that will be managing the new role.')
                .setRequired(true)
            )
            .addRoleOption((option) => 
              option
                .setName('permission_role')
                .setDescription('The role that will be managed.')
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('remove')
            .setDescription('Disallow a role from manage another role.')
            .addRoleOption((option) => 
              option
                .setName('role')
                .setDescription('The role that will be no longer be managing the other role.')
                .setRequired(true)
            )
            .addRoleOption((option) => 
              option
                .setName('permission_role')
                .setDescription('The role that will no longer be managed.')
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('view')
            .setDescription('Show the permission roles a role can manage.')
            .addRoleOption((option) => 
              option
                .setName('role')
                .setDescription('The role to view the managable roles of.')
                .setRequired(true)
            )
        )
    ),
  exec: async (call) => {
    await call.interaction.deferReply();

    const group = call.interaction.options.getSubcommandGroup(),
      command = call.interaction.options.getSubcommand(),
      role = call.interaction.options.getRole('role'),
      permissionRole = call.interaction.options.getRole('permission_role')?.id,
      member = await call.client.HD.members.fetch(call.interaction.options.getUser('member')).catch(() => null);

    if (group === 'manage') {
      if (command === 'add') {
        const roles = await getClient().query('SELECT "role" FROM public.role_command_permissions WHERE $1 = ANY("permissions")', [role.id])
          .then((res) => res.rows.map((r) => r.role));

        if (!roles.length)
          return call.interaction.editReply({ content: 'This role cannot be added using the `role` command.', ephemeral: true });

        if (roles.every((r) => !call.member.roles.cache.has(r)))
          return call.interaction.editReply(
            {
              content: 'You do not have any of the roles allowed to manage this role.',
              embeds: [
                new MessageEmbed()
                  .setColor(call.client.INVISIBLE_COLOR)
                  .setTitle(`Roles With Permissions to Manage ${role.name}`)
                  .setDescription(`\`${roles.map((r) => call.interaction.guild.roles.cache.get(r)?.name).filter((r) => r !== undefined).join('`, `')}\``)
                  .setFooter({ text: `Requested by ${call.user.tag} (${call.user.id})`, iconURL: call.user.displayAvatarURL() })
              ],
              ephemeral: true,
            }
          );

        return member.roles.add(role)
          .then(
            () => {
              call.interaction.editReply({ content: 'Successfully added the role to the user.', ephemeral: true });

              return { type: 'Role Add', member, fields: [{ name: 'Role', value: `${role.name} (${role.id})` }] };
            },
            () => call.interaction.editReply({ content: 'Failed to add the role to the user.', ephemeral: true })
          );
      } else if (command === 'remove') {
        const roles = await getClient().query('SELECT "role" FROM public.role_command_permissions WHERE $1 = ANY("permissions")', [role.id])
          .then((res) => res.rows.map((r) => r.role));

        if (!roles.length)
          return call.interaction.editReply({ content: 'This role cannot be removed using the `role` command.', ephemeral: true });

        if (roles.every((r) => !call.member.roles.cache.has(r)))
          return call.interaction.editReply(
            {
              content: 'You do not have any of the roles allowed to manage this role.',
              embeds: [
                new MessageEmbed()
                  .setColor(call.client.INVISIBLE_COLOR)
                  .setTitle(`Roles With Permissions to Manage ${role.name}`)
                  .setDescription(`\`${roles.map((r) => call.interaction.guild.roles.cache.get(r)?.name).filter((r) => r !== undefined).join('`, `')}\``)
                  .setFooter({ text: `Requested by ${call.user.tag} (${call.user.id})`, iconURL: call.user.displayAvatarURL() })
              ],
              ephemeral: true,
            }
          );

        return member.roles.remove(role)
          .then(
            () => {
              call.interaction.editReply({ content: 'Successfully removed the role from the user.', ephemeral: true });
            
              return { type: 'Role Remove', member, fields: [{ name: 'Role', value: `${role.name} (${role.id})` }] };
            },
            () => call.interaction.editReply({ content: 'Failed to remove the role from the user.', ephemeral: true })
          );
      } 
    } else if (group === 'permissions') {
      if (!PERMISSION_MANAGERS.includes(call.user.id))
        return call.interaction.editReply({ content: 'You do not have permission to manage role permissions.', ephemeral: true });

      if (command === 'add') {
        await getClient().query('INSERT INTO public.role_command_permissions ("role", "permissions") SELECT $1, \'{}\' WHERE NOT EXISTS (SELECT 1 FROM public.role_command_permissions WHERE "role" = $1)',
          [role.id]);

        const permissions = await getClient().query('SELECT "permissions" FROM public.role_command_permissions WHERE "role" = $1', [role.id])
          .then((res) => res.rows[0].permissions);

        if (permissions.includes(permissionRole))
          return call.interaction.editReply({ content: 'The supplied role is already a permission.', ephemeral: true });

        return getClient().query('UPDATE public.role_command_permissions SET "permissions" = array_append("permissions", $2) WHERE "role" = $1', [role.id, permissionRole])
          .then(
            () => call.interaction.editReply({ content: 'Successfully added this role permission.', ephemeral: true }),
            () => call.interaction.editReply({ content: 'Failed to add this role permission.', ephemeral: true })
          );
      } else if (command === 'remove') {
        const permissions = await getClient().query('SELECT "permissions" FROM public.role_command_permissions WHERE "role" = $1', [role.id])
          .then((res) => res.rows[0]?.permissions ?? []);

        if (!permissions.includes(permissionRole))
          return call.interaction.editReply({ content: 'The supplied role is not a permission.', ephemeral: true });

        return getClient().query('UPDATE public.role_command_permissions SET "permissions" = array_remove("permissions", $2) WHERE "role" = $1', [role.id, permissionRole])
          .then(
            () => call.interaction.editReply({ content: 'Successfully removed this role permission.', ephemeral: true }),
            () => call.interaction.editReply({ content: 'Failed to remove this role permission.', ephemeral: true })
          );
      } else if (command === 'view') {
        const permissions = await getClient().query('SELECT "permissions" FROM public.role_command_permissions WHERE "role" = $1', [role.id])
          .then((res) => res.rows[0]?.permissions);

        if (!permissions?.length)
          return call.interaction.editReply({ content: 'There are no permissions to view for this role.', ephemeral: true });

        call.interaction.editReply(
          {
            embeds: [
              new MessageEmbed()
                .setColor(call.client.INVISIBLE_COLOR)
                .setTitle(`${role.name} Role Permissions`)
                .setDescription(`\`${permissions.map((r) => call.interaction.guild.roles.cache.get(r)?.name).filter((r) => r !== undefined).join('`, `')}\``)
                .setFooter({ text: `Requested by ${call.user.tag} (${call.user.id})`, iconURL: call.user.displayAvatarURL() })
            ],
            ephemeral: true,
          }
        );
      } 
    }
  }
};
