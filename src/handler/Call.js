const { User, Message, MessageButton, MessageActionRow } = require('discord.js'),
  Prompt = require('./Prompt.js'),
  { MessageEmbed } = require('discord.js'),
  { parseTime, safeBlock, makeId } = require('../util/common.js'),
  Buttons = require('../load/buttons.js');

function defaults(obj, objDef) {
  for (const [name, prop] of Object.entries(objDef))
    if (!(name in obj))
      obj[name] = prop;

  return obj;
}

function formatTrigger(prompt, trigger) {
  // halloween F88501

  if (typeof trigger === 'string') {
    return {
      embeds: [
        new MessageEmbed()
          .setColor('#42CB59')
          .setTitle('Prompt')
          .setDescription(`${trigger}\n\nRespond with \`cancel\` to end this prompt.`)
          .setFooter({ text: `The prompt will end in ${parseTime(prompt.options.time)}.` })
      ]
    };
  } else {
    return trigger;
  }
}

function formatCorrect(prompt, correct) {
  if (!correct || typeof correct === 'string') {
    let inputMessage = correct;

    if (!inputMessage) {
      const filter = prompt.options.rawFilter;

      inputMessage = typeof filter === 'number' ? `: \`Input exceeded ${filter.toLocaleString()} characters or did not include any content\`` :
        Array.isArray(filter) ? `: \`Input was not one of "${safeBlock(filter.slice(0, -1).join('", "'))}" or "${safeBlock(filter[filter.length - 1])}"\`` :
        '';
    } else {
      inputMessage = `: \`\`${safeBlock(inputMessage)}\`\``;
    }

    return {
      embeds: [
        new MessageEmbed()
          .setColor('RED')
          .setTitle('Prompt Invalid Input')
          .setDescription(`Invalid input${inputMessage}.\n\nPlease retry, or respond with \`cancel\` to end this prompt.`)
          .setFooter({ text: `The prompt will end in ${parseTime(prompt.startedAt - Date.now() + prompt.options.time)}.` })
      ]
    };
  } else {
    return correct;
  }
}

/**
 * An instance of this is supplied to a command's `exec` function when a command is called. All parameters translate directly into properties.
 * @property {Discord.Message} message The Message instance sent to trigger the command.
 * @property {Discord.Client} client The Client instance of the bot.
 * @property {Command} command The command object, e.g. `{ id: 'ping', exec: () => {} }`.
 * @property {Discord.Collection} commands All the command objects mapped by the command id's.
 * @property {string[]} args The arguments supplied to the message, e.g '!ban @gt_c for bullying me' would make this array
 * `['@gt_c', 'for', 'bullying', 'me']`.
 * @property {string} cut The content of the message, excluding the prefix and alias used.
 */
class Call {
  /**
	 * Runs a prompt for the provided user in the provided channel.
	 * @param {PromptOptions} info Additionally should contain a `user` and `channel` property respectfully
	 * @returns {Promise<Discord.Message|Discord.Collection<Discord.Snowflake, Discord.Message>>} A collection of messages recieved by the user that
	 * passed all requirements.
	 */
  static async prompt({ message, user, channel, options = {} }) {
    if (!channel)
      throw new Error('Invalid channel provided.');

    if (channel instanceof User)
      channel = await channel.createDM();

    if (Call.prompts.some((p) => p.user.id === user.id && p.channel.id === channel.id)) {
      channel.send('You already have a currently running prompt in this channel. Finish or cancel that prompt before running another');
      throw new Error('Prompt ended: User already has a current prompt in this channel');
    }

    defaults(options, {
      filter: () => true,
      correct: () => {},
      formatCorrect,
      formatTrigger,
      cancellable: true,
      autoRespond: true,
      addLastMatch: false,
      time: 180000,
      messages: 1,
      attempts: 10
    });

    const oldFilter = options.filter;

    options.rawFilter = oldFilter;

    if (oldFilter instanceof RegExp)
      options.filter = (m) => oldFilter.test(m.content);
    else if (Array.isArray(oldFilter))
      options.filter = (m) => oldFilter.map((o) => o.toLowerCase()).includes(m.content.toLowerCase());
    else if (typeof oldFilter === 'number')
      options.filter = (m) => !!m.content.length && m.content.length <= oldFilter;
    else if (typeof oldFilter === 'function')
      options.filter = oldFilter;

    return new Promise(async (resolve, reject) => {
      const prompt = new Prompt(user, channel, options, resolve, reject, Call);

      message = options.formatTrigger(prompt, message);

      const oldCorrect = options.correct;

      if (typeof oldCorrect === 'string')
        options.correct = (m) => m.channel.send(options.formatCorrect(prompt, oldCorrect));
      else if (typeof oldCorrect === 'function')
        options.correct = (m) => m.channel.send(options.formatCorrect(prompt, oldCorrect(m)));

      if (message) {
        let failed = false;

        await channel.send(message).catch(() => {
          prompt.end('trigger message failed to send');

          failed = true;
        });

        if (failed)
          return;
      }

      Call.prompts.push(prompt);
    });
  }

  constructor(interaction, command, commands) {
    this.interaction = interaction;
    this.client = interaction.client;
    this.command = command;
    this.commands = commands;

    this.user = interaction.user;
    this.member = interaction.member;
    this.channel = interaction.channel;
    this.guild = interaction.guild;
  }

  /**
	 * Intentionally avoids `MessageCollector`'s so not to cause confusion to the developer if a possible `EventEmitter` memory leak occurs.
	 * Note: To force cancel a prompt, do `<Prompt>.end('cancelled')`.
	 * @param {?Discord.StringResolvable} msg The arguments you would supply to a `TextChannel#send` function. Can be an array of arguments or a
	 * single argument.
	 * @param {PromptOptions} options Options to customize the prompt with.
	 * @returns {Promise<Discord.Message|Discord.Collection<Discord.Snowflake, Discord.Message>>} A collection of messages recieved by the user that
	 * passed all requirements.
	 */
  prompt(message, options = {}) {
    return Call.prompt({ message, user: this.user, channel: options.channel || this.channel, options });
  }

  /**
   * Creates a modal prompt
   * @param {Modal} modal The modal to be sent (its custom id will be changed)
   * @param {*} options The options of the prompt
   * @returns {ModalSubmitInteraction}
   */
  async modalPrompt(modal, options = {}) {
    defaults(options, {
      interaction: this.interaction,
      promptOptions: { time: 600_000 },
      timeErrorResponseOptions: { content: 'Ran out of time for modal submit.', ephemeral: true }
    });

    await options.interaction.showModal(modal.setCustomId(`${modal.customId}_${makeId()}`));

    try {
      return await options.interaction.awaitModalSubmit({ filter: (i) => i.customId === modal.customId, ...options.promptOptions });
    } catch (err) {
      if (err.message === 'Collector received no interactions before ending with reason: time') {
        options.interaction.safeReply(options.timeErrorResponseOptions);
        
        throw new Error('Prompt ended: time');
      }
    }
  }

  async dmPrompt(message, options = {}, lC = false, convert = true) {
    if (typeof options === 'boolean') {
      convert = lC != null ? lC : true;
      lC = options;
      options = {};
    }

    return this.prompt(message, { ...options, channel: this.user.dmChannel || await this.user.createDM() })
      .then((m) => convert && m instanceof Message ? lC ? m.content.toLowerCase() : m.content : m);
  }
  
  async confirmationPrompt({
    content,
    embeds = [],
    buttonCount = 2,
    button1Text = 'Yes',
    button2Text = 'No',
    replyOptions,
    promptOptions,
    returnInteraction = false,
  }) {
    const messageButtons = [new MessageButton().setCustomId(`prompt_${button1Text.toLowerCase()}`).setStyle('SUCCESS').setLabel(button1Text)];

    if (buttonCount === 2) messageButtons.push(new MessageButton().setCustomId(`prompt_${button2Text.toLowerCase()}`).setStyle('DANGER').setLabel(button2Text));

    let message;

    if (replyOptions) {
      message = this.interaction
        .reply({ ...replyOptions, components: [new MessageActionRow().addComponents(...messageButtons)] })
        .then(() => this.interaction.fetchReply());
    } else {
      message = this.user.send({ content, embeds, components: [new MessageActionRow().addComponents(...messageButtons)] });
    }

    const interaction = await Buttons.createButtonPrompt(await message.catch(() => { throw new Error('Prompt ended: trigger message failed to send'); })).next(promptOptions);

    interaction.update({ components: [new MessageActionRow().addComponents(...interaction.message.components[0].components.map((c) => new MessageButton(c).setDisabled(true)))] });

    return returnInteraction ? interaction : interaction.customId.endsWith(button1Text.toLowerCase());
  }
}

Call.prompts = [];

module.exports = Call;