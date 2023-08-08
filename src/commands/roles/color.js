'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders'),
  { stripIndents } = require('common-tags'),
  { MessageEmbed } = require('discord.js'),
  { parseTime } = require('../../util/common.js'),
  constants = require('../../util/constants.js');

// Formats parameters into object form.
function f(name, ids, emoji, mod) {
  return { name, ids, emoji, mod };
}

function colorAccessible(member, color) {
  return member.roles.cache.some((r) => color.ids.includes(r.id));
}

function listMap(c) {
  return `${c.emoji} **${c.name}**`;
}

// The key is the role with the color inside the parantheses.
const COLORS = {
  // Member of the Year (Dark Pink)
    '626509445748228116': f('Member of the Year', ['528979814187663379'], '<:DARK_PINK:626539830439837726>'),
    // Champion (Yellow Cream)
    '626509446985809950': f('Champion', ['515568605471965184'], '<:YELLOW_CREAM:626539830574317598>'),
    // Contributor (Very Light Orange)
    '626509448537440276': f(
      'Contributor',
      ['622603314219188224', '622602939491549203', '622603061898248198', '622603341305741343', '211229674045571072', '647832222497505310'],
      '<:VERY_LIGHT_ORANGE:626539830523723786>'
    ),
    // Former Staff (Yellow)
    '626509452354256916': f('Former Staff', ['481894885893472256'], '<:YELLOW:626539830238511107>'),
    // Nitro Booster (Neon Pink)
    '626509458457231361': f('Nitro Booster', ['585577109821587461'], '<:NEON_PINK:626539830549020713>'),
    // Featured Tester/Creation (Bright Blue)
    '626509456653418496': f('Featured Tester/Creation', ['474970753272512517', '474963770863517716'], '<:BRIGHT_BLUE:626539830389768192>'),
    // Roblox Staff (Red)
    '626509463934992425': f(
      'Roblox Staff',
      ['626465172575354911', '626465308751691791', '626465305643974669', '626465307380154371', '626465301776564247', '626465308156362752'],
      '<:RED:626539830490169351>',
      true
    ),
    // DevForum (Light Blue)
    '626509449934143500': f('DevForum', ['268486214103990282', '542595520875593728'], '<:LIGHT_BLUE:626539830133915660>'),
    // Game Producer (Light Green)
    '626509450790043710': f('Game Producer', ['211229857957281794'], '<:LIGHT_GREEN:626540563260506115>'),
    // YouTube (Cherry Red)
    '626509455584002048': f(
      'YouTuber',
      [
        '581221712419487805',
        '581221758137532437',
        '581221756937830417',
        '581221755402846208',
        '619533367154835486',
        '581221753330728982',
        '619533732461674496',
        '581221721642893322',
        '618837178612711444',
        '615736394265919530',
        '211230399282544650',
        '614086286839644191',
      ],
      '<:CHERRY_RED:626539830347694130>'
    ),
    // Composer/SFX (Light Purple)
    '626509454078246912': f('Composer/SFX/Voice Actors', ['536267112402911233', '211229886587600897', '438640764730343425'], '<:LIGHT_PURPLE:626539830230384672>'),
    // Clothing (Banana Yellow)
    '626509459933626369': f('Clothing', ['347857082696859650'], '<:BANANA_YELLOW:626539830301556746>'),
    // 3D Modeller (Blue)
    '626509465801457687': f('Modeller', ['347852324774871050'], '<:BLUE:626539830322397194>'),
    // Roblox Studio Builder (Sky Blue)
    '626509467332378624': f('Builder', ['211230151818608640'], '<:SKY_BLUE:626551631261073427>'),
    // Animation (Dark Green)
    '626509469131603997': f('Animation', ['211230236023455745'], '<:DARK_GREEN:626539830368534539>'),
    // Graphics/UI (Mint Green)
    '626509471212109852': f('Graphics/Interface', ['211230301806919682', '388477631701450756', '438640930799747073'], '<:MINT_GREEN:626539830477717514>'),
    // Programmer (Neon Green)
    '626509474533998602': f(
      'Programmer',
      ['808375079594491975', '679913870881718302', '211230203576320000', '606802519653351434', '606802712872484875', '606802914064859146'],
      '<:NEON_GREEN:626539830452420618>'
    ),
    // Group Owners (Light Orange)
    '626509477000249364': f('Community Creators', ['211229780991934465'], '<:LIGHT_ORANGE:626539830490169361>'),
    // Alternative (Grey)
    '626509366706569226': f(
      'Alternative',
      ['438640794794983424', '621840529700814890', '558715931690401812', '438656096220217345', '438656060329295872', '740532856660688917'],
      '<:GREY:626539830410739722>'
    ),
    // Verification (Cream)
    '626509478807994408': f('Verified', ['272113245895000067', '468146454440181770', '674423522101297180'], '<:CREAM:626539830209413146>'),
    // Patreon (Orange)
    '666782285776814110': f('Premium Member', ['665961252236951579', '665962480849125386', '936069763354992680'], '<:ORANGE:666842034354651155>'),
    // Former Admin (Pink)
    '701273146715537519': f('Former Admin', ['694640115640959078'], '<:PINK:702287679055855648>'),
    // Intern (Light Pink)
    '677277465663766557': f(
      'Intern',
      ['319479808990117888', '420215565496352769', '429114417461067778', '443556382286020612', '655004812324372490', constants.TRIAL_MARKETPLACE_STAFF],
      '<:LIGHT_PINK:750217372840886312>',
      true
    ),
    // Community Representative (Super Light Green)
    '677277379734929448': f(
      'Representative',
      ['334511990678487050', '501484302941552660', '605855650940977152', '735947741422813224'],
      '<:SUPER_LIGHT_GREEN:750217133597655111>',
      true
    ),
    // News (Super Super Light Green)
    '915704955866865695': f('News', ['739865306259783690'], '<:SUPER_SUPER_LIGHT_GREEN:915703312366587956>', true),
    // Application Reader (Teal)
    '677277763538780160': f('Applications', ['319328357147738122', '605855708768108564', '707139104885964802', '735947738000261220'], '<:TEAL:750217133350453269>', true),
    // Moderator (Solid Blue)
    '677277467865645083': f('Moderator', ['319327459625402369', '394532546542567424', '605855715902357535', '708779912496021576'], '<:SOLID_BLUE:750217133689929778>', true),
    // Scam Investigator (Pink Red)
    '677278211435921431': f('Scam Investigator', ['539152555557650432', '654980555850645541', '679443527368835073', '735947735114579978'], '<:PINK_RED:750217133677609002>', true),
    // Marketplace (Purple)
    '706864962059894835': f('Marketplace', ['689655074531967088', '706150965954347029', '706159545063440444', '735947743641600011'], '<:PURPLE:750217133744455720>', true),

  //'852269690726514739': f('Test Blue', ['652673441761067028'], '😄'),
  //'852269708027756615': f('Test Green', ['652673441761067028'], '😄'),
  //'852276624459431986': f('Test Purple', ['652673441761067028'], '😄'),
  },

  COOLDOWN = 45000,

  onCooldown = {};

function removeCooldown(user) {
  const timeout = onCooldown[user.id];

  clearTimeout(timeout);

  delete onCooldown[user.id];
}

function cooldown(user) {
  onCooldown[user.id] = setTimeout(removeCooldown.bind(null, user), COOLDOWN);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('color')
    .setDescription('Sends a message with a drop down menu that allows you to change your message color.')
    .setDMPermission(false)
    .addStringOption((option) =>
      option.setName('color')
        .setDescription('The desired name color.')
        .setRequired(true)
        .setAutocomplete(true)
    ),
  autocomplete: async (interaction) => {
    // Save data for 60 seconds to prevent overwhelming array searching when a user is using autocomplete.
    if ((Date.now() - (interaction.member?.availableColorsLastUpdated ?? 0)) > 60000) {
      const patreon = interaction.client.isPatreon(interaction.user, ['gold', 'champion']);

      interaction.member = await interaction.client.HD.members.fetch(interaction.user.id);

      interaction.member.availableColors = Object.values(COLORS).filter((c) => patreon ? (!c.mod || colorAccessible(interaction.member, c)) : colorAccessible(interaction.member, c));
      interaction.member.availableColorsLastUpdated = Date.now();
    }

    const value = interaction.options.getFocused();

    interaction.respond([
      { name: 'List of Colors', value: 'list' },
      ...interaction.member.availableColors
        .filter((color) => color.name.toLowerCase().startsWith(value.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((color) => ({ name: color.name, value: color.name }))
        .slice(0, 24)
    ]);
  },
  exec: async (call) => {
    if (call.user.id in onCooldown)
      return call.interaction.reply({ content: `You can only use the \`color\` command every ${parseTime(COOLDOWN)}.`, ephemeral: true });

    const color = call.interaction.options.getString('color');

    if (color === 'list') {
      return call.interaction.reply({
        embeds: [
          new MessageEmbed()
            .setColor(call.client.INVISIBLE_COLOR)
            .setTitle('List of Role Colors')
            .setDescription(
              stripIndents`**🔓 Accessible To You**
                
                ${call.member.availableColors.map(listMap).join('\n') || 'None'}
                
                
                **🔒 Inaccessible To You**
                
                ${Object.values(COLORS).filter((c) => !call.member.availableColors.includes(c)).map(listMap).join('\n') || 'None'}`
            )
            .setFooter({ text: 'Note: The prompt below will end in 3 minutes.' })
        ],
        ephemeral: true
      });
    }

    const colorRole = Object.entries(COLORS).find(([, c]) => c.name === color)?.[0];

    if (!colorRole)
      return call.interaction.reply({ content: 'Invalid color, please provide a valid color or provide `list` for a list of colors.', ephemeral: true });

    if (call.member.roles.cache.has(colorRole))
      return call.interaction.reply({ content: 'The color selected is already your current color role.', ephemeral: true });

    call.member.roles
      .set([...call.member.roles.cache.filter((r) => r.name !== '.').values(), colorRole])
      .then(() => {
        cooldown(call.user);
        call.interaction.reply({ content: 'Successfully changed your name color.', ephemeral: true });
      })
      .catch(() => {
        call.interaction.reply({ content: 'Failed to change your name color.', ephemeral: true });
      });
  },
};