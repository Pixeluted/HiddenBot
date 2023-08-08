/* eslint-disable padding-line-between-statements */
'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders'),
  { MessageEmbed, MessageAttachment } = require('discord.js'),
  { fetchRoblox } = require('../../load/webVerification.js'),
  { formatDateEmbed, getRobloxAge, starEmojis, titleCase } = require('../../util/common.js'),
  { createCanvas, loadImage } = require('@napi-rs/canvas'),
  { getClient } = require('../../load/database.js'),
  { EMOJIS } = require('../utility/nickname.js'),
  { isEphemeralChannel } = require('../../util/common');

const roles = {
    'Admin': ['211229166861942784'],
    'Department Leader': ['712386713883770950'],
    // Management Member: Moderation Management, Scam Management, Application Management, Representative Management, Marketplace Management
    'Management Member': ['708779912496021576', '735947735114579978', '735947738000261220', '735947741422813224', '735947743641600011'],
    // Senior Staff Member: Senior Moderator, Senior Representative, Senior Scam Investigator, Senior Marketplace, Senior Application Reader
    'Senior Staff Member': ['394532546542567424', '501484302941552660', '679443527368835073', '706150965954347029', '707139104885964802'],
    'Staff Member': ['211229509150572544'],
    'Trial Staff Member': ['443556382286020612'],
    'Member': ['674423522101297180'],
  },
  rankRoles = {
    '👑 Champion': '515568605471965184',
    '💎 Crystal III': '438782030767980554',
    '💎 Crystal II': '438782033825890314',
    '💎 Crystal I': '438781667109240843',
    '💚 Emerald III': '555866277109825577',
    '💚 Emerald II': '555865874444189696',
    '💚 Emerald I': '555865719170924550',
    '💛 Gold III': '438639927836540929',
    '💛 Gold II': '438639896362614794',
    '💛 Gold I': '438639769925320714',
    '🧡 Silver III': '438639735821303808',
    '🧡 Silver II': '438639717550915594',
    '🧡 Silver I': '429758935055204363',
    '🤎 Bronze III': '429759601920180224',
    '🤎 Bronze II': '429756266177363978',
    '🤎 Bronze I': '429758774887317504',
  },
  FIELDS = [
    {
      name: 'portfolio',
      value: (input, call) => {
        return input.match(call.client.ONLY_LINK_REGEX) ? `**${input}**` : 'Invalid input: not a valid link';
      }
    },
    {
      name: 'twitter',
      value: (input) => {
        const handle = input.match(/^@?(\w){1,15}$/)?.[0];

        return handle ? `**[${handle}](https://twitter.com/${handle})**` : 'Invalid input: not a valid twitter handle';
      }
    },
    {
      name: 'instagram',
      value: (input) => {
        const handle = input.match(/^(?!.*\.\.)(?!.*\.$)[^\W][\w.]{0,29}$/)?.[0];

        return handle ? `**[${handle}](https://www.instagram.com/${handle})**` : 'Invalid input: not a valid instagram handle';
      }
    }
  ];

function roundedRect(ctx, x, y, width, height, radius, noInvert = true) {
  // If the width of the rectange is less than the width of the rounded corners, make the rectangle a circle with the width as the diameter.
  if (noInvert && width < (radius * 2))
    width = radius * 2;

  ctx.beginPath();
  ctx.moveTo(x, y + radius);
  ctx.lineTo(x, y + height - radius);
  ctx.arcTo(x, y + height, x + radius, y + height, radius);
  ctx.lineTo(x + width - radius, y + height);
  ctx.arcTo(x + width, y + height, x + width, y + height-radius, radius);
  ctx.lineTo(x + width, y + radius);
  ctx.arcTo(x + width, y, x + width - radius, y, radius);
  ctx.lineTo(x + radius, y);
  ctx.arcTo(x, y, x, y + radius, radius);
  ctx.closePath();
}

async function generateMemberImage(user, call) {
  const canvas = createCanvas(2000, 800),
    ctx = canvas.getContext('2d'),
    member = await call.client.HD.members.fetch(user.id).catch(() => null);

  if (!member) return;

  ctx.save();
  roundedRect(ctx, 0, 0, 2000, 800, 10);
  ctx.clip();
  ctx.fillStyle = '#1b1b1b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  let usernameSize = 120,
    statusSize = 80,
    rankSize = 80;

  ctx.fillStyle = 'white';

  do {
    ctx.font = `${usernameSize -= 5}px impact`;
  } while (ctx.measureText(user.username).width > canvas.width / 2);

  ctx.fillText(user.username, 800, 300);

  ctx.font = `${rankSize -= 5}px Impact`;

  ctx.fillText(
    `Rank: ${Object.entries(rankRoles).find(([_, id]) => member.roles.cache.has(id))?.[0] || 'Not Ranked'}`,
    800,
    450
  );

  const status = `Status: HD ${Object.entries(roles).find(([_, ids]) => ids.some((id) => member.roles.cache.has(id)))?.[0] || 'Unverified Member'}`;

  do {
    ctx.font = `${statusSize -= 5}px Impact`;
  } while (ctx.measureText(status).width > canvas.width / 2);

  ctx.fillText(status, 800, 600);

  ctx.lineWidth = 8;
  ctx.strokeStyle = 'white';

  ctx.save();
  roundedRect(ctx, 100, 100, 600, 600, 10);
  ctx.clip();
  ctx.drawImage(await loadImage(user.displayAvatarURL({ format: 'png', size: 4096 })), 100, 100, 600, 600);
  ctx.restore();
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.arc(700, 700, 20, 0, Math.PI * 2, true);
  ctx.fillStyle = call.client.PRESENCE_COLORS[member?.presence?.status] || call.client.PRESENCE_COLORS.offline;
  ctx.fill();
  ctx.stroke();

  return canvas;
}

console.log(FIELDS.map((field) => ({ name: titleCase(field.name), value: field.name })));
module.exports = {
  data: new SlashCommandBuilder()
    .setName('user')
    .setDescription('Provides information on the given user or allows the editing of information on your own user embed.')
    .addSubcommand((subcommand) =>
      subcommand.setName('info')
        .setDescription('Get information on yourself or other users.')
        .addUserOption((option) =>
          option.setName('target')
            .setDescription('The user that you would like to view info for, otherwise yourself.')
            .setRequired(false)))
    .addSubcommand((subcommand) =>
      subcommand.setName('update')
        .setDescription('Update your current information.')
        .addStringOption((option) =>
          option.setName('field')
            .setDescription('The field you are editing.')
            .setRequired(true)
            .addChoices(...FIELDS.map((field) => ({ name: titleCase(field.name), value: field.name }))))
        .addStringOption((option) =>
          option.setName('value')
            .setDescription('The value of the field you are editing. Provide "delete" to delete the field\'s current value.')
            .setRequired(true))),
  generateMemberImage,
  roundedRect,
  exec: async (call) => {
    await call.interaction.deferReply(
      {
        ephemeral: isEphemeralChannel(call.interaction)
      }
    );
    // Insert if not exists
    await getClient().query('INSERT INTO public.users ("user", creation_posts) SELECT $1, 0 WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE "user" = $1)',
      [call.user.id]);

    const user = await call.client.users.fetch(call.interaction.options.getUser('target') ?? call.user),
      robloxUser = await fetchRoblox(user.id),
      fields = await getClient().query('SELECT fields FROM public.users WHERE "user" = $1', [user.id]).then((res) => res.rows[0]?.fields || {});

    if (call.interaction.options.getSubcommand() === 'update') {
      const field = FIELDS.find((f) => f.name === call.interaction.options.getString('field'));

      let value = call.interaction.options.getString('value');

      if (value === 'delete') {
        delete fields[field.name];
      } else {
        value = await field.value(value, call);

        if (value.startsWith('Invalid input:'))
          return call.interaction.editReply(`Failed to update your ${field.name} field. ${value}.`);
      }

      if (value)
        fields[field.name] = value;

      return getClient().query('UPDATE public.users SET fields = $2 WHERE "user" = $1', [call.user.id, JSON.stringify(fields)])
        .then(
          () => call.interaction.editReply({ content: `Successfully updated your ${field.name} field.`, ephemeral: true }),
          () => call.interaction.editReply({ content: `Failed to update your ${field.name} field.`, ephemeral: true })
        );
    }

    const reviews = await getClient().query('SELECT reviews FROM public.reviews WHERE "user" = $1', [user.id]).then(((res) => res.rows[0]?.reviews));

    let averageRating = 0;

    if (reviews && Object.values(reviews).length) {
      var stars = Object.values(reviews).filter((review) => review.stars);

      averageRating = stars.reduce((a, b) => a + b.stars, 0) / stars.length;
    }

    const canvas = await generateMemberImage(user, call),
      member = await call.client.HD.members.fetch(user.id).catch(() => null),
      embed = new MessageEmbed()
        .setColor(call.client.DEFAULT_EMBED_COLOR)
        .setTitle(`Information on ${user.username}`)
        .addField('<:roblox:693218877500293131> Roblox Account:', robloxUser ? `[${await call.client.getRobloxNameFromId(robloxUser)}](https://www.roblox.com/users/${robloxUser}/profile) (${robloxUser}) (${await getRobloxAge(robloxUser)} days old)` : 'This user does not have a verified Roblox account.')
        .addField('<:Discord:555869594581991428> Discord:', user ? `${user.tag} (${user.id}) (joined: ${member?.joinedTimestamp ? formatDateEmbed(member?.joinedTimestamp) : 'N/A'})` : 'This user does not have a verified Discord account.')
        .addField('Marketplace Rating', averageRating ? `${starEmojis(averageRating)} (${Math.round(averageRating * 10) / 10}) - ${stars.length} reviews` : 'N/A')
        .addField('Status', member?.roles.cache.has(call.client.HIREABLE) ? 'Hireable' : 'Not Hireable')
        .setFooter({ text: `Requested by ${call.user.tag}`, iconURL: call.user.displayAvatarURL() });

    let attachment;

    if (member) {
      attachment = new MessageAttachment(canvas.toBuffer(), 'profile.png');
      embed.setImage('attachment://profile.png');
    }

    Object.entries(fields).filter(([name]) => !Object.keys(EMOJIS).includes(name)).forEach(([name, value]) => embed.addField(titleCase(name), value));

    call.interaction.editReply(attachment ? { embeds: [embed], files: [attachment] } : { embeds: [embed] });
  }
};
