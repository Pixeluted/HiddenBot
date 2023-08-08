'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders'),
  prettyMs = require('pretty-ms'),
  MarketplacePost = require('../../util/post.js'),
  { list } = require('../../load/timers.js'),
  preview = require('../../util/postPreview.js'),
  { MessageEmbed, MessageActionRow, MessageSelectMenu } = require('discord.js'),
  { safeBlock, formatDateEmbed, makeId } = require('../../util/common.js'),
  buttons = require('../../load/buttons.js');

module.exports = {
  useAnywhere: false,
  data: new SlashCommandBuilder()
    .setName('repost')
    .setDescription('Starts a prompt to repost a prior post.'),
  exec: async (call) => {
	return call.interaction.reply({ content: "This command has been disabled. Go to <#535514713870565376> and run the command there.", ephemeral: true });

    const posts = [...MarketplacePost.list.values()]
      .filter((post) => post.info.authorId === call.user.id && post.info.status === 'approved')
      .sort((a, b) => b.info.createdAt - a.info.createdAt)
      .slice(0, 10);

    if (posts.length === 0)
      return call.interaction.reply({ content: 'You have no posts to send for reposting. Post data deletes after 2 months.', ephemeral: true });

    const member = !call.client.HD || await call.client.HD.members.fetch(call.user.id).catch(() => null);

    if (!member)
      return call.interaction.reply({ content: 'You cannot use this command as you are not in the Hidden Developers server.', ephemeral: true });

    if (call.client.cantPost(call, member)) return;

    const timer = list.find((timer) => timer.type === 'post' && timer.info.userId === call.user.id);

    if (timer) {
      return call.user.send(
        `Please wait \`${prettyMs(timer.time - Date.now(), {
          verbose: true,
          secondsDecimalDigits: 0,
          unitCount: 2,
        })}\` before attempting to post in this channel again.`
      );
    }

    const promptId = makeId(),
      prompt = await buttons.createButtonPrompt(promptId);

    call.interaction.reply({
      embeds: [
        new MessageEmbed()
          .setColor(call.client.DEFAULT_EMBED_COLOR)
          .setTitle('Prior Posts')
          .setDescription(
            posts
              .map((p, i) => `\`${i + 1}.\` ${p.postInfo.autoApprove ? `${call.client.STAR_100_EMOJI} ` : ''}<#${p.postInfo.channel}> \`\`${safeBlock(p.postInfo.description.replace(/\n/g, '').substring(0, 30))}\`\` ${formatDateEmbed(p.info.createdAt)}`)
              .join('\n')
          )
      ],
      components: [new MessageActionRow().addComponents(
        new MessageSelectMenu()
          .setCustomId(`repost_select_${promptId}`)
          .setPlaceholder('Select the desired post.')
          .setMaxValues(1)
          .addOptions(posts.map((p, i) => ({ label: (i + 1).toString(), value: p.id })))
      )],
      ephemeral: true
    });

    const promptInteraction = await prompt.next(),
      post = posts.find((p) => p.id === promptInteraction.values[0]);

    preview(
      call,
      new MarketplacePost(
        post.id,
        post.postInfo,
        {
          authorId: call.user.id,
          status: 'confirming'
        },
        call.client,
        true
      ),
      true,
      promptInteraction
    );
  },
};
