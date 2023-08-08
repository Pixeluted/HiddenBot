'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders'),
  { stripIndents } = require('common-tags'),
  { MessageEmbed } = require('discord.js'),
  { asyncMap, formatDateEmbed, sentenceCase, pastTenseFilter } = require('../../util/common.js'),
  { getClient } = require('../../load/database'),
  ROLES = require('../../util/roles.json'),
  sendPaged = require('../../util/sendPaged'),
  Infractions = require('../../util/infractions'),
  fs = require('fs');

const data = new SlashCommandBuilder()
    .setName('infractions')
    .setDescription('Manages and views infractions.')
    .addSubcommand((subcommand) =>
      subcommand.setName('check')
        .setDescription('Check the infractions of a given user.')
        .addUserOption((option) =>
          option.setName('target')
            .setDescription('The target user.')
            .setRequired(true))
        .addStringOption((option) =>
          option.setName('filter')
            .setDescription('Optional filter for viewing infractions.')
            .setRequired(false)
            .addChoices(...['ban', 'mute', 'kick', 'softban', 'warn', 'all'].map((c) => ({ name: c, value: c }))))),
  options = fs
    .readdirSync(`${__dirname}/infractions-options`)
    .map((name) => {

      try {
        return require(`./infractions-options/${name}`);
      } catch (err) {
        process.emit('logBotError', err);

        return {};
      }
    })
    .filter((o) => o != null),
  NOT_RESTRICTED = [ROLES.INTERN_MOD, ROLES.MOD, ROLES.SENIOR_MOD, ROLES.SCAM_INVESTIGATOR, ROLES.ADMINISTRATOR, ROLES.INTERN_SCAM_INVESTIGATOR, ROLES.DEPARTMENT_HEAD, ROLES.REPRESENTATIVE],
  ALLOWED_ROLES = [...NOT_RESTRICTED, ROLES.MARKETPLACE_STAFF],
  usersNotRestricted = ['118496586299998209', '300816697282002946'];

for (const option of options)
  data.addSubcommand(option.data);

// Bind to client instance
async function formatInfraction(i, index) {
  const evidence = i.reason.match(this.GLOBAL_LINK_REGEX);

  return stripIndents`**[Infraction #${index + 1}](${i.log_url})**
    ID: \`${i.id}\`
    \`${i.mute_type ? `${sentenceCase(i.mute_type)} Mute` : sentenceCase(i.type)}\` - ${formatDateEmbed(i.date)}${i.length ? ` to ${formatDateEmbed(parseInt(i.date) + parseInt(i.length))}` : ''}${i.edit_date ? `\nUpdated Date: **[${formatDateEmbed(parseInt(i.edit_date))}](${i.edit_log_url})**` : ''}
    Reason: **${typeof i.reason === 'string' ? i.reason.replace(/\*/g, '').replace(this.GLOBAL_LINK_REGEX, '').substring(0, 200) : 'None.'}**
    ${evidence ? `Evidence: ${typeof i.reason === 'string' && evidence ? evidence.map((match) => `**[Link](${match})**`).join(', ') : 'None.'}` : ''}
    Moderated by: \`${await this.users.fetch(i.committer).then((u) => (u.id === this.user.id ? 'Auto' : `${u.tag.replace(/`/g, '')} (${u.id})`))}\``.replace(/\n\n/g, '\n');
}

module.exports = {
  data,
  canUse: {
    users: ['118496586299998209', '300816697282002946'],
    roles: [ROLES.MARKETPLACE_STAFF, ROLES.INTERN_MOD, ROLES.MOD, ROLES.SENIOR_MOD, ROLES.SCAM_INVESTIGATOR, ROLES.ADMINISTRATOR, ROLES.INTERN_SCAM_INVESTIGATOR, ROLES.DEPARTMENT_HEAD, ROLES.REPRESENTATIVE],
    cant: 'You do not have permission to run this command.',
  },
  formatInfraction,
  exec: async (call) => {
    const subCommand = options.find((o) => o.data.name === call.interaction.options.getSubcommand().toLowerCase()),
      target = await call.client.users.fetch(call.interaction.options.getUser('target')).catch(() => null),
      member = await call.client.HD.members.fetch(call.interaction.user.id),
      restricted = (m = member, type = NOT_RESTRICTED) => {
        return !usersNotRestricted.includes(m.id) && !m.roles.cache.some((r) => type.includes(r.id));
      };

    // If user attempts to use a subcommand other than check or check other users.
    if ((subCommand || target?.id !== call.interaction.user.id) && restricted(member, ALLOWED_ROLES))
      return call.interaction.reply({ content: 'You do not have permission to use any subcommand but `check` and you may only check yourself.', ephemeral: true });

    if (target) {
      var infractions = Infractions.infractionsOf(target, (call.client.HD ?? call.client.HD ?? call.client.guilds.cache.first()).id);

      await infractions.ready;
    }

    if (subCommand)
      return subCommand.exec(call, infractions, restricted, member);

    if (!target)
      return call.interaction.reply({ content: 'Please provide a valid target for the `/target check` command.', ephemeral: true });

    let filter = call.interaction.options.getString('filter');

    if (restricted(member))
      filter = 'mute';

    const current = filter ? infractions.current.filter((i) => i.type.startsWith(filter)) : infractions.current,
      note = (await getClient().query('SELECT note FROM public.notes WHERE user_id = $1', [target.id]).then((res) => res.rows[0]?.note)) || 'None';

    if (current.length === 0 && note === 'None')
      return call.interaction.reply({ content: `${target.tag} has never been ${filter ? pastTenseFilter(filter) : 'warned, muted, kicked or banned'} in this server by the bot.`, ephemeral: true });

    const embed = new MessageEmbed()
        .setAuthor({ name: `${target.username}'s Infractions`, iconURL: target.displayAvatarURL() })
        .setColor(call.client.DEFAULT_EMBED_COLOR),
      difference = infractions.current.length - current.length;

    if (difference !== 0)
      embed.addField('Hidden Infractions', `\`${difference}\` infraction${difference === 1 ? '' : 's'} are not shown due to filter settings or lack of roles.`);

    call.interaction.reply({ content: `Direct messaging you ${target.username}'s infractions. If you do not receive them, please fix your privacy settings and try again.`, ephemeral: true });

    if (current.length === 0)
      return call.user.send({ embeds: [embed.setDescription(`User Note:\`\`\`\n${note.substring(0, 500)}\n\`\`\`\n`)] });

    sendPaged(call, embed, {
      channel: call.user,
      values: await asyncMap(
        current,
        formatInfraction.bind(call.client)
      ),
      valuesPerPage: 4,
      joinWith: '\n\n',
      startWith: `User Note:\`\`\`\n${note.substring(0, 500)}\n\`\`\`\nNote: If you are on mobile and your infractions are in\ndisarray, please make sure that your Discord application\nis updated.\n\n`
    });
  },
};
