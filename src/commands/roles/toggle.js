'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders'),
  { MessageEmbed, CommandInteraction } = require('discord.js'),
  prettyMS = require('pretty-ms'),
  fetch = require('node-fetch'),
  { fetchRoblox } = require('../../load/webVerification.js'),
  { EMOJIS, updateNickname } = require('../utility/nickname.js'),
  { isEphemeralChannel } = require('../../util/common');

let index = 0;

const ROLES = {
    /*Staff:  [
		{
			index: ++index,
			name: 'ONLINE',
			exec: (guild, member, channel) => {
				for (let [name, roles] of Object.entries(guild.client.STAFF_ROLES))
					if (member.roles.cache.some((role) => roles.includes(role.id)))
						return guild.client.STAFF_ONLINE_ROLES[name];

				return channel.send('Only staff can toggle this role.');
			}
		}
	],*/
    Roles: [
      {
        index: ++index,
        name: 'HIREABLE',
        exec: async (_guild, member, _channel) => {
          const hireableCurrent = member.roles.cache.has(member.client.HIREABLE);

          // Remove previous hireable roles
          await member.roles.remove([member.client.HIREABLE, member.client.NOT_HIREABLE]);

          return hireableCurrent ? member.client.NOT_HIREABLE : member.client.HIREABLE;
        }
      },
      {
        index: ++index,
        name: 'DEVFORUM',
        exec: async (guild, member, channel) => {
          const info = await fetchRoblox(member.id);

          if (!info) return channel.send('Please link your Discord and Roblox account to your <https://hiddendevs.com> account in order to toggle this role.');

          return fetch(`https://devforum.roblox.com/users/${await guild.client.getRobloxNameFromId(info)}.json`)
            .then((res) => res.json())
            .then(
              async (res) => {
                if (!res || !res.user || !res.user.trust_level)
                  return channel.send(
                    'You are not a devforum member. If you are a devforum member, make sure that your account profile is not private. Developer Forum URL: https://devforum.roblox.com/.'
                  );

                const trustLevel = res.user.trust_level,
                  type = trustLevel > 1 ? 'Full' : 'New';

                return type === 'Full' ? '268486214103990282' : '542595520875593728';
              },
              () => channel.send('Something went wrong when checking whether or not you were a devforum member, please try again.')
            );
        },
      },
      {
        index: ++index,
        name: 'INTERN',
        exec: async (_guild, member, channel) => {
          // eslint-disable-line no-unused-vars
          const info = await fetchRoblox(member.id);

          if (!info) return channel.send('Please link your Discord and Roblox account to your <https://hiddendevs.com> account in order to toggle this role.');

          fetch(`http://api.roblox.com/users/${info}/groups`)
            .then((res) => res.json())
            .then(
              async (res) => {
                if (!res || !Array.isArray(res) || res.every((g) => g.Id !== 2868472)) return channel.send('You are not in the Roblox Interns group.');

                const role = res.find((g) => g.Id === 2868472).Role;

                return {
                  'Former Accelerator': '626465308156362752',
                  'Former Incubator': '626465301776564247',
                  'Former Intern': '626465307380154371',
                  Accelerator: '626465305643974669',
                  Incubator: '626465308751691791',
                  Intern: '626465172575354911',
                }[role];
              },
              () => channel.send('Something went wrong when checking whether or not you were an intern, please try again.')
            );
        },
      },
      { index: ++index, name: 'MARKETPLACE ACCESS', id: '865615416487706635' },
    ],
    Nicknames: Object.entries(EMOJIS).map(([emoji, roles]) => ({
      index: ++index,
      name: emoji,
      notRole: true,
      exec: async (_guild, member, channel) => {
        if (!member.roles.cache.some((role) => roles.includes(role.id))) return channel.send('You do not have the role required to toggle this emoji.');

        const newNickname = await updateNickname(member, member.displayName, emoji);

        if (member.displayName !== newNickname)
          member.setNickname(newNickname);

        channel.send(queueResponse('done', { name: emoji }, !member.displayName?.includes(emoji), false));
      }
    })),
    Notifications: [
      { index: ++index, name: 'NEWSPING', id: '558038218193502209' },
      { index: ++index, name: 'EVENTSPING', id: '621872590415462414' },
      { index: ++index, name: 'GIVEAWAYPING', id: '535221681002905621' },
      { index: ++index, name: 'MEDIAPING', id: '621872601626574893' },
      { index: ++index, name: 'HIGHLIGHTPING', id: '690236976913580040' },
      { index: ++index, name: 'POLLPING', id: '865615416487706635' },
    ],
    Interests: [
      { index: ++index, name: 'SOUND EFFECTS', id: '740532835735044146' },
      { index: ++index, name: 'MUSIC COMPOSITION', id: '740532816818995290' },
      { index: ++index, name: 'VOICE ACTING', id: '740532826558038026' },
      { index: ++index, name: 'VIDEO EDITING', id: '740532820484685874' },
      { index: ++index, name: 'BUILDING', id: '740532827866792007' },
      { index: ++index, name: 'MODELLING', id: '740532829988847617' },
      { index: ++index, name: 'ANIMATING', id: '740532832782516264' },
      { index: ++index, name: 'GRAPHICS', id: '740532844891340854' },
      { index: ++index, name: 'USER INTERFACE', id: '740532842659971144' },
      { index: ++index, name: 'TEXTURE ART', id: '740532841011478578' },
      { index: ++index, name: 'VISUAL EFFECTS', id: '740532869830541393' },
      { index: ++index, name: 'CLOTHING', id: '740532838037717014' },
      { index: ++index, name: 'PROGRAMMING', id: '740532858506182728' },
      { index: ++index, name: 'TRANSLATING', id: '740532861089742958' },
      { index: ++index, name: 'BOT DEVELOPMENT', id: '740532856660688917' },
      { index: ++index, name: 'WEB DEVELOPMENT', id: '740532865384579072' },
      { index: ++index, name: 'GAME DESIGNING', id: '740532863367381084' },
      { index: ++index, name: 'PROJECT MANAGEMENT', id: '740532867360096291' },
      { index: ++index, name: 'QA TESTING', id: '971198567215669379' },
    ],
  },
  QUEUE_WAIT = 7500,
  queue = [];

function getRole(name) {
  name = name.toString().toUpperCase();

  let role;

  for (const category of Object.values(ROLES)) {
    role = category.find((r) => r.name === name || r.index.toString() === name);

    if (role) return role;
  }

  return null;
}

function queueResponse(res, role, add, isRole) {
  return res === 'done'
    ? `Successfully ${add && isRole ? 'added you to' : add && !isRole ? 'added' : !isRole ? 'removed' : 'removed you from'} the ${role.name} ${isRole ? 'role' : add && !isRole ? 'to your nickname' : 'from your nickname'}.`
    : `You have been queued ${add ? 'for' : 'to remove'} the ${role.name} role. Expected wait time: ${prettyMS(queue.length * QUEUE_WAIT, { compact: true, verbose: true })}`;
}

function removeItem(value) {
  const index = queue.indexOf(value);

  if (index > -1)
    queue.splice(index, 1);
}

function makeFunc(type) {
  return async (member, role) => {
    const value = { member, role, type };

    queue.push(value);

    if (queue.length <= 2) {
      await member.roles[type](role).catch(() => { });

      removeItem(value);

      return 'done';
    } else {
      return 'queued';
    }
  };
}

const queueAdd = makeFunc('add'),
  queueRemove = makeFunc('remove');

async function wait(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

async function addRole(guild, member, channel, role) {
  const isInteraction = channel instanceof CommandInteraction;

  if (!channel)
    channel = await member.createDM();

  const id = role.id ?? await role.exec(guild, member, isInteraction ? channel.channel : channel);

  if (role.notRole)
    return;

  if (!id || !/^\d+$/.test(id))
    return;

  if (!guild.roles.cache.has(id))
    return isInteraction ?
      channel.reply({ content: 'Failed to find the role in this server.', ephemeral: true }) :
      channel.send('Failed to find the role in this server.');

  const add = !member.roles.cache.has(id);

  (add ? queueAdd : queueRemove)(member, id)
    .then((res) => isInteraction ? channel.reply(queueResponse(res, role, add, true)) : channel.send(queueResponse(res, role, add, true)));
}

(async () => {
  do {
    const next = queue[0];

    if (!next) {
      await wait(QUEUE_WAIT);

      continue;
    }

    if (!next.member?.roles) {
      removeItem(next);

      continue;
    }

    if (next.type === 'add')
      await next.member.roles.add(next.role).catch((err) => process.emit('logBotError', err));
    else
      await next.member.roles.remove(next.role).catch((err) => process.emit('logBotError', err));

    removeItem(next);

    await wait(QUEUE_WAIT);

    // eslint-disable-next-line no-constant-condition
  } while (true);
})();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('toggle')
    .setDescription('Toggles a role.')
    .setDMPermission(false)
    .addStringOption((option) =>
      option.setName('role')
        .setDescription('The role to toggle. Ignore this argument to view a list of roles.')
        .setRequired(true)
        .setAutocomplete(true)),
  ROLES,
  getRole,
  addRole,
  autocomplete: (interaction) => {
    const value = interaction.options.getFocused();

    interaction.respond([
      { name: 'List of Roles', value: 'list' },
      ...Object.values(ROLES)
        .flat()
        .filter((role) => role.index === value || role.name.toLowerCase().startsWith(value.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((role) => ({ name: role.name, value: role.index.toString() }))
        .slice(0, 24)
    ]);
  },
  exec: async (call) => {
    const place = queue.findIndex((item) => item.member?.id === call.user.id);

    if (place > -1)
      return call.interaction.reply({ content: `You are already in the queue for a role, please wait ${prettyMS((place + 1) * QUEUE_WAIT, { compact: true, verbose: true })} before attempting to toggle another role.`, ephemeral: true });

    let role = call.interaction.options.getString('role');

    if (role === 'list') {
      const embed = new MessageEmbed().setColor(call.client.DEFAULT_EMBED_COLOR).setTitle('Toggleable Roles');

      embed.fields = Object.entries(ROLES).map(([name, roles]) => ({ name: `${name.replace(/_/g, ' ')}:`, value: roles.map((role) => `${role.index}. \`${role.name}\``).join('\n') }));

      return call.interaction.reply({ embeds: [embed], ephemeral: isEphemeralChannel(call.interaction) });
    }

    role = getRole(role);

    if (!role)
      return call.interaction.reply({ content: 'Please rerun the command and specify a valid role to toggle. For a list of roles, provide list for the `role` option.', ephemeral: true });

    addRole(call.interaction.guild, call.member, call.interaction, role);
  },
};
