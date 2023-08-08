'use strict';

const { MessageActionRow, MessageButton } = require('discord.js'),
  buttons = require('../load/buttons.js');

function endPaged(reply) {
  if (!reply.client.paginations.delete(reply.id))
    return;

  reply.edit({
    content: 'Interactive embed ended.',
    embeds: reply.embeds,
    components: [new MessageActionRow().addComponents(...reply.components[0].components.map((button) => new MessageButton(button).setDisabled(true)))]
  });
}

function defaults(obj, objDef) {
  for (const [name, prop] of Object.entries(objDef)) if (!(name in obj)) obj[name] = prop;

  return obj;
}

const PAGED_SEND_DEFAULTS = {
  valuesPerPage: 50,
  allowFlip: true,
  bypassMultiple: false,
  time: 120000,
  joinWith: '\n',
  startWith: '',
  endWith: '',
};

module.exports = function sendPaged(call, embed, options = {}) {
  defaults(options, PAGED_SEND_DEFAULTS);

  const range = options.valuesPerPage,
    totalPages = Math.ceil(options.values.length / options.valuesPerPage),
    page = 1,
    description = embed.description;

  embed
    .setDescription((description || '') + '\n\n' + options.startWith + options.values.slice(0, range).join(options.joinWith) + options.endWith)
    .setFooter({ text: `Page ${page}/${totalPages} - ${call.interaction.user.tag} (${call.interaction.user.id})`, iconURL: call.interaction.user.displayAvatarURL() });

  return new Promise(async (resolve) => {
    const paged = options.valuesPerPage < options.values.length,
      messageValue = {
        embeds: [embed],
        components: paged ? [
          new MessageActionRow().addComponents(
            new MessageButton().setCustomId('paginate_left').setLabel('<').setStyle('PRIMARY'),
            new MessageButton().setCustomId('paginate_right').setLabel('>').setStyle('PRIMARY'),
            new MessageButton().setCustomId('paginate_end').setLabel('End').setStyle('DANGER')
          )
        ] : []
      },
      reply = options.channel
        ? await options.channel.send(messageValue)
        : await (call.interaction.replied || call.interaction.deferred ? call.interaction.editReply(messageValue) : call.interaction.reply(messageValue)).then(() => call.interaction.fetchReply());

    if (paged) {
      const prompt = buttons.createButtonPrompt(reply),
        timeout = setTimeout(() => {
          endPaged(reply);
          prompt.delete();
        }, options.time),
        pagination = { range, page, totalPages, embed, options, user: call.interaction.user, timeout, end: endPaged.bind(null, reply) };

      call.client.paginations.set(reply.id, pagination);

      prompt.on('click', (input) => {
        if (input.user.id !== call.interaction.user.id) return input.reply({ content: 'You aren\'t the owner of this interactive embed.', ephemeral: true });

        if (input.customId === 'paginate_end') {
          endPaged(reply);
          prompt.delete();

          input.deferUpdate();

          return;
        }

        if (input.customId === 'paginate_left') {
          if (pagination.page !== 1) {
            pagination.page--;
            pagination.range -= options.valuesPerPage;
          } else if (options.allowFlip) {
            pagination.page = pagination.totalPages;
            pagination.range = Math.ceil(options.values.length / options.valuesPerPage) * options.valuesPerPage;
          }
        } else if (pagination.page !== pagination.totalPages) {
          pagination.page++;
          pagination.range += options.valuesPerPage;
        } else if (options.allowFlip) {
          pagination.page = 1;
          pagination.range = options.valuesPerPage;
        }

        pagination.embed
          .setDescription(options.startWith + options.values.slice(pagination.range - options.valuesPerPage, pagination.range).join(options.joinWith) + options.endWith)
          .setFooter({ text: `Page ${pagination.page}/${pagination.totalPages} - ${call.interaction.user.tag} (${call.interaction.user.id})`, iconURL: call.interaction.user.displayAvatarURL() });

        input.update({ embeds: [pagination.embed] });
      });
    }

    resolve(reply);
  });
};
