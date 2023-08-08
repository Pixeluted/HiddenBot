/* eslint-disable no-useless-escape */
'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders'),
  { MessageEmbed, Modal, MessageActionRow, TextInputComponent } = require('discord.js'),
  { isBad } = require('../../load/filter'),
  { parseTime, safeBlock } = require('../../util/common'),
  { highlightKey } = require('../../util/compilationDetails'),
  { createSnippet, findVersions, compileCode, getLanguages, aliases } = require('../../util/glot'),
  implicits = require('../../util/implicitStatements'),
  sendPaged = require('../../util/sendPaged');

const COOLDOWN = 10000, 
  onCooldown = {};

function removeCooldown(user) {
  const timeout = onCooldown[user.id];

  clearTimeout(timeout);

  delete onCooldown[user.id];
}

function cooldown(user) {
  onCooldown[user.id] = setTimeout(removeCooldown.bind(null, user), COOLDOWN);
}

async function compile(language, code, version, implicit = false) {
  if (implicit) {
    const ctx = implicits[language];

    if (!ctx) return 'Invalid Implicit';

    code = ctx(code);
  }

  const start = Date.now(),
    res = await compileCode({
      language,
      version,
      code,
    });

  res.timeTaken = Date.now() - start;

  return res;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('compile')
    .setDescription('Evaluates an expression.')
    .addStringOption((option) =>
      option.setName('language')
        .setDescription('The language you will use to compile the expression.')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption((option) =>
      option.setName('code')
        .setDescription('Optional parameter for inputting code. A modal will appear if left blank.')
        .setRequired(false)),
  // All development channels aside from creations
  bypassChannels: ['510573382623035408', '781584867154198539'],
  exec: async (call) => {
    const language = call.interaction.options.getString('language');

    if (language === 'list') {
      return sendPaged(
        call, 
        new MessageEmbed()
          .setTitle('Compiling Languages List')
          .setColor(call.client.DEFAULT_EMBED_COLOR),
        {
          values: (await getLanguages()).sort((a, b) => a.localeCompare(b)).map((lang, i) => `${i + 1}. **${lang}**${aliases[lang] ? `  •  (${aliases[lang].map((a) => `\`${a}\``).join(', ')})` : ''}`),
          valuesPerPage: 10,
          startWith: 'Structure: **Language Name  •  Aliases**\n\n'
        }
      );
    }

    if (call.user.id in onCooldown)
      return call.interaction.reply({ content: `This command can only be run every ${parseTime(COOLDOWN)}.`, ephemeral: true });

    if (!language) 
      return call.interaction.reply({ content: 'Invalid language provided.', ephemeral: true });

    const version = (await findVersions(language))[0];

    let code = call.interaction.options.getString('code'),
      codeInteraction;

    if (!code) {
      codeInteraction = await call.modalPrompt(
        new Modal()
          .setCustomId('compile_code')
          .setTitle('Compile Prompt')
          .addComponents(
            new MessageActionRow().addComponents(
              new TextInputComponent()
                .setCustomId('code')
                .setLabel('Code')
                .setStyle('PARAGRAPH'))));

      code = codeInteraction.fields.getTextInputValue('code');
    } else {
      codeInteraction = call.interaction;
    }

    const embed = new MessageEmbed()
      .setTitle('Compiling...')
      .setColor('BLUE')
      .setFooter({ text: `Requested by ${call.user.tag}`, iconURL: call.user.displayAvatarURL({ dynamic: true }) });

    await codeInteraction.reply({ embeds: [embed] });

    let res, resErrLength, resOutLength, i = 0;

    do {
      if (i > 0)
        call.interaction.editReply({ embeds: [embed.setDescription('Retrying in implicit mode...').setColor('ORANGE')] });

      res = await compile(language, code, version, i > 0);

      if (res === 'Invalid Implicit') {
        codeInteraction.editReply({ embeds: [embed.setDescription('The language you provided does not have a currently known way of evaluating expressions.').setColor('RED')] });

        return cooldown(call.user);
      }
      
      resErrLength = res.body.stderr?.length;
      resOutLength = res.body.stdout?.length;    

      if (i > 0) break;
      
      i++;
    } while ((!resErrLength && !resOutLength) || resErrLength);

    if (!resErrLength && !resOutLength)
      return codeInteraction.editReply({
        embeds: [
          embed
            .setColor('RED')
            .setTitle('Compilation Error')
            .setDescription('Your expression is not returning any results.')
            .setFooter({ text: `Requested by ${call.user.tag}  •  Processed in ${res.timeTaken}ms`, iconURL: call.user.displayAvatarURL({ dynamic: true }) })
        ]
      });

    const resultIsBad = isBad(resErrLength ? res.body.stderr : res.body.stdout);
    
    if (resultIsBad)
      codeInteraction.editReply({ content: 'Due to a filter match, your compilation results have been sent ephemerally.', embeds: [] });

    codeInteraction[resultIsBad ? 'followUp' : 'editReply']({
      embeds: [
        embed
          .setColor(resErrLength ? 'RED' : 'GREEN')
          .setTitle(resErrLength ? 'Compilation Error' : 'Compilation Successful')
          .setDescription(
            res.overLimit ?
              `${res.errMessage} You may click [here](${await createSnippet({ language,  body: resErrLength ? res.body.stderr : res.body.stdout })}) to view your code in your browser.` :
              `\`\`\`${resErrLength ? '' : highlightKey[language] + '\n'}${resErrLength ? safeBlock(res.body.stderr) : safeBlock(res.body.stdout)}\n\`\`\``
          )
          .setFooter({ text: `Requested by ${call.user.tag}  •  Processed in ${res.timeTaken}ms`, iconURL: call.user.displayAvatarURL({ dynamic: true }) })
      ],
      ephemeral: resultIsBad
    });
    
    cooldown(call.user); 
  },
  autocomplete: async (interaction) => {
    const value = interaction.options.getFocused();

    interaction.respond(
      [
        { name: 'List of Languages', value: 'list' },
        ...[
          ...new Set(
            (await getLanguages())
              .filter((lang) => lang.toLowerCase().startsWith(value.toLowerCase()))
              .concat(
                Object.entries(aliases)
                  .filter(([_, aliases]) => aliases.some((alias) => alias.startsWith(value.toLowerCase())))
                  .map(([lang]) => lang)
              )
          )
        ]
          .sort()
          .slice(0, 24)
          .map((l) => ({ name: l, value: l }))
      ]
    );
  
  }
};
