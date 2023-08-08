'use strict';

const { MessageEmbed, MessageActionRow, MessageButton, MessageSelectMenu, Client } = require('discord.js'),
  express = require('express'),
  fetch = require('node-fetch'),
  buttons = require('./buttons.js'),
  { titleCase } = require('../util/common.js'),
  constants = require('../util/constants.js'),
  { QUOTA_TYPES, getLastMonday }= require('../commands/information/quota'),
  { parseTime } = require('../util/common');

const PORT = process.env.PORT ?? 3000,
  ADDRESS = process.env.NODE_ENV === 'production' ? 'https://hidden-bot-discord.herokuapp.com' : `http://localhost:${PORT}`;

function fetchRoblox(discordId) {
  return new Promise((resolve, reject) => {
    fetch(
      `https://hiddendevs.com/api/discordbot?action=roblox&key=${process.env.OUTWARDS_API_KEY}&value=${discordId}`,
      {
        method: 'get',
      }
    )
      .then((res) => res.json())
      .then((data) => {
        const robloxData = data[discordId];

        resolve(robloxData?.roblox_id ?? null);
      })
      .catch((err) => reject(err));
    setTimeout(() => reject(new Error('Website did not respond.')), 2500);
  });
}

// Deprecated database function
// function fetchRoblox(discordId) {
//   return new Promise((resolve, reject) => {
//     getWebClient().query(`SELECT roblox_id FROM users WHERE discord_id = ${discordId}`, (err, res) => {
//       if (err) return reject(err);
//
//       resolve(res[0]?.roblox_id);
//     });
//
//     setTimeout(() => reject(new Error('Database did not respond.')), 2500);
//   });
// }


// Deprecated since it's not used
// function fetchDiscord(robloxId) {
//   return new Promise((resolve, reject) => {
//     getWebClient().query(`SELECT discord_id FROM users WHERE roblox_id = ${robloxId}`, (err, res) => {
//       if (err) return reject(err);
//
//       resolve(res[0]?.discord_id);
//     });
//   });
// }

async function agreeRules(user) {
  // try...catch to still add roles if anything goes wrong (e.g. can't dm user, user doesn't answer prompt)
  try {
    const embed = new MessageEmbed()
      .setColor(user.client.INVISIBLE_COLOR)
      .setTitle('Welcome')
      .setDescription(`Welcome to Hidden Developers! Before being verified, please take a look at our server rules: <#641035242643259392>

	By clicking on the button below, you acknowledge that you have read and agree to our rules.`);

    var msg = await user.send({
      embeds: [embed],
      components: [new MessageActionRow().addComponents(new MessageButton().setCustomId('rules_next').setLabel('Agree').setStyle('PRIMARY'))],
    });

    const prompt = buttons.createButtonPrompt(msg);

    await prompt.next().then((input) =>
      input.reply(`Thanks! You now have access to our server. Please check out our additional information channels to gain information about other areas in our discord:
<#438638265051119616>
<#407653489980735488>
<#660913475366682635>

The messages following this one will help set your roles up in the server.

> **NOTE:** If you do not receive the \`HD Verification\` discord role, please click the button attached to this message: https://discord.com/channels/211228845771063296/678252217681051669/876267428731043900`)
    );
    prompt.delete();
  } catch (err) {
    if (err.message === 'Prompt ended: time') {
      msg?.edit({
        embeds: [new MessageEmbed(msg.embeds[0]).setDescription(`${msg.embeds[0].description}\n\nThe time for you to continue this prompt has run out. Please click the button attached to this message: https://discord.com/channels/211228845771063296/678252217681051669/876267428731043900`)],
        components: [new MessageActionRow().addComponents(new MessageButton().setCustomId('rules_next').setLabel('Agree').setStyle('PRIMARY').setDisabled(true))]
      });
    }

    return;
  }
}

async function tutorial(user) {
  const member = await user.client.HD.members.fetch(user.id),
    prompt2 = buttons.createButtonPrompt(
      await user.send({
        embeds: [
          new MessageEmbed()
            .setColor(user.client.INVISIBLE_COLOR)
            .setTitle('Role Selection')
            .setDescription('What is your current hireable status?')
            .setFooter({ text: 'If you get the "This interaction failed" error message, iconURL: it means you took too long to respond. Don\'t worry, you can still get your hireable role using `/toggle role:hireable`.' }),
        ],
        components: [
          new MessageActionRow().addComponents(
            new MessageButton().setCustomId('tutorial_hireable').setLabel('Hireable').setStyle('SUCCESS'),
            new MessageButton().setCustomId('tutorial_not_hireable').setLabel('Not Hireable').setStyle('SUCCESS')
          ),
        ],
      })
    );

  await prompt2.next().then((input) => {
    input.reply(`Gave you the \`${input.customId === 'tutorial_hireable' ? 'Hireable' : 'Not Hireable'}\` in Hidden Developers.`);
    member.roles.add(input.customId === 'tutorial_hireable' ? user.client.HIREABLE : user.client.NOT_HIREABLE);
  });

  prompt2.delete();

  await new Promise((resolve) => setTimeout(resolve, 2000));

  const menu = new MessageSelectMenu().setCustomId('interest_menu').setPlaceholder('Click here to add interest roles!');

  for (const interest of require('../commands/roles/toggle.js').ROLES.Interests) {
    menu.addOptions({
      label: titleCase(interest.name),
      value: interest.id,
    });
  }

  const prompt3 = buttons.createButtonPrompt(
    await user.send({
      embeds: [
        new MessageEmbed()
          .setColor(user.client.INVISIBLE_COLOR)
          .setTitle('Role Selection')
          .setDescription('Open down the drop down prompt and select any interest roles that you desire.')
          .setFooter({ text: 'If you get the "This interaction failed" error message, iconURL: it means you took too long to respond. Don\'t worry, you can still get your hireable role using the `/toggle` command.' }),
      ],
      components: [new MessageActionRow().addComponents(menu)],
    })
  );

  prompt3.on('click', (input) => {
    const role = user.client.HD.roles.cache.get(input.values[0]);

    if (!role) return input.reply('Failed to find the interest role.');

    if (member.roles.cache.has(role.id)) member.roles.remove(role).then(() => input.reply(`Successfully removed you from the \`${role.name}\` interest role.`));
    else member.roles.add(role).then(() => input.reply(`Successfully added you to the \`${role.name}\` interest role.`));
  });
}

if (process.env.NODE_ENV === 'production') {
  var roleClient = new Client({
    intents: [
      'GUILDS',
      'GUILD_MEMBERS',
      'GUILD_INTEGRATIONS',
      'GUILD_WEBHOOKS'
    ],
    presence: { status: 'invisible' }
  });

  roleClient
    .once('ready', () => {
      console.log(`${roleClient.user.username} has successfully launched`);
    })
    .on('role', async (member, action = 'add') => {
      if (!member.id)
        return;

      const roleMember = await roleClient.guilds.cache
        .get(constants.HD_GUILD).members
        .fetch(member.id)
        .catch(() => null);

      if (!roleMember || roleMember.roles.cache.has(constants.DISCORD_VERIFIED))
        return;

      if (action === 'add')
        await roleMember.roles
          .add([...constants.VERIFIED_ROLES, constants.DISCORD_VERIFIED].filter((r) => !roleMember.roles.cache.has(r)))
          .catch(() => roleMember.send('Failed to add you to the verified role. '));
      else if (action === 'remove')
        await roleMember.roles.remove(constants.DISCORD_VERIFIED).catch(() => roleMember.send('Failed to remove you from the verified role.'));
    })
    .login(process.env.HIDDENBOT_VERIFICATION_TOKEN);
}

module.exports = {
  id: 'web-verification',
  fetchRoblox,
  roleClient,
  exec: async (client) => {
    this.client = client;
    // Prevent app from sleeping.
    setInterval(() => fetch(ADDRESS), 300000);

    const app = express();

    app.use(express.urlencoded());
    app.use(express.json());

    app.get('/', (_, res) => res.send(''));
    app.post('/api/verify', async (req, res) => {
      const data = JSON.parse(Object.keys(req.body)[0]);

      if (data.auth !== process.env.INWARDS_API_KEY)
        return res.status(403).send({ message: 'invalid authentication key' });

      const member = await client.HD.members.fetch(data.discord_id).catch(() => null);

      if (!member)
        return res.status(422).send({ error: 'user not in server' });

      if (data.action === 'verify') {
        await agreeRules(member.user);
        roleClient?.emit('role', member);
        tutorial(member.user);
        res.status(200).send({ message: 'verification success' });
      } else if (data.action === 'unverify') {
        roleClient?.emit('role', (member, 'removerole'));
        await member.send('You have successfully unverified.');
        res.status(200).send({ message: 'unverification success' });
      }
    });
    app.post('/api/application', async (req, res) => {
      const data = JSON.parse(Object.keys(req.body)[0]);

      if (data.auth !== process.env.INWARDS_API_KEY)
        return res.status(403).send({ message: 'invalid authentication key' });

      if (!client.APPLICATION_ROLES.includes(data.role))
        return res.status(422).send({ message: 'invalid application role identifier provided' });

      const member = await client.HD.members.fetch(data.discord_id).catch(() => null);

      if (!member)
        return res.status(422).send({ error: 'user not in server' });

      if (data.action === 'add') {
        if (await member.roles.add(data.role).then(() => true, () => false))
          res.status(200).send({ message: 'role add success' });
        else
          res.status(502).send({ message: 'role add failure' });
      } else if (data.action === 'remove') {
        if (await member.roles.remove(data.role).then(() => true, () => false))
          res.status(200).send({ message: 'role remove success' });
        else
          res.status(502).send({ message: 'role remove failure' });
      }
    });

    app.get('/api/quotas', async (req, res) => {
      const type = req.query.type,
        apiKey = req.query.key,
        start_date = req.query.start_date,
        end_date = req.query.end_date,
        memberID = req.query.user_id,
        member = await client.HD.members.fetch(memberID).catch(() => null);

      if (apiKey === process.env.INWARDS_API_KEY && type && member && memberID && QUOTA_TYPES[type]) {
        const startDate = new Date(start_date).getTime() || Date.now() - (parseTime(start_date) ?? NaN) || getLastMonday().getTime(),
          endDate = new Date(end_date).getTime() || Date.now();

        QUOTA_TYPES[type]
          .getRawInfo(member, startDate, endDate)
          .then((stripped) => {
            res.status(200);
            res.send (
              {
                member: member.id,
                data: stripped,
                type
              }
            );
          })
          .catch(() => {
            res.status(500);
          });
      } else {
        res.status(404);
        res.send (
          {
            msg: 'error',
            code: 404
          }
        );
      }
    });

    app.listen(PORT, () => console.log(`Server running on port ${PORT}.`));

    client
      .on('guildMemberAdd', async (member) => {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const verified = await fetchRoblox(member.id); // Checks to see if the user has a roblox id linked to their account

        if (verified) {
          roleClient?.emit('role', member);
          await member.send('You have previously verified to Hidden Developers and have been given the proper roles.');
          tutorial(member.user);
        }
      })
      .on('interactionCreate', async (interaction) => {
        if (!interaction.isButton() || !interaction.customId.startsWith('verification_')) return;

        if (interaction.customId === 'verification_backup') {
          if (!(await fetchRoblox(interaction.user.id))) return interaction.reply({ content: 'You are not verified.', ephemeral: true });

          const member = await client.HD.members.fetch(interaction.user.id);

          if (member.roles.cache.has(member.client.DISCORD_VERIFIED)) return interaction.reply({ content: 'You already have the verified role.', ephemeral: true });

          roleClient?.emit('role', member);
          await interaction.reply({ content: 'You have received the verified role.', ephemeral: true });
        }
      });
  },
};
