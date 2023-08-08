'use strict';

const { getClient } = require('./database.js');

const customVoiceChannels = [];

function startTimer(channel) {
  channel.timeout = setTimeout(() => {
    delete channel.customOwner.customVoiceChannel;

    channel.delete();
    getClient().query('UPDATE public.custom_voice SET "channel" = NULL WHERE "channel" = $1', [channel.id]);
  }, 60000); // 1 minute
}

module.exports = {
  id: 'custom-voice',
  exec: async (client) => {
    const channels = await getClient().query('SELECT "owner", "channel" FROM public.custom_voice').then((res) => res.rows);

    for (let { owner, channel } of channels) {
      channel = client.channels.cache.get(channel);

      if (!channel)
        continue;

      const member = await channel.guild.members.fetch(owner).catch(() => null);

      if (!member)
        continue;

      channel.customOwner = member;
      member.customVoiceChannel = channel;
      customVoiceChannels.push(channel);

      if (!channel.members.size)
        startTimer(channel);
    }

    client.on('voiceStateUpdate', async (oldState, newState) => {
      for (const customVoiceChannel of customVoiceChannels) {
        if (!customVoiceChannel.timeout && customVoiceChannel.members.size === 0) {
          startTimer(customVoiceChannel);
        } else if (customVoiceChannel.timeout && customVoiceChannel.members.size !== 0) {
          clearTimeout(customVoiceChannel.timeout);

          customVoiceChannel.timeout = null;
        }
      }

      const member = newState.member;

      if (oldState.channelId === newState.channelId || newState.channelId !== client.VOICE_CREATE_CHANNEL || !client.isPatreon(member, ['gold', 'champion']))
        return;

      if (member.customVoiceChannel && !member.customVoiceChannel.deleted)
        return member.voice.setChannel(member.customVoiceChannel);

      let info = await getClient().query('SELECT "whitelist", "blacklist", "max_users", "channel_name", private FROM public.custom_voice WHERE "owner" = $1', [member.id]).then((res) => res.rows[0]);

      if (!info) {
        getClient().query('INSERT INTO public.custom_voice ("owner") VALUES ($1)', [member.id]);

        info = { whitelist: [], blacklist: [], max_users: client.isPatreon(member, 'champion') ? 20 : 10 };
      }

    //   member.customVoiceChannel = await member.guild.channels.create('⭐' + (info.channel_name ?? `${member.user.username}'s Voice Channel`), {
    //     type: 'GUILD_VOICE',
    //     parent: client.VOICE_CREATE_CATEGORY,
    //     userLimit: info.max_users,
    //     permissionOverwrites: [
    //       { id: member.id, allow: ['CONNECT', 'MOVE_MEMBERS'] },
    //       { id: client.MODERATOR, allow: ['CONNECT'] },
    //       { id: client.MUTE_ROLES.VOICE_MUTE, deny: ['CONNECT'] },
    //       { id: client.MUTE_ROLES.SERVER_MUTE, deny: ['CONNECT'] },
    //       { id: member.guild.id, [info.private ? 'deny' : 'allow']: ['CONNECT'] },
    //       ...info.whitelist.filter((user) => member.guild.members.cache.has(user)).map((user) => ({ id: user, allow: ['CONNECT'] })),
    //       ...info.blacklist.filter((user) => member.guild.members.cache.has(user)).map((user) => ({ id: user, deny: ['CONNECT'] }))
    //     ]
    //   });
    //   member.customVoiceChannel.customOwner = member;
    //   customVoiceChannels.push(member.customVoiceChannel);
    //   member.voice.setChannel(member.customVoiceChannel);
    //   getClient().query('UPDATE public.custom_voice SET "channel" = $2 WHERE "owner" = $1', [member.id, member.customVoiceChannel.id]);
    });
  }
};
