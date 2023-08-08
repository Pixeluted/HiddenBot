'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders'),
  { MessageEmbed } = require('discord.js'),
  { parseImage } = require('../../util/common.js'),
  { isBad } = require('../../load/filter'),
  timers = require('../../load/timers.js'),
  prettyMs = require('pretty-ms'),
  Suggestion = require('../../util/suggestion.js');

const WAIT_TIME_NORMAL = 21_600_000,
  WAIT_TIME_PATREON = 10_800_000;

module.exports = {
  useAnywhere: false,
  data: new SlashCommandBuilder()
    .setName('suggest')
    .setDescription('Starts a prompt to post a suggestion.'),
  exec: async (call) => {
    const suggestionChannel = call.client.channels.cache.get(call.client.SUGGESTIONS_CHANNEL),
      suggestionApprovalChannel = call.client.channels.cache.get(call.client.SUGGESTIONS_APPROVAL_CHANNEL);

    if (!suggestionChannel || !suggestionApprovalChannel)
      return call.interaction.reply({ content: 'Suggestions are currently closed. Please try again later.', ephemeral: true });

    const patreon = call.client.isPatreon(call.user, 'either'),
      member = await call.client.HD?.members.fetch(call.user.id).catch(() => null);

    if (!member) return call.interaction.reply({ content: 'You cannot use this command as you are not in the Hidden Devs server.', ephemeral: true });

    // if (call.client.cantSuggest(call, member)) return;

    if (call.interaction.channel.type !== 'DM')
      call.interaction.reply({ content: 'The prompt will continue in your direct messages.', ephemeral: true });

    const timer = timers.list.find((timer) => timer.type === 'suggestionPost' && timer.info.userId === call.user.id);

    if (timer) {
      return call.user.send(
        `Please wait \`${prettyMs(timer.time - Date.now(), {
          verbose: true,
          secondsDecimalDigits: 0,
          unitCount: 2,
        })}\` before sending another suggestion.`
      );
    }

    const suggestions = [];

    await call.dmPrompt(
      'Please state your suggestion(s). \n\n' +
      'Some things to note: \n' +
      '> State your suggestion in a clear, easy to understand manner. \n' +
      '> Your suggestion will be reviewed by staff members before it is posted. \n' +
      '> Your suggestion must meet our word filter. To test if your suggestion passes the word filter, cancel this prompt and run `/test string:<suggestion>`. \n\n' +
      `You can send up to ${patreon ? '10' : '5'} suggestions in this prompt. Once you are finished, reply with \`done\` to move forward.`,
      {
        messages: patreon ? 10 : 5,
        time: 600000,
        correct: (m) => m.correct,
        attempts: patreon ? 20 : 10,
        matchUntil: (m) => m.content.toLowerCase() === 'done' && suggestions.length,
        filter: (m) => {
          if (m.content.toLowerCase() === 'done') {
            if (suggestions.length) return true;

            m.correct = 'At least one suggestion is required';

            return false;
          } else if (suggestions.find((s) => s.text === m.content)) {
            m.correct = 'You have already provided this suggestion';

            return false;
          } else if (isBad(m.content)) {
            m.correct = 'Your suggestion does not meet our word filter. Please make sure it meets our filter and try again';

            return false;
          }

          suggestions.push({ text: m.content, image: null });
          m.channel.send(`Successfully saved \`${m.content}\``);

          return true;
        },
      },
      true
    );

    const suggestEmbed = new MessageEmbed()
      .setColor(call.client.DEFAULT_EMBED_COLOR)
      .setDescription('Please note, once approved your suggestions will be sent individually, not how they are displayed on this embed.')
      .setTitle('Suggestion')
      .setFooter({ text: `Suggestion by ${call.user.username} (${call.user.id})`, iconURL: call.user.displayAvatarURL() });

    for (const [index, suggestion] of suggestions.entries()) {
      await call.dmPrompt(
        `Provide an image (link or attachment) to include with your suggestion.\n\nSelected suggestion:\n> \`${suggestion.text}\` \n\nSay \`skip\` if you do not desire to include an image with this suggestion.`,
        {
          correct: (m) => m.correct,
          filter: (m) => {
            if (parseImage(m) === m.content && m.content.toLowerCase() !== 'skip') {
              m.correct = 'Invalid image provided. Please send a valid image (link or attachment) or say `skip` if you do not desire to include an image.';

              return false;
            }

            suggestion.image = parseImage(m);

            return true;
          },
        },
        false,
        false
      );

      suggestEmbed.addField(`Suggestion \`${index + 1}\``, `> ${suggestion.text} \n**Image:** ${suggestion.image?.toLowerCase() !== 'skip' ? `[Link](${suggestion.image})` : 'None attached'}`);
    }

    if (!(await call.confirmationPrompt({
      content: `Here is a preview of your suggestion${suggestions.length > 1 ? 's' : ''}. If you wish to send ${suggestions.length > 1 ? 'them' : 'it'} for approval, click \`Yes\`. Otherwise, click \`no\`.`,
      embeds: [suggestEmbed],
    })))
      return call.interaction.reply(`Your suggestion${suggestions.length > 1 ? 's were' : ' was'} not sent.`);

    const message = {
      id: call.interaction.id,
      author: call.user,
      client: call.client
    };

    for (const suggestion of suggestions)
      new Suggestion(suggestion.text, suggestion.image, message, patreon).sendForApproval();

    call.user.send(`Your suggestion${suggestions.length > 1 ? 's were' : ' was'} sent.`);

    // Creating the timer that prevents the user from posting a suggestion within the specified time limit
    timers.create('suggestionPost', { userId: call.user.id }, Date.now() + (patreon ? WAIT_TIME_PATREON : WAIT_TIME_NORMAL));
  },
};
