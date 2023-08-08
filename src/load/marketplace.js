'use strict';

const { stripIndents } = require('common-tags'),
  { MessageEmbed, MessageButton, MessageActionRow, MessageSelectMenu } = require('discord.js'),
  { getClient } = require('./database.js'),
  { formatDateEmbed, makeId, titleCase } = require('../util/common.js'),
  MarketplacePost = require('../util/post.js'),
  buttons = require('./buttons.js'),
  timers = require('./timers.js'),
  Call = require('../handler/Call.js'),
  ms = require('ms');

const QUEUE_SIZE_COLORS = {
    45: 'ED4245',
    40: 'E5552F',
    35: 'D96617',
    30: 'CA7500',
    25: 'B98200',
    20: 'A68E00',
    15: '919800',
    10: '7BA019',
    5: '61A835',
    0: '3FAE4F',
  },
  MARKETPLACE_DENY_RESPONSE_OPTIONS = [
    {
      label: 'Selling',
      value: 'selling',
      description: 'Selling is not allowed at HD.'
    },
    {
      label: 'Past Work',
      value: 'past_work',
      description: 'You must have a minimum of 3 examples of your past work.'
    },
    {
      label: 'Future Game Revenue',
      value: 'future_game_revenue',
      description: 'Offering percentages is not allowed at HD unless the game is released and is already making profit.'
    },
    {
      label: 'Payment',
      value: 'payment',
      description: 'PayPal and Robux are the only supported payment methods.'
    },
    {
      label: 'Grammar',
      value: 'grammar',
      description: 'Proper grammar, spelling and punctuation is required in your post.'
    },
    {
      label: 'Lacking Detail',
      value: 'lacking_detail',
      description: 'More information/detail is required in your post.'
    },
    {
      label: 'Google Portfolio',
      value: 'google_portfolio',
      description: 'Google Docs/Google Slides/Google Drive do not suffice as portfolio sites.'
    },
    {
      label: 'Lacking Roles',
      value: 'lacking_roles',
      description: 'For Hire/Tutor posts require you to have the skill roles that the post entails.'
    },
    {
      label: 'Staff Hiring',
      value: 'staff_hiring',
      description: 'Staff hiring is not permitted at HD.'
    },
    {
      label: 'Shotgun Post',
      value: 'shotgun_post',
      description: 'Hiring more than one type of developer in a single post is not allowed.'
    }
  ];

function makeSessionComponents(sessionId) {
  return [
    new MessageActionRow()
      .addComponents(
        new MessageButton()
          .setCustomId(`marketplace_session_first_${sessionId}`)
          .setLabel('Start')
          .setStyle('PRIMARY'),
        new MessageButton()
          .setCustomId(`marketplace_session_previous_${sessionId}`)
          .setLabel('Previous')
          .setStyle('PRIMARY'),
        new MessageButton()
          .setCustomId(`marketplace_session_next_${sessionId}`)
          .setLabel('Next')
          .setStyle('PRIMARY'),
        new MessageButton()
          .setCustomId(`marketplace_session_last_${sessionId}`)
          .setLabel('End')
          .setStyle('PRIMARY')
      ),
    new MessageActionRow()
      .addComponents(
        new MessageButton()
          .setCustomId(`marketplace_session_approve_${sessionId}`)
          .setLabel('Approve')
          .setStyle('SUCCESS'),
        new MessageButton()
          .setCustomId(`marketplace_session_deny_${sessionId}`)
          .setLabel('Deny')
          .setStyle('DANGER'),
        new MessageButton()
          .setCustomId(`marketplace_session_change_channel_${sessionId}`)
          .setLabel('Change Channel')
          .setStyle('PRIMARY'),
        new MessageButton()
          .setCustomId(`marketplace_session_claim_${sessionId}`)
          .setLabel('Claim')
          .setStyle('SECONDARY'),
        new MessageButton()
          .setCustomId(`marketplace_session_auto_approve_${sessionId}`)
          .setLabel('Auto Approve')
          .setStyle('SUCCESS')
      ),
    new MessageActionRow()
      .addComponents(
        new MessageSelectMenu()
          .setCustomId(`marketplace_session_filter_menu_${sessionId}`)
          .setPlaceholder('Post filter')
          .addOptions(
            { label: 'Unclaimed', value: 'unclaimed', description: 'Unclaimed pending posts.' },
            { label: 'Claimed', value: 'claimed', description: 'Posts claimed by you.' },
            { label: 'All Claimed', value: 'all_claimed', description: 'Posts claimed by anyone.' }
          )
      ),
    new MessageActionRow()
      .addComponents(
        new MessageButton()
          .setCustomId(`marketplace_session_end_${sessionId}`)
          .setLabel('End Session')
          .setStyle('DANGER')
      )
  ];
}

function makeDisabledSessionComponents(sessionId) {
  const rows = makeSessionComponents(sessionId);

  rows.forEach((row) => {
    row.components.forEach((button) => {
      button.setDisabled(true);
    });
  });

  return rows;
}

function replyError(interaction, message) {
  interaction.reply({
    embeds: [
      new MessageEmbed()
        .setColor('RED')
        .setTitle('Error')
        .setDescription(message)
    ],
    ephemeral: true
  });
}

function findLastIndex(array, predicate) {
  let l = array.length;

  while (l--) {
    if (predicate(array[l], l, array))
      return l;
  }

  return -1;
}

function createTimer(post) {
  setTimeout(async () => {
    if (post.info.status !== 'pending')
      return;

    const user = await post.client.users.fetch(post.info.claimerId).catch(() => null);

    if (!user)
      return;

    user.send({
      content: `You have had the following post on hold since ${formatDateEmbed(post.info.claimedAt)}.`,
      embeds: [await post.embed()]
    });
    post.info.claimedWarningAt = Date.now();
    post.update();

    createTimer(post);
  }, ((post.info.claimedWarningAt ?? post.info.claimedAt) + ms('25h')) - Date.now());
}

async function addQuota(userId, approved) {
  // Insert if not exists
  await getClient().query('INSERT INTO public.quotas ("user") SELECT $1 WHERE NOT EXISTS (SELECT 1 FROM public.quotas WHERE "user" = $1)',
    [userId]);

  return getClient().query('UPDATE public.quotas SET mp = array_append(mp, $2) WHERE "user" = $1',
    [userId, { approved, date: Date.now() }]);
}

module.exports = {
  id: 'marketplace',
  exec: async (client) => {
    // Purge posts older than 2 months
    await getClient().query('DELETE FROM public.posts WHERE "created_at" < now() - interval \'2 mon\'');

    // Load posts
    await getClient()
      .query('SELECT "id", "info", "post_info" FROM public.posts')
      .then((res) => res.rows.forEach((post) => new MarketplacePost(post.id, post.post_info, post.info, client)));
    
    MarketplacePost.loaded = true;

    // Remind users when they have held a post for 25 hours
    for (const post of MarketplacePost.pendingList.values()) {
      if (!post.info.claimedAt)
        continue;
        
      createTimer(post);
    }

    // Edit the session creation message
    setInterval(async () => {
      const message = await client.channels.cache
        .get(client.MARKETPLACE_APPROVAL_CHANNEL)
        .messages.fetch(client.MARKETPLACE_SESSION_MESSAGE)
        .catch(() => {});

      if (!message)
        return;

      const pending = MarketplacePost.pendingList.filter((post) => post.info.status === 'pending'),
        pendingUnclaimed = pending.filter((post) => !post.info.claimed);

      message.edit({
        embeds: [
          new MessageEmbed()
            .setColor(client.DEFAULT_EMBED_COLOR)
            .setTitle('Create Marketplace Session')
            .setDescription('Click the button below to create a marketplace session.'),
          new MessageEmbed()
            .setColor(
              Object
                .entries(QUEUE_SIZE_COLORS)
                .reverse()
                .find(([size]) => size <= pendingUnclaimed.size)[1]
            )
            .setDescription(
              stripIndents`Current Queue Size: \`${pendingUnclaimed.size}\`
								Current Claimed Size: \`${pending.size - pendingUnclaimed.size}\``
            )
        ]
      });
    }, 30000);

    const botLogs = client.channels.cache.get(client.BOT_LOGS_CHANNEL);

    client.botLogs = botLogs;

    // Manage approving, denying and reporting marketplace posts
    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isButton() || !interaction.customId.startsWith('marketplace_')) return;

      const { user } = interaction;

      if (interaction.customId === 'marketplace_begin_session') {
        const sessionId = makeId(),
          prompt = buttons.createButtonPrompt(sessionId),
          session = {
            sessionId,
            index: -1,
            currentList: 'unclaimed',
            interaction
          };
				
        if (user.session) {
          user.session.post?.disableActive();
          user.session.interaction.editReply({ content: 'This session has been ended. You may dismiss this message.', embeds: [], components: [] }).catch(() => {});
        }

        console.log('created session property');
        user.session = session;

        await interaction.reply({
          embeds: [
            new MessageEmbed()
              .setColor(client.DEFAULT_EMBED_COLOR)
              .setDescription('You\'ve reached the start of the queue. To go forward, press the `Next` button.')
          ],
          components: makeSessionComponents(sessionId),
          ephemeral: true
        }).catch(console.error);

        // eslint-disable-next-line no-constant-condition
        while (true) {
          try {
            const sorted = [...MarketplacePost.pendingList.values()].sort(MarketplacePost.queueSort),
              claimedPosts = sorted.filter((post) => post.info.claimed && post.info.claimerId === user.id),
              posts = session.currentList === 'unclaimed' ? sorted.filter((post) => !post.info.claimed)
              : session.currentList === 'claimed' ? claimedPosts
              : sorted.filter((post) => post.info.claimed),
              int = await prompt.next(),
              updateMessage = async (post) => {
                if (!int.replied && !int.deferred)
                  int.deferUpdate();

                const embeds = [
                  new MessageEmbed()
                    .setColor(client.DEFAULT_EMBED_COLOR)
                    .setDescription(stripIndents`Queue: \`${sorted.filter((post) => post.info.status === 'pending' && !post.info.claimed).length}\`
                      Author: <@${post.info.authorId}> @ ${formatDateEmbed(post.info.createdAt, 'R')}
                      Channel: <#${post.postInfo.channel}>

                      ${post.info.claimerId ? `Claimed By: ${post.info.claimerId ? `<@${post.info.claimerId}>` : '`no one`'}\nClaimed On: ${post.info.claimedAt ? formatDateEmbed(post.info.claimedAt) : '`N/A`'}` : ''}`
                    ),
                  await post.embed()
                ];

                if (post.postInfo.approvedCount >= 3 && client.HD.members.cache.get(int.user.id)?.roles.cache.has(client.SENIOR_MARKETPLACE_STAFF))
                  embeds.splice(1, 0,
                    new MessageEmbed()
                      .setColor('RED')
                      .setDescription(`This post has been approved \`${post.postInfo.approvedCount}\` times. Consider enabling it for auto approval.`)
                  );

                interaction.editReply({
                  content: `<@${post.info.authorId}>`,
                  embeds
                });
              },
              updatePost = async (post, i) => {
                if (session.post)
                  session.post.disableActive();
										
                session.index = i;

                if (post) {
                  session.post = post;
                  session.post.enableActive();

                  updateMessage(post);
                } else {
                  if (!int.replied && !int.deferred)
                    int.deferUpdate();

                  session.post = undefined;
                  interaction.editReply({
                    content: null,
                    embeds: [
                      new MessageEmbed()
                        .setColor(client.DEFAULT_EMBED_COLOR)
                        .setDescription(
                          i === Infinity ? 'You\'ve reached the end of the queue. To go back, press the `Previous` button.'
                          : 'You\'ve reached the start of the queue. To go forward, press the `Next` button.'
                        )
                    ]
                  });
                }
              },
              changeList = (list) => {
                session.currentList = list;
                session.index = -1;
                session.post?.disableActive();
              };

            // If the sessionId doesn't match up (new session)
            if (!int.customId.endsWith(user.session?.sessionId))
              break;

            if (int.customId === `marketplace_session_first_${sessionId}`) {
              updatePost(null, -1);
            } else if (int.customId === `marketplace_session_last_${sessionId}`) {
              updatePost(null, Infinity);
            } else if (int.customId === `marketplace_session_next_${sessionId}`) {
              const nextPostIndex = posts.findIndex((post, i) => i > session.index && post.canManage(user.id)),
                nextPost = posts[nextPostIndex];

              updatePost(nextPost, nextPostIndex === -1 ? Infinity : nextPostIndex);
            } else if (int.customId === `marketplace_session_previous_${sessionId}`) {
              const previousPostIndex = findLastIndex(posts, (post, i) => i < session.index && post.canManage(user.id)),
                previousPost = posts[previousPostIndex];

              updatePost(previousPost, previousPostIndex);
            } else if (int.customId === `marketplace_session_approve_${sessionId}`) {
              if (!session.post) {
                replyError(int, 'No post selected to approve.');

                continue;
              }

              session.post.approve(user).then(async () => {
                const embed = await session.post.embed();

                botLogs?.send({
                  embeds: [
                    embed
                      .setColor('GREEN')
                      .setTitle('Marketplace Post Approved')
                      .setFooter({ text: `Approved by ${user.tag}` })
                  ]
                });
						
                session.post
                  .getAuthor()
                  .then(async (u) => u.send({ content: `Your post was approved by ${user} (${user.tag}).`, embeds: [embed] }))
                  .catch(() => {});

                session.post = undefined;

                addQuota(user.id, true);

                const nextPostIndex = posts.findIndex((post, i) => i > session.index && post.canManage(user.id)),
                  nextPost = posts[nextPostIndex];

                updatePost(nextPost, nextPostIndex === -1 ? Infinity : nextPostIndex);
              }, () => int.reply({ content: 'Failed to approve post', ephemeral: true }));
            } else if (int.customId === `marketplace_session_deny_${sessionId}`) {
              if (!session.post) {
                replyError(int, 'No post selected to deny.');

                continue;
              }

              // Disable session message components while prompts are active
              interaction.editReply({ components: makeDisabledSessionComponents(sessionId) });
							
              // Prompts
              const buttonPromptId = makeId(),
                buttonPrompt = buttons.createButtonPrompt(buttonPromptId),
                messagePromptPromise = Call.prompt({
                  channel: int.channel,
                  user: user,
                  options: { cancellable: false, autoRespond: false },
                  invisible: true
                }).then((msg) => {
                  msg.delete();
	
                  if (msg.content.toLowerCase() === 'cancel') {
                    int.editReply({ content: 'Cancelled deny prompt. You may dismiss this message.', embeds: [], components: [], ephemeral: true });
	
                    return null;
                  }
	
                  return msg.content;
                }, () => null),
                // Get latest pushed prompt (this prompt)
                messagePrompt = Call.prompts[Call.prompts.length - 1];

              int.reply({
                embeds: [
                  new MessageEmbed()
                    .setTitle('Prompt')
                    .setDescription('Please state the reason why this post is being declined or select an auto response from below.\n\nRespond with `cancel` to end this prompt.')
                    .setColor(client.DEFAULT_EMBED_COLOR)
                    .setFooter({ text: 'This prompt will end in 3 minutes.' })
                ],
                ephemeral: true,
                components: [
                  new MessageActionRow()
                    .addComponents(
                      new MessageSelectMenu()
                        .setCustomId(`marketplace_deny_response_menu_${buttonPromptId}`)
                        .setPlaceholder('Click here to choose auto responses')
                        .addOptions(MARKETPLACE_DENY_RESPONSE_OPTIONS)
                    )
                ]
              });

              // Race menu prompt vs message prompt
              const reason = await Promise.race([
                messagePromptPromise,
                buttonPrompt.next().then((promptInteraction) => {
                  return MARKETPLACE_DENY_RESPONSE_OPTIONS.find((option) => option.value === promptInteraction.values[0]).description;
                }, () => null)
              ]);

              messagePrompt.end();

              // Enable session message components
              interaction.editReply({ components: makeSessionComponents(sessionId) });

              if (!reason)
                continue;
								
              const timer = timers.list.find((timer) => timer.type === 'post' && timer.info.userId === session.post.info.authorId);

              if (timer) timers.delete(timer.time);

              session.post.deny(
                user,
                reason
              ).then(async () => {
                int.editReply({ content: 'Successfully denied post. You may dismiss this message.', embeds: [], components: [], ephemeral: true });
                botLogs?.send({
                  embeds: [
                    (await session.post.embed())
                      .setColor('RED')
                      .setTitle('Marketplace Post Denied')
                      .addField('Reason', `\`\`\`${reason}\`\`\``)
                      .setFooter({ text: `Denied by ${user.tag}` })
                  ]
                });

                session.post = undefined;

                addQuota(user.id, false);

                const nextPostIndex = posts.findIndex((post, i) => i > session.index && post.canManage(user.id)),
                  nextPost = posts[nextPostIndex];

                updatePost(nextPost, nextPostIndex === -1 ? Infinity : nextPostIndex);
              }, () => int.reply({ content: 'Failed to deny post', ephemeral: true }));
            } else if (int.customId === `marketplace_session_change_channel_${sessionId}`) {
              if (!session.post) {
                replyError(int, 'No post selected to change the channel of.');

                continue;
              }

              const marketplace = session.post.postInfo.category === 'hireable' ? client.FOR_HIRE_MARKETPLACE : client.HIRING_MARKETPLACE,
                options = Object.keys(marketplace).concat('cancel');

              // Prompt
              int.reply({
                embeds: [
                  new MessageEmbed()
                    .setTitle('Prompt')
                    .setDescription(`What channel would you like to redirect the post to? Choices: \`${options.join('`, `')}\``)
                    .setColor(client.DEFAULT_EMBED_COLOR)
                    .setFooter({ text: 'This prompt will end in 3 minutes.' })
                ],
                ephemeral: true
              });
              // Disable session message components
              interaction.editReply({ components: makeDisabledSessionComponents(sessionId) });

              const channel = await Call.prompt({
                channel: int.channel,
                user,
                options: {
                  filter: options,
                  cancellable: false,
                  autoRespond: false,
                  correct: (m) => m.delete() && undefined,
                  noCorrect: true
                }
              }).then((msg) => {
                msg.delete();

                if (msg.content.toLowerCase() === 'cancel') {
                  int.editReply({ content: 'Cancelled prompt. You may dismiss this message.', embeds: [], ephemeral: true });

                  return null;
                }

                return msg.content;
              });

              // Enable session message components
              interaction.editReply({ components: makeSessionComponents(sessionId) });
							
              if (!channel)
                continue;

              session.post.postInfo.type = channel;
              session.post.postInfo.channel = marketplace[channel];

              session.post.update();

              updatePost(session.post, session.index);
              int.editReply({ content: `Successfully changed post channel to <#${session.post.postInfo.channel}>. You may dismiss this message.`, embeds: [], ephemeral: true });
            } else if (int.customId === `marketplace_session_claim_${sessionId}`) {
              if (!session.post) {
                replyError(int, 'No post selected to claim.');

                continue;
              }

              if (session.post.info.claimerId === user.id) {
                replyError(int, 'You have already claimed this post.');

                continue;
              }

              if (session.post.info.claimed) {
                // Prompt
                int.reply({
                  embeds: [
                    new MessageEmbed()
                      .setTitle('Prompt')
                      .setDescription(`This post is already claimed by <@${session.post.info.claimerId}>. Would you like to override their claim? Respond with \`yes\` or \`no\`.`)
                      .setColor(client.DEFAULT_EMBED_COLOR)
                      .setFooter({ text: 'This prompt will end in 3 minutes.' })
                  ],
                  ephemeral: true
                });
                // Disable session message components
                interaction.editReply({ components: makeDisabledSessionComponents(sessionId) });

                const confirmation = await Call
                  .prompt({
                    channel: int.channel,
                    user: user,
                    options: {
                      filter: ['yes', 'no'],
                      cancellable: false,
                      autoRespond: false,
                      correct: (m) => m.delete() && undefined,
                      noCorrect: true
                    }
                  })
                  .then((msg) => msg.delete() && msg.content.toLowerCase() === 'yes');

                // Enable session message components
                interaction.editReply({ components: makeSessionComponents(sessionId) });
								
                if (!confirmation) {
                  int.editReply({ content: 'Cancelled claim prompt. You may dismiss this message.', embeds: [], ephemeral: true });

                  continue;
                }
              }

              session.post.info.claimed = true;
              session.post.info.claimerId = user.id;
              session.post.info.claimedAt = Date.now();
							
              session.post.update();

              const nextPostIndex = posts.findIndex((post, i) => i > session.index && post.canManage(user.id)),
                nextPost = posts[nextPostIndex];

              updatePost(nextPost, nextPostIndex === -1 ? Infinity : nextPostIndex);
									
              (int.replied ? int.editReply : int.reply).bind(int)({
                content: 'Successfully claimed this post. You can view your claimed post at any time using the designated button. You may dismiss this message.',
                embeds: [],
                ephemeral: true
              });
            } else if (int.customId === `marketplace_session_auto_approve_${sessionId}`) {
              if (!session.post) {
                replyError(int, 'No post selected to auto-approve.');

                continue;
              }

              if (!client.HD.members.cache.get(int.user.id)?.roles.cache.has(client.SENIOR_MARKETPLACE_STAFF)) {
                int.reply({ content: 'You do not have permission to toggle on auto-approve posts. You may dismiss this message.', ephemeral: true });

                continue;
              }

              session.post.postInfo.autoApprove = true;
              session.post
                .getAuthor()
                .then(async (u) => u.send({ content: `Your post was approved by ${user} (${user.tag}). Your post has been toggled for auto approval. Run \`/tag view tag:auto-approve\` for more details.`, embeds: [await session.post.embed()] }))
                .catch(() => {});
              session.post.update();

              int.reply({ content: 'Enabled this post for auto approval. However, you still have to approve this post. You may dismiss this message.', ephemeral: true });
            } else if (int.customId === `marketplace_session_filter_menu_${sessionId}`) {
              const formattedValue = int.values[0].replace(/_/g, ' ');

              if (session.currentList === int.values[0]) {
                int.reply({ content: `You are already filtering by ${formattedValue} posts. You may dismiss this message.`, ephemeral: true });

                continue;
              }

              if (int.values[0] === 'all_claimed' && !client.HD.members.cache.get(int.user.id)?.roles.cache.has(client.SENIOR_MARKETPLACE_STAFF)) {
                int.reply({ content: 'You do not have permission to filter by all claimed posts. You may dismiss this message.', ephemeral: true });

                continue;
              }

              changeList(int.values[0]);
              int.update({
                embeds: [
                  new MessageEmbed()
                    .setColor(client.DEFAULT_EMBED_COLOR)
                    .setTitle(`${titleCase(formattedValue)} Posts`)
                    .setDescription(`Click \`Next\` in order to begin scrolling through ${formattedValue} posts.`)
                ]
              });
            } else if (int.customId === `marketplace_session_end_${sessionId}`) {
              interaction.editReply({ content: 'This session has been ended. You may dismiss this message.', embeds: [], components: [] });

              break;
            }
          } catch (err) {
            interaction.editReply({ content: 'This session has been ended. You may dismiss this message.', embeds: [], components: [] });
            process.emit('logBotError', err);

            break;
          }
        }
      } else if (interaction.customId === 'marketplace_remove_auto_approve') {
        if (!client.HD.members.cache.get(interaction.user.id)?.roles.cache.has(client.SENIOR_MARKETPLACE_STAFF))
          return interaction.reply({ content: 'You do not have permission to toggle off auto-approve posts. You may dismiss this message.', ephemeral: true });

        const postId = interaction.message.embeds[0].title.match(/[a-zA-Z]{10}(?=\))/)[0],
          post = MarketplacePost.list.get(postId);

        if (!post)
          return interaction.reply({ content: 'Failed to find this post.', ephemeral: true });
      
        post.postInfo.autoApprove = false;
        post.update();

        interaction.reply({ content: 'Removed this post from being auto approved', ephemeral: true });
      }
    });
  },
};
