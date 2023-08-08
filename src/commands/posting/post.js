'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders'),
  fs = require('fs'),
  preview = require('../../util/postPreview.js'),
  constants = require('../../util/constants.js'),
  { MessageEmbed } = require('discord.js'),
  { stripIndents } = require('common-tags');

const options = fs
    .readdirSync(`${__dirname}/post-options`)
    .map((name) => {
      try {
        return require(`./post-options/${name}`);
      } catch (err) {
        process.emit('logBotError', err);

        return {};
      }
    })
    .filter((o) => o != null),
  filter = options.map((opt) => opt.id);

module.exports = {
  useAnywhere: false,
  data: new SlashCommandBuilder()
    .setName('post')
    .setDescription('Starts a prompt to create a marketplace post.')
    .addStringOption((option) =>
      option.setName('post_type')
        .setDescription('The type of post.')
        .setRequired(false)
        .addChoices(...options.map((o) => ({ name: o.id, value: o.id })))),
  exec: async function(call) {

	return call.interaction.reply({ content: "This command has been disabled. Go to <#535514713870565376> and run the command there.", ephemeral: true });

    const member = await call.client.HD?.members.fetch(call.user.id).catch(() => null);

    if (!member)
      return call.interaction.reply({ content: 'You cannot use this command as you are not in the Hidden Developers server.', ephemeral: true });

    if (call.client.cantPost(call, member))
      return;

    const DOT_EMOJI = call.client.emojis.cache.get(constants.DOT_EMOJI) || '-';

    try {
      await call.user.createDM();

      if (call.interaction.channel.type !== 'DM')
        await call.interaction.reply({ content: 'The prompt will continue in your direct messages.', ephemeral: true });

      if (!(await call.confirmationPrompt({
        embeds: [
          new MessageEmbed()
            .setColor(call.client.DEFAULT_EMBED_COLOR)
            .setTitle('Prompt Part 1/2')
            .setDescription(stripIndents`${DOT_EMOJI} All posts/posters are subject to a possible Marketplace moderation depending on the post(s) content or user(s) actions.
							${DOT_EMOJI} Users are required to have the role of the skill for the type of development they are hireable for.
							${DOT_EMOJI} Hiring posts must offer at least 500R or $1.75 USD, Builder-Hiring is a minimum of 1000R or $3.50 USD, Programmer-Hiring (non-lua) is a minimum of $5.00 USD.
							${DOT_EMOJI} Prices should be reasonable and reflect the complexity of the project; whilst you are free to negotiate, an initial amount or range must be present in your listing.
							${DOT_EMOJI} When making a post, be specific with what your offer entails; users should know a basis of what you are looking for or hireable for.
							${DOT_EMOJI} [“Shotgun” posts](https://i.gyazo.com/c0a99cb8e88b20bf929534b9951f9b78.png) will be declined; these listings ask for multiple types of developers and repeat a generalized request across multiple categories.
							${DOT_EMOJI} Gift Cards, Group Items, Community Items, In-Game Items & Limiteds do not suffice as payment.
							${DOT_EMOJI} If offering a percentage of revenue (e.g. for a game), the game must already be released and have a following, future game revenue is not permitted in our marketplace, as it will typically lead to no payment.
							${DOT_EMOJI} Be sure to use grammar in your post, have more than little to no detail, and use no profanity.
							${DOT_EMOJI} Purchasing an asset does not mean you can resell or redistribute it; the original creator retains the copyright and has merely licensed its use to you. Always get written permission from the original developer/creator before redistributing it.
							${DOT_EMOJI} Asking for developers, work or posting to hire/sell outside of the marketplace or via DMs is a punishable offence.
							${DOT_EMOJI} Posts that contain academics to be completed for money or academic tutoring are not permitted; this is considered cheating and unethical.`),
          new MessageEmbed()
            .setColor(call.client.DEFAULT_EMBED_COLOR)
            .setTitle('Prompt Part 2/2')
            .setDescription(stripIndents`${DOT_EMOJI} Staff hiring is not allowed (e.g. for a group, project managers, community staff).
							${DOT_EMOJI} Server creator posts are strictly prohibited.
							${DOT_EMOJI} Posting on someone else's behalf is not allowed, this includes development managers, project managers, any type of staff member or co-owner that is not paying the developer(s).
							${DOT_EMOJI} <#570699696113319966>, listings require relevant development roles. See \`/tag view tag:app\` for details.
							${DOT_EMOJI} At the moment, only PayPal and Robux are supported as payment methods. Due to the need for personal details, ApplyPay, GooglePay, CashApp, etc are not suitable as payment methods.
							${DOT_EMOJI} In order to make yourself hireable, in the post you must include a portfolio with at least 3 examples, or at least 3 examples of previous work. Images, Videos, DevForum Posts, (Discord servers are limited to bot developers), Artstation, GitHub, PasteBin, Social media postings, Legitimate Portfolio sites suffice as portfolios.
							${DOT_EMOJI} Google Docs/Slides/Drive are no longer supported as portfolios. They are very hard to backcheck work.
							${DOT_EMOJI} Selling and investing are not allowed. See \`/tag view tag:discontinued\` for details.
							${DOT_EMOJI} Tutoring/Other must be development-related.\n\nOnce you have read and understood all the above information, please click \`Next\`.\n\nClick \`Cancel\` to cancel the prompt.`)
            .setFooter({ text: 'The prompt will end in 3 minutes' })
        ],
        button1Text: 'Next',
        button2Text: 'Cancel',
        promptOptions: {
          timeout: 180000,
        },
      })))
        return call.user.send('Cancelled Prompt.');

      var type = call.interaction.options.getString('post_type')
        ?? await call.dmPrompt(`What type of listing is this?\n> ${filter.map((m) => `\`${m}\``).join(', ')}`, { filter }, true);
    } catch (err) {
      if (err.message === 'Prompt ended: trigger message failed to send')
        return call.interaction.editReply('Failed to direct message you. Please check your privacy settings and try again.');

      return;
    }

    try {
      await options.find((o) => o.id === type.toLowerCase()).exec(call, preview, options);
    } catch (err) {
      if (err.message.endsWith('time') || err.message.endsWith('cancelled')) return;

      process.emit('logBotError', err);
      call.user.send('An error occurred with the prompt. Please report this issue in the <#669267304101707777> channel.');
    }
  },
};
