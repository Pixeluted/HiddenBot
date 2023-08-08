'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders'),
  { MessageEmbed } = require('discord.js'),
  { getClient } = require('../../load/database.js'),
  sendPaged = require('../../util/sendPaged.js');

const OPTIONS = {
    public: {
      settings: (subcommand) =>  subcommand.setName('public').setDescription('Changes the voice channel to public.'),
      exec: (call) => {
        const channel = call.member.customVoiceChannel;
  
        if (!channel)
          return call.interaction.reply({ content: 'You have no custom voice channel open. To create a custom voice channel, join the `create-voice` voice channel.', ephemeral: true });
  
        getClient().query('UPDATE public.custom_voice SET "private" = false WHERE "owner" = $1', [call.user.id]);
  
        channel.permissionOverwrites.create(channel.guild.id, { CONNECT: true }, 'Publicizing voice channel.').then(
          () => call.interaction.reply({ content: 'Opened the voice channel to the public.', ephemeral: true }),
          () => call.interaction.reply({ content: 'Failed to open the voice channel to the public.', ephemeral: true })
        );
      }
    },
    private: {
      settings: (subcommand) => subcommand.setName('private').setDescription('Changes the voice channel to private.'),
      exec: (call) => {
        const channel = call.member.customVoiceChannel;

        if (!channel)
          return call.interaction.reply({ content: 'You have no custom voice channel open. To create a custom voice channel, join the `create-voice` voice channel.', ephemeral: true });

        getClient().query('UPDATE public.custom_voice SET "private" = true WHERE "owner" = $1', [call.user.id]);

        channel.permissionOverwrites.create(channel.guild.id, { CONNECT: false }, 'Privatizing custom voice channel.').then(
          () => call.interaction.reply({ content: 'Closed the voice channel from the public.', ephemeral: true }),
          () => call.interaction.reply({ content: 'Failed to close the voice channel from the public', ephemeral: true })
        );
      }
    },
    max: {
      settings: (subcommand) => subcommand.setName('max')
        .setDescription('Changes the maximum amount of people allowed in the voice channel.')
        .addIntegerOption((option) =>
          option.setName('max')
            .setDescription('The new maximum amount of people allowed in the voice channel.')
            .setRequired(true)),
      exec: (call) => {
        const channel = call.member.customVoiceChannel;
  
        if (!channel)
          return call.interaction.reply({ content: 'You have no custom voice channel open. To create a custom voice channel, join the `create-voice` voice channel.', ephemeral: true });
  
        const max = call.interaction.options.getInteger('max');
  
        if (max < 2 || max > 20)
          return call.interaction.reply({ content: 'Please rerun the command and specify a valid max amount of users for the voice channel (2 to 20).', ephemeral: true });
  
        getClient().query('UPDATE public.custom_voice SET "max_users" = $2 WHERE "owner" = $1', [call.user.id, parseInt(max)]);
  
        channel.setUserLimit(parseInt(max), 'Changing user limit of custom voice channel.').then(
          () => call.interaction.reply({ content: 'Changed the user limit.', ephemeral: true }),
          () => call.interaction.reply({ content: 'Failed to change the user limit.', ephemeral: true })
        );
      }
    },
    name: {
      settings: (subcommand) => subcommand.setName('name')
        .setDescription('Changes the name of the voice channel.')
        .addStringOption((option) =>
          option.setName('name')
            .setDescription('The new name of the voice channel.')
            .setRequired(true)),
      exec: (call) => {
        const channel = call.member.customVoiceChannel;
  
        if (!channel)
          return call.interaction.reply({ content: 'You have no custom voice channel open. To create a custom voice channel, join the `create-voice` voice channel.', ephemeral: true });
  
        const name = call.interaction.options.getString('name');
  
        if (name.length < 3 || name.length > 50)
          return call.interaction.reply({ content: 'Please rerun the command and specify a valid name for the voice channel (between 3 and 50 characters).', ephemeral: true });
  
        getClient().query('UPDATE public.custom_voice SET "channel_name" = $2 WHERE "owner" = $1', [call.user.id, name]);
  
        channel.setName(`⭐ ${name}`, 'Changing the name of custom voice channel.').then(
          () => call.interaction.reply({ content: 'Changed the channel name.', ephemeral: true }),
          () => call.interaction.reply({ content: 'Failed to change the channel name.', ephemeral: true })
        );
      }
    },
    whitelist_add: {
      settings: (subcommand) => subcommand.setName('whitelist_add')
        .setDescription('Adds a user to the voice channel whitelist.')
        .addUserOption((option) =>
          option.setName('user')
            .setDescription('The user to add.')
            .setRequired(true)),
      exec: async (call) => {
        const user = call.interaction.options.getUser('user'),
          info = await getClient().query('SELECT "whitelist", "blacklist" FROM public.custom_voice WHERE "owner" = $1', [call.user.id]).then((res) => res.rows[0]);
  
        if (info?.whitelist.length + info?.blacklist.length + 3 >= 125)
          return call.interaction.reply({ content: 'You cannot have more than 125 users in your blacklist and whitelist combined.', ephemeral: true });
  
        if (info?.whitelist.includes(user.id))
          return call.interaction.reply({ content: 'This user is already whitelisted on your custom voice channel.', ephemeral: true });
  
        if (info?.blacklist.includes(user.id))
          return call.interaction.reply({ content: 'You cannot whitelist someone that is in your blacklist.', ephemeral: true });
  
        if (call.member.customVoiceChannel)
          call.member.customVoiceChannel.permissionOverwrites.create(user, { CONNECT: true }, 'User added to custom voice channel whitelist.');
  
        getClient().query('UPDATE public.custom_voice SET "whitelist" = array_append("whitelist", $2) WHERE "owner" = $1', [call.user.id, user.id]).then(
          () => call.interaction.reply({ content: 'Successfully added this user to your custom voice channel\'s whitelist.', ephemeral: true }),
          () => call.interaction.reply({ content: 'Failed to add this user to your custom voice channel\'s whitelist.', ephemeral: true })
        );
      }
    },
    whitelist_remove: {
      settings: (subcommand) => subcommand.setName('whitelist_remove')
        .setDescription('Removes a user from the voice channel whitelist.')
        .addUserOption((option) =>
          option.setName('user')
            .setDescription('The user to remove.')
            .setRequired(true)),
      exec: async (call) => {
        const user = call.interaction.options.getUser('user');

        if (call.member.customVoiceChannel)
          call.member.customVoiceChannel.permissionOverwrites.create(user, { CONNECT: null }, 'User removed from custom voice channel whitelist.');

        const info = await getClient().query('SELECT "whitelist" FROM public.custom_voice WHERE "owner" = $1', [call.user.id]).then((res) => res.rows[0]);

        if (info && !info.whitelist.includes(user.id))
          return call.interaction.reply({ content: 'This user is not whitelisted on your custom voice channel.', ephemeral: true });

        getClient().query('UPDATE public.custom_voice SET "whitelist" = array_remove("whitelist", $2) WHERE "owner" = $1', [call.user.id, user.id]).then(
          () => call.interaction.reply({ content: 'Successfully removed this user from your custom voice channel\'s whitelist.', ephemeral: true }),
          () => call.interaction.reply({ content: 'Failed to remove this user from your custom voice channel\'s whitelist.', ephemeral: true })
        );
      }
    },
    whitelist_view: {
      settings: (subcommand) => subcommand.setName('whitelist_view').setDescription('Views the current whitelist.'),
      exec: async (call) => {
        let list = await getClient().query('SELECT "whitelist" from public.custom_voice WHERE "owner" = $1', [call.user.id]).then((res) => res.rows[0]);
  
        if (!list || !list.whitelist)
          return call.interaction.reply({ content: 'No whitelist found.', ephemeral: true });
  
        list = list.whitelist;
  
        sendPaged(call, new MessageEmbed().setColor(call.client.DEFAULT_EMBED_COLOR).setTitle('Custom Voice Channel Whitelist'), {
          values: list.map((user, i) => `\`${(i + 1 + '.').padEnd(list.length.toString().length + 1)}\` <@${user}> (${user})`),
          valuesPerPage: 10,
        });
      }
    },
    blacklist_add: {
      settings: (subcommand) => subcommand.setName('blacklist_add')
        .setDescription('Adds a user to the voice channel blacklist.')
        .addUserOption((option) =>
          option.setName('user')
            .setDescription('The user to add.')
            .setRequired(true)),
      exec: async (call) => {
        const user = call.interaction.options.getUser('user'),
          info = await getClient().query('SELECT "whitelist", "blacklist" FROM public.custom_voice WHERE "owner" = $1', [call.user.id]).then((res) => res.rows[0]);
          
        if (info?.whitelist.length + info?.blacklist.length + 3 >= 125)
          return call.interaction.reply({ content: 'You cannot have more than 125 users in your blacklist and whitelist combined.', ephemeral: true });
        
        if (info?.blacklist.includes(user.id))
          return call.interaction.reply({ content: 'This user is already blacklisted on your custom voice channel.', ephemeral: true });
        
        if (info?.whitelist.includes(user.id))
          return call.interaction.reply({ content: 'You cannot blacklist someone that is in your whitelist.', ephemeral: true });
        
        if (call.member.customVoiceChannel)
          call.member.customVoiceChannel.permissionOverwrites.create(user, { CONNECT: false }, 'User added to custom voice channel blacklist.');
        
        getClient().query('UPDATE public.custom_voice SET "blacklist" = array_append("blacklist", $2) WHERE "owner" = $1', [call.user.id, user.id]).then(
          () => call.interaction.reply({ content: 'Successfully added this user to your custom voice channel\'s blacklist.', ephemeral: true }),
          () => call.interaction.reply({ content: 'Failed to add this user to your custom voice channel\'s blacklist.', ephemeral: true })
        );
      }
    },
    blacklist_remove: {
      settings: (subcommand) => subcommand.setName('blacklist_remove')
        .setDescription('Removes a user from the voice channel blacklist.')
        .addUserOption((option) =>
          option.setName('user')
            .setDescription('The user to remove.')
            .setRequired(true)),
      exec: async (call) => {
        const user = call.interaction.options.getUser('user');

        if (call.member.customVoiceChannel)
          call.member.customVoiceChannel.permissionOverwrites.create(user, { CONNECT: null }, 'User removed from custom voice channel blacklist.');

        const info = await getClient().query('SELECT "blacklist" FROM public.custom_voice WHERE "owner" = $1', [call.user.id]).then((res) => res.rows[0]);

        if (info && !info.blacklist.includes(user.id))
          return call.interaction.reply({ content: 'This user is not blacklisted on your custom voice channel.', ephemeral: true });

        getClient().query('UPDATE public.custom_voice SET "blacklist" = array_remove("blacklist", $2) WHERE "owner" = $1', [call.user.id, user.id]).then(
          () => call.interaction.reply({ content: 'Successfully removed this user from your custom voice channel\'s blacklist.', ephemeral: true }),
          () => call.interaction.reply({ content: 'Failed to remove this user from your custom voice channel\'s blacklist.', ephemeral: true })
        );
      }
    },
    blacklist_view: {
      settings: (subcommand) => subcommand.setName('blacklist_view').setDescription('Views the current blacklist.'),
      exec: async (call) => {
        const info = await getClient().query('SELECT "blacklist" from public.custom_voice WHERE "owner" = $1', [call.user.id]).then((res) => res.rows[0]);

        if (!info || !info.blacklist)
          return call.interaction.reply({ content: 'No blacklist found.', ephemeral: true });

        sendPaged(call, new MessageEmbed().setColor(call.client.DEFAULT_EMBED_COLOR).setTitle('Custom Voice Channel Blacklist'), {
          values: info.blacklist.map((user, i) => `\`${(i + 1 + '.').padEnd(info.blacklist.length.toString().length + 1)}\` <@${user}> (${user})`),
          valuesPerPage: 10,
        });
      }
    },
  },
  data = new SlashCommandBuilder()
    .setName('voicechat')
    .setDescription('Manages your custom voicechat.');

for (const option of Object.values(OPTIONS))
  data.addSubcommand(option.settings);

module.exports = {
  data,
  exec: function(call) {
    if (!call.client.isPatreon(call.member))
      return call.interaction.reply({ content: 'This command is restricted to <:Patreon:690343717219205223> **Patreon Members**.\nBecome a Patreon 👉  https://www.patreon.com/HiddenDevs', ephemeral: true });

    OPTIONS[call.interaction.options.getSubcommand()].exec(call);
  },
};
