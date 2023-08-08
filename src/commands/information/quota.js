'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders'),
  { stripIndents } = require('common-tags'),
  { MessageEmbed } = require('discord.js'),
  { parseTime, round } = require('../../util/common.js'),
  MarketplacePost = require('../../util/post.js'),
  Ticket = require('../../util/ticket.js'),
  constants = require('../../util/constants.js');

const SCAM_QUOTAS = {
    [constants.TRIAL_SCAM_INVESTIGATOR]: 2,
    [constants.SCAM_INVESTIGATOR]: 2,
  },
  MOD_QUOTAS = {
    [constants.MODERATOR]: 3,
    [constants.SENIOR_MODERATOR]: 3,
    [constants.MODERATION_MANAGEMENT]: 3
  },
  QUOTA_TYPES = {
    mod: {
      name: 'Moderation',
      viewSelf: [...constants.STAFF_ROLES.MODERATOR],
      // test server, Senior, management, mod leader
      viewAll: ['652725589676916763', '394532546542567424', '708779912496021576', '605855715902357535'],
      getRawInfo: async (member, startDate, endDate) => {
        return new Promise((resolve) => {
          const userReports = Ticket.getManaged(member.id, 'user_report', startDate, endDate).size,
            appealReports = Ticket.getManaged(member.id, 'appeal', startDate, endDate).size;

          resolve(
            {
              userReports,
              appealReports,
              quota: Object.entries(MOD_QUOTAS).find(([id]) => member.roles.cache.has(id))?.[1] ?? 0
            }
          );
        });
      },
      getInfo: (member, startDate, endDate) => {
        const userReports = Ticket.getManaged(member.id, 'user_report', startDate, endDate).size,
          appealReports = Ticket.getManaged(member.id, 'appeal', startDate, endDate).size;

        return stripIndents`User report Tickets: \`${userReports}\`
        ${member.roles.cache.has(constants.MODERATION_MANAGEMENT) || member.roles.cache.has(constants.SENIOR_MODERATOR) ? `Appeal Tickets: \`${appealReports}\`` : ''}
        Total: \`${userReports + (member.roles.cache.has(constants.MODERATION_MANAGEMENT) || member.roles.cache.has(constants.SENIOR_MODERATOR) ? appealReports : 0 )}\`/\`${Object.entries(MOD_QUOTAS).find(([id]) => member.roles.cache.has(id))?.[1] ?? 0}\``;
      }
    },
    mp: {
      name: 'Marketplace',
      viewSelf: [...constants.STAFF_ROLES.MARKETPLACE],
      // Test Server, Senior, Leader, Management
      viewAll: ['652673441761067028', '706150965954347029', '706159545063440444', '735947743641600011'],
      getRawInfo: async (member, startDate, endDate) => {
        const posts = await MarketplacePost.getManaged(member.id, startDate, endDate);

        return {
          postsHandled: posts.length,
          quota: MarketplacePost.getManagedQuota(member),
        };
      },
      getInfo: async (member, startDate, endDate) => {
        const posts = await MarketplacePost.getManaged(member.id, startDate, endDate);

        return stripIndents`Posts Handled: \`${posts.length}\`/\`${MarketplacePost.getManagedQuota(member)}\`
          General Tickets: \`${Ticket.getManaged(member.id, 'general', startDate, endDate).size}\`/\`${Ticket.getManagedQuota(member, 'marketplace')}\`
          Approval %: \`${round(posts.filter((post) => post.approved).length / posts.length * 100)}\`
          Denial %: \`${round(posts.filter((post) => !post.approved).length / posts.length * 100)}\``;
      }
    },
    si: {
      name: 'Scam Investigator',
      viewSelf: [...constants.STAFF_ROLES.SCAM_INVESTIGATOR],
      // Test Server, Senior, Leader, Management
      viewAll: ['652673441761067028', '679443527368835073', '654980555850645541', '735947735114579978'],
      getRawInfo: (member, startDate, endDate) => {
        return new Promise((resolve) => {
          resolve(
            {
              ticketsHanded: Ticket.getManaged(member.id, 'scam', startDate, endDate).size,
              quota: Object.entries(SCAM_QUOTAS).find(([id]) => member.roles.cache.has(id))?.[1] ?? 0
            }
          );
        });
      },
      getInfo: (member, startDate, endDate) => {
        return `Scam Tickets: \`${Ticket.getManaged(member.id, 'scam', startDate, endDate).size}\`/\`${Object.entries(SCAM_QUOTAS).find(([id]) => member.roles.cache.has(id))?.[1] ?? 0}\``;
      }
    }
  };

function getLastMonday() {
  const current = new Date(),
    day = current.getDay(),
    previousMonday = new Date();

  if (day === 0) {
    previousMonday.setDate(current.getDate() - 7);
  } else {
    previousMonday.setDate(current.getDate() - (day - 1));
  }

  previousMonday.setUTCHours(0, 0, 0, 0);

  return previousMonday;
}

module.exports = {
  QUOTA_TYPES,
  getLastMonday,
  data: new SlashCommandBuilder()
    .setName('quota')
    .setDescription('Sends quota information about the provided marketplace staff member.')
    .addStringOption((option) =>
      option.setName('quota_category')
        .setDescription('The staff category.')
        .setRequired(true)
        .addChoices({ name: 'mp', value: 'mp' }, { name: 'si', value: 'si' }, { name: 'mod', value: 'mod' }))
    .addUserOption((option) =>
      option.setName('user')
        .setDescription('The user to view.')
        .setRequired(true))
    .addStringOption((option) =>
      option.setName('timeframe')
        .setDescription('The starting time frame to view. Defaults to last monday. ')
        .setRequired(false))
    .addStringOption((option) =>
      option.setName('timeframe_end')
        .setDescription('The ending time frame to view. Defaults to current time.')
        .setRequired(false)),
  exec: async (call) => {
    const category = QUOTA_TYPES[call.interaction.options.getString('quota_category')],
      member = await call.client.HD.members.fetch(call.user.id).catch(() => null);

    if (!member)
      return call.interaction.reply({ content: 'You must be in the Hidden Developers server to use this command.', ephemeral: true });

    if (category.viewSelf.concat(category.viewAll).every((role) => !member.roles.cache.has(role)))
      return call.interaction.reply({ content: 'You do not have permission to view quotas for this role.', ephemeral: true });

    const user = call.interaction.options.getUser('user');

    if (user.id !== call.user.id && category.viewAll.every((role) => !member.roles.cache.has(role)))
      return call.interaction.reply({ content: `You need to be a Senior ${category.name} Member to check other people's quota progress.`, ephemeral: true });

    let startDate = call.interaction.options.getString('timeframe');

    startDate = new Date(startDate).getTime() || Date.now() - (parseTime(startDate) ?? NaN) || getLastMonday().getTime();

    const endDate = new Date(call.interaction.options.getString('timeframe_end')).getTime() || Date.now();

    call.interaction.reply({
      embeds: [
        new MessageEmbed()
          .setColor(call.client.DEFAULT_EMBED_COLOR)
          .setTitle(`${user.username}'s ${category.name} Quotas`)
          .setDescription(await category.getInfo(await call.client.HD.members.fetch(user.id), startDate, endDate))
          .setFooter({ text: `Requested by ${call.user.tag}`, iconURL: call.user.displayAvatarURL() })
      ],
      ephemeral: true
    });
  }
};
