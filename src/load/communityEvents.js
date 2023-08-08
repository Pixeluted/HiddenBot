'use strict';

const { MessageActionRow, MessageButton, MessageEmbed } = require('discord.js'),
  Event = require('../util/communityEvents'),
  Submissions = require('../commands/moderation/submissions'),
  Call = require('../handler/Call.js');

function ifLocal(local, production) {
  return process.env.NODE_ENV === 'production' ? production : local;
}

function prompt(embed, user) {
  return Call.prompt({
    message: {
      embeds: [embed]
    },
    channel: user,
    user,
  }).then((msg) => msg.content);
}
  
const channelNameRegex = /[^a-zA-Z0-9-]/g,
  generalPermissions = [
    { 
      id: ifLocal('652673441761067028', '211228845771063296'), // @everyone
      deny: ['VIEW_CHANNEL', 'ADD_REACTIONS', 'USE_EXTERNAL_EMOJIS']
    },
    {
      id: ifLocal('652725589676916763', '211229166861942784'), // Administrators
      allow: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'ADD_REACTIONS', 'USE_EXTERNAL_EMOJIS', 'MENTION_EVERYONE']
    },
    {
      id: ifLocal('886241312414793729', '605855650940977152'), // Representative Leader
      allow: ['MANAGE_CHANNELS', 'MANAGE_ROLES', 'CONNECT', 'SEND_MESSAGES', 'MUTE_MEMBERS', 'DEAFEN_MEMBERS', 'MOVE_MEMBERS']
    },
    {
      id: ifLocal('886241168428503040', '735947741422813224'), // Representative Management
      allow: ['MANAGE_CHANNELS', 'MANAGE_ROLES', 'CONNECT', 'ADD_REACTIONS', 'USE_EXTERNAL_EMOJIS', 'MUTE_MEMBERS', 'DEAFEN_MEMBERS', 'MOVE_MEMBERS']
    },
    {
      id: ifLocal('886241258660593666', '501484302941552660'), // Senior Representative
      allow: ['MANAGE_CHANNELS', 'MANAGE_ROLES', 'CONNECT']
    },
    {
      id: ifLocal('886241103983018014', '334511990678487050'), // Representatives
      allow: ['MANAGE_CHANNELS', 'MANAGE_ROLES', 'CONNECT', 'VIEW_CHANNEL', 'SEND_MESSAGES', 'ADD_REACTIONS', 'USE_EXTERNAL_EMOJIS', 'MENTION_EVERYONE', 'EMBED_LINKS', 'ATTACH_FILES', 'MANAGE_MESSAGES', 'MUTE_MEMBERS', 'DEAFEN_MEMBERS', 'MOVE_MEMBERS']
    },
    {
      id: ifLocal('886241026136752129', '429114417461067778'), // Trial Representatives
      allow: ['VIEW_CHANNEL', 'CONNECT', 'SEND_MESSAGES', 'ADD_REACTIONS', 'USE_EXTERNAL_EMOJIS', 'MENTION_EVERYONE', 'MUTE_MEMBERS', 'DEAFEN_MEMBERS', 'MOVE_MEMBERS']
    },
    {
      id: ifLocal('869541972149428264', '674423522101297180'), // HD Verification
      deny: ['SEND_MESSAGES', 'ADD_REACTIONS', 'CONNECT'],
      allow: ['READ_MESSAGE_HISTORY']
    },
    {
      id: ifLocal('652725429152645130', '429731086600503296'), // Server Mute
      deny: ['SEND_MESSAGES', 'CONNECT']
    },
    {
      id: ifLocal('652725486849622056', '679085521775099925'), // Events Mute
      deny: ['SEND_MESSAGES', 'CONNECT']
    },
  ],

  deleteButton = (channelId) => { 
    return new MessageButton()
      .setCustomId(`delete_channels_${channelId}`)
      .setLabel('Delete Channels')
      .setStyle('DANGER');
  };

module.exports = {
  id: 'events',
  updateChannel: async function(channelId, type) {
    const event = await Event.getEvent(channelId),
      channel = await this.client.channels.fetch(event.channel),
      channel2 = event.channel2 ? await this.client.channels.fetch(event.channel2) : null;
    
    if (!channel || !channel2) return this.interaction.reply({ content: 'One of the channels have been deleted and therefore cannot be updated. Please click the "Delete Channels" button to delete all related to this event.', ephemeral: true });
    
    if (type === 'viewable') {
      await channel?.permissionOverwrites.edit(ifLocal('869541972149428264', '674423522101297180'), { VIEW_CHANNEL: true });
      await channel2?.permissionOverwrites.edit(ifLocal('869541972149428264', '674423522101297180'), { VIEW_CHANNEL: true });
      
      const button = new MessageButton()
          .setCustomId(`open_channel_${channelId}`)
          .setLabel(`Open ${event.event_type === 'Text' ? 'Submissions' : 'Voice Channel'}`)
          .setStyle('SUCCESS'),
        embed = new MessageEmbed(this.interaction.message.embeds[0]).setColor('BLUE'),
        component = event.event_type === 'Announcement' ? new MessageActionRow().addComponents(deleteButton(channelId)) : new MessageActionRow().addComponents(button, deleteButton(channelId));

      await this.interaction.message.edit({
        embeds: [embed],
        components: [component]
      });
      await this.interaction.reply({ content: `The channel${event.event_type === 'Announcement' ? ' has' :'s have'} successfully been made viewable to the public.`, ephemeral: true });
    } else if (type === 'open') {
      await channel2?.permissionOverwrites.edit(ifLocal('869541972149428264', '674423522101297180'), { SEND_MESSAGES: null, CONNECT: null });

      const embed = new MessageEmbed(this.interaction.message.embeds[0]).setColor('GREEN');

      await this.interaction.message.edit({
        embeds: [embed],
        components: [ 
          new MessageActionRow().addComponents(
            new MessageButton()
              .setCustomId(`close_channel_${channelId}`)
              .setLabel(`Close ${event.event_type === 'Text' ? 'Submissions' : 'Voice Channel'}`)
              .setStyle('DANGER'),
            deleteButton(channelId)
          ) 
        ]
      }).then(() => Event.updatechannel2(channel2?.id, true));
      await this.interaction.reply({ content: `The ${event.event_type === 'Text' ? 'submission' : 'voice'} channel has been opened to ${event.event_type === 'Text' ? 'send submissions in' : 'connect to'}.`, ephemeral: true });
    } else if (type === 'close') {
      await channel2?.permissionOverwrites.edit(ifLocal('869541972149428264', '674423522101297180'), { SEND_MESSAGES: false, CONNECT: false });

      const embed = new MessageEmbed(this.interaction.message.embeds[0]).setColor('RED');

      await this.interaction.message.edit({
        embeds: [embed],
        components: [ 
          new MessageActionRow().addComponents(
            new MessageButton()
              .setCustomId(`make_channel_invisible_${channelId}`)
              .setLabel(`Make ${event.event_type === 'Text' ? 'Submissions' : 'Voice'} Channel Invisible`)
              .setStyle('SECONDARY'),
            deleteButton(channelId)
          ) 
        ]
      }).then(() => Event.updatechannel2(channel2?.id, false));
      await this.interaction.reply({ content: `The ${event.event_type === 'Text' ? 'submission' : 'voice'} channel has been closed, preventing users from ${event.event_type === 'Text' ? 'sending submissions' : 'connecting'}.`, ephemeral: true });
    } else if (type === 'invisible') {
      await channel2?.permissionOverwrites.edit(ifLocal('869541972149428264', '674423522101297180'), { VIEW_CHANNEL: null });

      const embed = new MessageEmbed(this.interaction.message.embeds[0]).setColor('RED');

      await this.interaction.message.edit({
        embeds: [embed],
        components: [new MessageActionRow().addComponents(deleteButton(channelId))]
      });
      await this.interaction.reply({ content: `The ${event.event_type === 'Text' ? 'submission' : 'voice'} channel has been made invisible to the community.`, ephemeral: true });
    }
  },
  makeViewable: async function(channelId) {
    await this.updateChannel(channelId, 'viewable');
  },
  openChannel: async function(channelId) {
    await this.updateChannel(channelId, 'open');
  },
  closeChannel: async function(channelId) {
    await this.updateChannel(channelId, 'close');
  },
  makeInvisible: async function(channelId) {
    await this.updateChannel(channelId, 'invisible');
  },
  deleteChannels: async function(channelId) {
    const event = await Event.getEvent(channelId),

      channel = await this.client.channels.fetch(event.channel).catch(() => null),

      channel2 = event.channel2 ? await this.client.channels.fetch(event.channel2).catch(() => null) : null;

    await channel?.delete({ reason: 'Event is over' }).catch(() => null);
    await channel2?.delete({ reason: 'Event is over' }).catch(() => null);
    await Event.removeEvent(event.id, event.channel);
    await this.interaction.reply({ content: `The channel${channel2 ? 's have' : ' has'} been deleted successfully.`, ephemeral: true });
    await this.interaction.message.delete({ reason: 'Event is over' });
  },
  createEventMsg: function(eventId, channel, user, type, channel2) {
    const embed = new MessageEmbed()
      .setTitle(`${type === 'Announcement' ? 'Community' : type === 'Voice' ? 'Voice' : 'Submission'}-Based Event`)
      .addField('Id', `${eventId}`)
      .addField(channel2 ? 'Announcement Channel Name' : 'Channel Name', `${channel.toString()} - (${channel.id})`)
      .setColor('RED')
      .setFooter({ text: `${user.tag} (${user.id})`, iconURL: user.displayAvatarURL({ dynamic: true }) });

    if (channel2) embed.addField(`${type} Channel Name`, `${channel2.toString()} - (${channel2.id})`);

    this.eventChannel?.send({ 
      embeds: [embed],
      components: [
        new MessageActionRow().addComponents(
          new MessageButton()
            .setCustomId(`make_viewable_${channel.id}`)
            .setLabel(`Make ${type} Channel Viewable`)
            .setStyle('SUCCESS'),
          deleteButton(channel.id)
        )
      ]
    }).then((msg) => user.send({ content: `The ${channel2 ? 'channels have' : 'channel has'} been created successfully.\n Refer to the following link to control your event channel${channel2 ? 's' : ''}.\n🔗 ${msg.url}` }));
  },
  createChannel: function(channelName, voice = false) {
    return this.client.HD?.channels.create(channelName, {
      type: voice ? 'GUILD_VOICE' : 'GUILD_TEXT',
      parent: this.client[`${voice ? 'VOICE_' : ''}EVENTS_CATEGORY`],
      permissionOverwrites: generalPermissions,
      reason: `Event channel creation - ${this.interaction.user.tag} (${this.interaction.user.id})`
    });
  },
  createBothText: async function(annChannelName, subChannelName) {
    const { user } = this.interaction,

      annChannel = await this.createChannel(annChannelName),

      subChannel = await this.createChannel(subChannelName);

    await Submissions.exec(
      new Call(
        { client: this.client, author: this.interaction.user, channel: this.interaction.channel, guild: this.client.HD, delete: () => { } },
        Submissions,
        Call.commands,
        subChannel.id,
        [subChannel.id],
      )
    );

    await Event.incrementId(this.client.HD?.id);
    const eventId = await Event.getLastId(this.client.HD?.id);

    await Event.addEvent('Text', eventId, annChannel.id, user.id, subChannel.id).then(async () => {
      this.createEventMsg(eventId, annChannel, user, 'Submission', subChannel);
    });
  },
  createAnnouncement: async function(channelName) {
    const { user } = this.interaction,

      annChannel = await this.createChannel(channelName);

    await Event.incrementId(this.client.HD?.id);
    const eventId = await Event.getLastId(this.client.HD?.id);

    await Event.addEvent('Announcement', eventId, annChannel.id, user.id).then(async () => {
      this.createEventMsg(eventId, annChannel, user, 'Announcement');
    });
  },
  // createSubmissions: async (channelName) => {},
  createBothVC: async function(channelName, vcChannelName) { // create both an announcements text channel and a vc channel
    const { user } = this.interaction,

      annChannel = await this.createChannel(channelName),

      vcChannel = await this.createChannel(vcChannelName, true);

    await Event.incrementId(this.client.HD?.id);
    const eventId = await Event.getLastId(this.client.HD?.id);

    await Event.addEvent('VC', eventId, annChannel.id, user.id, vcChannel.id).then(async () => {
      this.createEventMsg(eventId, annChannel, user, 'Voice', vcChannel);
    });
  },
  createText: async function(channelName) {
    await this.createChannel(channelName).then(() => this.interaction.user.send({ content: 'The channel has been created successfully.' }));
  },
  createVC: async function(channelName) {
    await this.createChannel(channelName, true).then(() => this.interaction.user.send({ content: 'The channel has been created successfully.' }));
  },
  exec: async function(client) {
    client.on('interactionCreate', async (interaction) => {
      if (interaction.channelId !== client.EVENTS_MANAGEMENT_CHANNEL || !interaction.isButton()) return;

      const eventChannel = client.channels.cache.get(client.EVENTS_MANAGEMENT_CHANNEL),

        options = [
          { name: 'create_event_both_text', funcName: 'createBothText' },
          { name: 'create_event_announcement', funcName: 'createAnnouncement' },
          { name: 'create_event_both_vc', funcName: 'createBothVC' },
          { name: 'create_event_text_only', funcName: 'createText' },
          { name: 'create_event_vc_only', funcName: 'createVC' },
          { name: 'make_viewable_', funcName: 'makeViewable', prompt: false },
          { name: 'open_channel_', funcName: 'openChannel', prompt: false },
          { name: 'close_channel_', funcName: 'closeChannel', prompt: false },
          { name: 'delete_channels_', funcName: 'deleteChannels', prompt: false },
          { name: 'make_channel_invisible_', funcName: 'makeInvisible', prompt: false },
        ];

      this.client = client;
      this.interaction = interaction;
      this.eventChannel = eventChannel;

      const { user } = interaction,

        option = options.find((o) => o.name === interaction.customId || interaction.customId.startsWith(o.name));

      if (option && option.prompt === false) {
        if (interaction.message.embeds[0].footer.text.match(/\((\d+)\)/)[1] !== user.id) return interaction.reply({ content: 'You are not the creator of this event.', ephemeral: true });
        
        return this[option.funcName](interaction.customId.replace(/\D/g, ''));
      }
      
      const embed = new MessageEmbed()
          .setTitle('Prompt')
          .setDescription(`Please provide the name of the ${option.name === 'create_event_both_text' || option.name === 'create_event_both_vc' ? 'announcements ' : ''}channel.`)
          .setFooter({ text: 'This prompt will end in 3 minutes.' })
          .setColor(client.DEFAULT_EMBED_COLOR),

        channelName = (await prompt(embed, user))?.replace(channelNameRegex, '-');

      if (!channelName) return user.send({ content: 'The channel has not been created due to you not providing a channel name.' });

      if (option.name === 'create_event_both_text' || option.name === 'create_event_both_vc') {
        embed.setDescription(`Please provide the name of the ${option.name === 'create_event_both_text' ? 'submissions channel' : 'voice channel'}.`);
        const channelName2 = (await prompt(embed, user))?.replace(channelNameRegex, '-');

        if (!channelName2) return user.send({ content: 'The channel has not been created due to you not providing a channel name.' });

        return this[option.funcName](channelName, channelName2);
      }

      this[(option.funcName)](channelName);
    });
  } 
};