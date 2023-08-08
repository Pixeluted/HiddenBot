

const { SlashCommandBuilder } = require('@discordjs/builders'),
  { isBad } = require('../../load/filter.js'),
  { parseTime, safeBlock } = require('../../util/common.js'),
  { getClient } = require('../../load/database.js'),
  { isEphemeralChannel } = require('../../util/common');


const DISALLOWED_REGEX = /[^a-zA-Z0-9()[\]{}_ ]/g,
  EMOJIS = {
    '🎓': [
      '811747785384525875' // Development helper role: This role is added to all helpers. There are no longer individual helpers
      /*
      '528703953026940948', // Modeler Helper
      '528704284460711946', // Graphics Helper
      '528704622416625688', // UI Helper
      '528704059650342944', // Offsite Code Helper
      '528704025089146890', // Lua Code Helper
      '528704102008356907', // Animation Helper
      '528703889839751178', // Builder Helper
      '651818029339901962', // Music/SFX Helper
        */
    ],
    '⭐': [
      '665961252236951579', // Patreon Premium -- Remove in a month
      '665962480849125386', // Patreon Standard -- Remove in a month
      '936471879206699050', // Discord Champion
      '936399665627291648', // Discord Gold
      '940325617138819124', // Discord Silver
    ],
    '🌟': [
      '705990190124236802', // Staff of The Month
    ],
    '👑': [
      '515568605471965184', // Champion
      '731943865401081898', // Test Champion
      '896062005503463484', // Champion VC
    ],
    '🎩': [
      '836363497784868894' // Helper of the month
    ]
  },
  COOLDOWN = 600000,

  onCooldown = {};

function removeCooldown(user) {
  const timeout = onCooldown[user.id];

  clearTimeout(timeout);

  delete onCooldown[user.id];
}

function cooldown(user) {
  onCooldown[user.id] = setTimeout(removeCooldown.bind(null, user), COOLDOWN);
}

async function updateNickname(member, nickname = member.displayName, toggleEmoji) {
  // Remove pre-existing emojis and disallowed characters
//   nickname = ' ' + nickname.replace(new RegExp(Object.keys(EMOJIS).join('|'), 'g'), '').replace(DISALLOWED_REGEX, '').trim();

//   const fields = await getClient().query('SELECT fields FROM public.users WHERE "user" = $1', [member.id]).then((res) => res.rows[0]?.fields) ?? {};

//   if (toggleEmoji) fields[toggleEmoji] = !member.displayName?.includes(toggleEmoji);

//   for (const [emoji, roles] of Object.entries(EMOJIS)) {
//     if (fields[emoji] === undefined)
//       fields[emoji] = true;

//     if (member.roles.cache.some((role) => roles.includes(role.id)) && fields[emoji])
//       nickname = emoji + nickname;
//   }

//   await getClient().query('INSERT INTO public.users ("user", fields) VALUES ($1, $2) ON CONFLICT ("user") DO UPDATE SET fields = $2', [member.id, fields]);

//   return nickname;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nickname')
    .setDescription('Changes your nickname.')
    .setDMPermission(false)
    .addStringOption((option) =>
      option.setName('nickname')
        .setDescription('The new nickname.')
        .setRequired(true))
    .addUserOption((option) =>
      option.setName('target')
        .setDescription('The target user to change the nickname of.')
        .setRequired(false)),
  useAnywhere: false,
  EMOJIS,
  DISALLOWED_REGEX,
  updateNickname,
  exec: async (call) => {
    if (call.user.id in onCooldown && !call.member.roles.cache.has(call.client.FULL_STAFF_MEMBER))
      return call.interaction.reply({ content: `You can only change your nickname every ${parseTime(COOLDOWN)}.`, ephemeral: true });

    const member = call.interaction.options.getMember('target') ?? call.member;

    if (member.id !== call.user.id && !(call.member.roles.cache.has(call.client.FULL_STAFF_MEMBER) || call.member.roles.cache.has(call.client.TRIAL_MODERATOR)))
      return call.interaction.reply({ content: 'You only have permission to change your own nickname.', ephemeral: true });

    let nickname = call.interaction.options.getString('nickname');

    if (DISALLOWED_REGEX.test(nickname))
      return call.interaction.reply({ content: `The provided nickname contains invalid characters. Please retry the command with a nickname that only contains alphanumeric characters, underscores and brackets \`[]\`, \`{}\` or \`(, ephemeral: true })\`. e.g. \`${call.client.prefix}nickname Tom ([ROBLOX])\``, ephemeral: true });

    nickname = await updateNickname(member, nickname);

    if (isBad(nickname))
      return call.interaction.reply({ content: 'The provided nickname does not pass the word filter. Please rerun the command with an appropriate nickname.', ephemeral: true });

    if (nickname.length < 3 || nickname.length > 32)
      return call.interaction.reply({ content: `The nickname \`\`${safeBlock(nickname).substring(0, 50)}\`\` is ${nickname.length > 32 ? 'greater than 32 characters' : 'less than 3 characters'} in length. Please rerun the command with a shorter nickname. e.g. \`${call.client.prefix}nickname Tom ([ROBLOX])\``, ephemeral: true });

    if (member.id === call.user.id)
      cooldown(member.user);

    // member.setNickname(nickname)
    //   .then(() => {
    //     call.interaction.reply({ content: `Successfully changed ${member.id === call.user.id ? 'your' : `${member.user}'s`} nickname.`, ephemeral: isEphemeralChannel(call.interaction) });
    //   }, () => {
    //     removeCooldown(member.user);
    //     call.interaction.reply({ content: `Failed to change ${member.id === call.user.id ? 'your' : `${member.user}'s`} nickname.`, ephemeral: true });
    //   });

  }
};
