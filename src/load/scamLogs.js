'use strict';

const buttons = require('./buttons'),
  { fetchRobloxIdFromRover, fetchRobloxIdFromBloxlink, asyncMap } = require('../util/common'),
  { MessageActionRow, MessageButton, MessageEmbed } = require('discord.js'),
  DEVS = ['118496586299998209', '269926271633326082'],
  fetch = require('node-fetch');

async function getRobloxUserIds(userIds) {
  // eslint-disable-next-line no-return-await
  return (await asyncMap(userIds, async (id) => await fetchRobloxIdFromRover(id) || await fetchRobloxIdFromBloxlink(id)))
    .filter((id) => id);
}

function extractInformation(message) {
  const evidence = [],
    msgArr = [];

  for (const link of message.content.replace(/\n*```\n*/g, '').split('\n'))
    (message.client.URL_REGEX.test(link) ? evidence : msgArr).push(link);

  const logValues = msgArr.map((str) => str.replace(/.+?:\s*/, '')),
    userIds = logValues[0].match(/\d+/g),
    rbxUserIds = logValues[1].match(/\d+/g),
    length = logValues[3],
    reason = logValues[4];

  // Sets userIds to ['🚨 **ERROR!**'] if invalid.
  if (isNaN(userIds[0]))
    userIds.splice(0, userIds.length, '🚨 **ERROR!**');

  return { 
    userIds,
    rbxUserIds,
    evidence,
    length,
    reason,
  };
}

function makeComponents(message) {
  return [
    new MessageActionRow().addComponents(
      new MessageButton().setLabel('Approve').setStyle('SUCCESS').setCustomId('scam_log_approve'), 
      new MessageButton().setLabel(`${message.author.tag} - (${message.author.id})`).setStyle('SECONDARY').setCustomId('ban_log_creator').setDisabled(true),
    )
  ];
}

function changeDisabledComponent(message, id, disabled, label, style) {
  return [
    new MessageActionRow().addComponents(
      message.components[0].components.map((component) => {
        component = new MessageButton(component);

        if (component.customId === id || id.includes?.(component.customId)) {
          component.setLabel(label ? label : component.label);
          component.setDisabled(disabled);
          component.setStyle(style ? style : component.style);
        }

        return component;
      })
    )
  ];
}

module.exports = {
  id: 'scam_logs',
  exec: (client) => {
    client
      .on('messageCreate', async (message) => {
        if (message.author.bot || message.channel.id !== client.BAN_LOGS_CHANNEL || !message.content?.startsWith('```')) return;

        await message.channel.send({ content: message.content, components: makeComponents(message) });
        message.delete();
      })
      .on('interactionCreate', async (interaction) => {
        const { member, message } = interaction;

        if (interaction.customId === 'scam_log_approve') {
          if (!member.roles.cache.has(client.STAFF_GUILD_ROLES.SENIOR_SCAM_INVESTIGATOR) && !DEVS.includes(member.id)) 
            return interaction.reply({ content: 'You do not have permission to run this command.', ephemeral: true });
          
          await interaction.update({ components: changeDisabledComponent(message, 'scam_log_approve', true) });

          let { userIds, rbxUserIds, evidence, reason } = extractInformation(message);

          if (!rbxUserIds)
            rbxUserIds = await getRobloxUserIds(userIds);

          const fields = [
              { name: 'User Id(s)', value: userIds.join('\n') },
              { name: 'Roblox UserId(s)', value: rbxUserIds.length ? rbxUserIds.join('\n') : 'N/A' },
              { name: 'Evidence', value: evidence.join('\n') },
              { name: 'Reason', value: reason }
            ],
            embed = new MessageEmbed()
              .setColor(userIds[0] === '🚨 **ERROR!**' || rbxUserIds[0] === '🚨 **ERROR!**' ? 'RED' : 'ORANGE')
              .setTitle('Add Scam Log Confirmation')
              .addFields(...fields)
              .setFooter({ text: 'This prompt will automatically cancel in 2 minutes.' }),
            confirmation = await buttons.createButtonPrompt(
              await member.send({
                content: 'This is the confirmation of your addition.\nClick `Confirm` to send the log to the scam logs on the website. Else, click `Cancel` to end this prompt.',
                embeds: [embed],
                components: [
                  new MessageActionRow().addComponents(
                    new MessageButton().setLabel('Confirm').setStyle('SUCCESS').setCustomId('scam_log_confirm'),
                    new MessageButton().setLabel('Cancel').setStyle('DANGER').setCustomId('scam_log_cancel')
                  )
                ]
              })
            ).next();

          if (confirmation?.customId === 'scam_log_cancel') {
            await message.edit({ components: changeDisabledComponent(message, 'scam_log_approve', false) });
            await confirmation.message.edit({ components: [] });

            return confirmation.reply('Cancelled Prompt.');
          }
        
          const info = JSON.stringify({
              discord_ids: userIds,
              roblox_ids: rbxUserIds,
              evidence: evidence.map((link) => encodeURIComponent(link)),
              reason: encodeURIComponent(reason),
              staff_member: message.components[0].components[1].label.match(/\((\d+)\)/)[1],
            }),
            res = await fetch(`https://hiddendevs.com/api/discordbot?key=${process.env.OUTWARDS_API_KEY}&action=scamlog_upload&value=${info}`, { method: 'POST' });

          if (!res.ok) {
            console.log(info, res.status);
            await message.edit({ components: changeDisabledComponent(message, 'scam_log_approve', false) });
            await confirmation.message.edit({ components: [] });

            return confirmation.reply('An error occurred. Please report this to one of the developers.');
          }

          await message.edit({ components: changeDisabledComponent(message, 'scam_log_approve', true, 'Approved', 'SECONDARY') });
          await confirmation.message.edit({ components: [] });
          await confirmation.reply('The scam log has been uploaded successfully.');
          await client.channels.cache.get(client.BOT_LOGS_CHANNEL)?.send({ embeds: [
            new MessageEmbed()
              .addFields(...fields)
              .setAuthor({ name: 'Scam Log Added', iconURL: client.ADDED_EVENT_IMAGE, url: message.url })
              .setColor('GREEN')
              .setFooter({ text: `Approved by ${member.id}`, iconURL: member.user.displayAvatarURL({ dynamic: true }) })
          ] });
        }
      });
  },
};
