const { SlashCommandBuilder } = require('@discordjs/builders'),
  { MessageActionRow, Modal, TextInputComponent, MessageEmbed } = require('discord.js'),
  { safeBlock } = require('../../util/common.js'),
  util = require('util');

function clean(result, client) {
  return result.replace(new RegExp(client.token, 'gi'), '[ HIDDEN ]');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('eval')
    .setDescription('Executes code.'),
  useAnywhere: false,
  exec: async (call) => {
    if (!['118496586299998209', '269926271633326082', '300816697282002946'].includes(call.interaction.user.id))
      return call.interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });

    const modal = new Modal()
      .setCustomId('eval_input')
      .setTitle('Eval Prompt')
      .addComponents(
        new MessageActionRow()
          .addComponents(new TextInputComponent()
            .setCustomId('eval_input')
            .setLabel('Eval Input')
            .setStyle('PARAGRAPH')),
        new MessageActionRow()
          .addComponents(new TextInputComponent()
            .setCustomId('ephemeral')
            .setLabel('Ephemeral?')
            .setStyle('SHORT')));

    if ((Date.now() - (call.user.passwordInputted ?? 0)) > 3_600_000) {
      modal.addComponents(
        new MessageActionRow()
          .addComponents(new TextInputComponent()
            .setCustomId('password')
            .setLabel('Password')
            .setStyle('SHORT')));
    }

    const modalInteraction = await call.modalPrompt(modal),
      password = modal.components.length === 3 ? modalInteraction.fields.getTextInputValue('password') : process.env.EVAL_PASSWORD,
      query = modalInteraction.fields.getTextInputValue('eval_input'),
      ephemeral = modalInteraction.fields.getTextInputValue('ephemeral').toLowerCase()?.startsWith('y') ?? false,
      /* eslint-disable no-unused-vars */
      { channel, user, member, guild } = call;
      /* eslint-enable no-unused-vars */

    if (process.env.NODE_ENV === 'production' && password !== process.env.EVAL_PASSWORD)
      return modalInteraction.reply({ content: 'Invalid password.', ephemeral: true });

    call.user.passwordInputted = Date.now();

    await modalInteraction.deferReply({ ephemeral });
    
    const start = Date.now();

    try {
      const result = util.inspect(await eval(query), { depth: 3, getters: true });

      modalInteraction.editReply(
        {
          embeds: [
            new MessageEmbed()
              .setColor('GREEN')
              .setTitle('Evaled')
              .setDescription(`\`\`\`js\n${clean(result, modalInteraction.client).substring(0, 750)}\`\`\``)
              .setFooter({ text: `Processed in ${Date.now() - start} milliseconds.` })
          ],
          ephemeral
        }
      );
    } catch (err) {
      modalInteraction.editReply(
        {
          embeds: [
            new MessageEmbed()
              .setColor('RED')
              .setTitle('Error')
              .setDescription(`\`\`\`x1\n${safeBlock(clean(err.toString(), modalInteraction.client))}\`\`\``)
              .setFooter({ text: `Processed in ${Date.now() - start} milliseconds.` })
          ],
          ephemeral
        }
      );
    }
  },
};
