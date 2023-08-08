'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders'),
  { MessageEmbed } = require('discord.js'),
  { get: levenshtein } = require('fast-levenshtein'),
  { safeBlock, titleCase, parseTime } = require('../../util/common.js'),
  { getClient } = require('../../load/database.js'),
  sendPaged = require('../../util/sendPaged.js'),
  ROLES = require('../../util/roles.json');

const DEVELOPMENT_TAG_ROLES = {
    REPRESENTATIVE: '334511990678487050',
    SENIOR_REPRESENTATIVE: '501484302941552660',
    REPRESENTATIVE_MANAGEMENT: '735947741422813224',
  },
  OPTIONS = ['list', 'info', 'view'],
  MOD_OPTIONS = ['create', 'delete', 'edit', 'rename', 'alias', 'remove_alias', 'image'],
  INVALID_NAME_CHARS = /[\s`*|'_]/g,
  tags = [];

async function updateCache() {
  const fetched = await getClient().query('SELECT "name", aliases, "value", devtag, image_url FROM public.tags').then((res) => res.rows);

  tags.length = 0;
  tags.push(...fetched);
}

async function finishUpdate(call, response, message = false) {
  await updateCache();

  call.interaction.reply(response);
  message && call.user.send(response);
}

function embedTag(user, tag) {
  return new MessageEmbed()
    .setColor(user.client.INVISIBLE_COLOR)
    .setTitle(`${titleCase(tag.name.replace(/[^a-z]/g, ' '))} Tag`)
    .setDescription(tag.value)
    .setFooter({ text: `Requested by ${user.tag}`, iconURL: user.displayAvatarURL() })
    .setImage(tag.image_url);
}

// User is gt_c or Solo.
// OR User has any of the roles in the utility file, ASSISTANT role errluded.
function canModerateTags(member, isDevTag) {
  return ['118496586299998209'].includes(member.id) || member.roles?.cache.some((role) => Object.values(isDevTag ? DEVELOPMENT_TAG_ROLES : ROLES).includes(role.id));
}

function findTag(name, reverse = false, nameOnly = false) {
  if (name === 'list' || name === 'info') return () => !reverse;

  return !reverse ? (tag) => tag.name === name || (!nameOnly && tag.aliases.includes(name)) : (tag) => tag.name !== name && (nameOnly || !tag.aliases.includes(name));
}

// Tag (channel) specific cooldowns

const COOLDOWN = 15000,

  onCooldown = {};

function removeCooldown(tag, channel) {
  const timeout = onCooldown[`${tag}-${channel.id}`];

  clearTimeout(timeout);

  delete onCooldown[`${tag}-${channel.id}`];
}

function cooldown(user, tag, channel) {
  onCooldown[`${tag}-${channel.id}`] = setTimeout(() => removeCooldown(tag, channel), COOLDOWN);
}

updateCache();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tag')
    .setDescription('Allows the viewing, creation and editing of tags.')
    .addSubcommand((subcommand) => 
      subcommand
        .setName('view')
        .setDescription('View a tag.')
        .addStringOption((option) => 
          option
            .setName('tag')
            .setDescription('The name of the tag to view.')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addUserOption((option) => 
          option
            .setName('user')
            .setDescription('The user to mention.')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) => 
      subcommand
        .setName('list')
        .setDescription('Show the list of currently existing tags.')
        .addBooleanOption((option) => 
          option
            .setName('devtags')
            .setDescription('Whether to show the list of development tags instead of normal tags.')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) => 
      subcommand
        .setName('info')
        .setDescription('Shows the information about a tag.')
        .addStringOption((option) => 
          option
            .setName('tag')
            .setDescription('The name of the tag to view the information of.')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('Create a tag.')
        .addStringOption((option) =>
          option
            .setName('tag')
            .setDescription('The name of the tag to create.')
            .setRequired(true)
        )
        .addBooleanOption((option) =>
          option
            .setName('image')
            .setDescription('Whether you would like to be prompted to add an image to the tag.')
            .setRequired(false)
        )
        .addBooleanOption((option) =>
          option
            .setName('devtag')
            .setDescription('Whether this tag is a development tag or a normal tag.')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('delete')
        .setDescription('Delete a tag')
        .addStringOption((option) =>
          option
            .setName('tag')
            .setDescription('The name of the tag to delete.')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('edit')
        .setDescription('Edit a tag')
        .addStringOption((option) =>
          option
            .setName('tag')
            .setDescription('The name of the tag to edit.')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('rename')
        .setDescription('Rename a tag.')
        .addStringOption((option) =>
          option
            .setName('tag')
            .setDescription('The name of the tag to rename.')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('The new name of the tag.')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('alias')
        .setDescription('Add an alias to a tag.')
        .addStringOption((option) =>
          option
            .setName('tag')
            .setDescription('The name of the tag to add an alias to.')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName('alias')
            .setDescription('The alias to add.')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove_alias')
        .setDescription('Remove an alias from a tag.')
        .addStringOption((option) =>
          option
            .setName('tag')
            .setDescription('The name of the tag to remove an alias from.')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName('alias')
            .setDescription('The alias to remove.')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('image')
        .setDescription('Update or remove an image from a tag.')
        .addStringOption((option) =>
          option
            .setName('tag')
            .setDescription('The name of the tag to update the image of.')
            .setRequired(true)
        )
    ),
  autocomplete: (interaction) => {
    const value = interaction.options.getFocused();

    interaction.respond(
      tags
        .filter((tag) => tag.name.startsWith(value) || tag.aliases.some((a) => a.startsWith(value)))
        .sort((a, b) => a.name.startsWith(value) ? b.name.startsWith(value) ? a.name.localeCompare(b.name) : -1 : 1)
        .map((tag) => ({ name: tag.name, value: tag.name }))
        .slice(0, 25)
    );
  },
  tags,
  findTag,
  embedTag,
  exec: async (call) => {
    const command = call.interaction.options.getSubcommand(),
      isDevTag = call.interaction.options.getBoolean('devtag'),
      tagName = call.interaction.options.getString('tag'),
      newValue = call.interaction.options.getString('name') ?? call.interaction.options.getString('alias'),
      image = call.interaction.options.getBoolean('image'),
      userToMention = call.interaction.options.getUser('user'),
      tagMod = canModerateTags(call.member ?? call.user, isDevTag);

    if (command === 'list') {
      const tagsList = call.interaction.options.getBoolean('devtags') ? tags.filter((tag) => tag.devtag) : tags.filter((tag) => !tag.devtag);

      return sendPaged(call, new MessageEmbed().setColor(call.client.DEFAULT_EMBED_COLOR).setTitle('Tag List'), {
        values: tagsList.sort((a, b) => a.name.localeCompare(b.name)).map((t, i) => `${i + 1}. **${t.name}**`),
        valuesPerPage: 5,
      });
    }

    const tag = tags.find(findTag(tagName));

    if (MOD_OPTIONS.includes(command) || OPTIONS.includes(command)) {
      if (command === 'info') {
        if (!tag) return call.interaction.reply({ content: 'This is not an existing tag.', ephemeral: true });

        return call.interaction.reply(
          {
            embeds: [
              new MessageEmbed()
                .setColor(call.client.DEFAULT_EMBED_COLOR)
                .addField('Primary Name', `\`${tag.name}\``, true)
                .addField('Aliases', tag.aliases.length ? `\`${tag.aliases.join('`, `')}\`` : 'None', true)
                .setDescription('```' + safeBlock(tag.value) + '```', true)
                .setFooter({ text: `Requested by ${call.user.tag} (${call.user.id})`, iconURL: call.user.displayAvatarURL() })
            ],
            ephemeral: true
          }
        );
      } else if (command === 'view') {
        if (`${command}-${call.channel.id}` in onCooldown)
          return call.interaction.reply({ content: `This tag can only be used once every ${parseTime(COOLDOWN)} in this channel.`, ephemeral: true });
    
        if (!tag) {
          const search = tags.filter((t) => levenshtein(tagName, t.name) <= 2 || t.aliases.some((a) => levenshtein(tagName, a) <= 2)).slice(0, 5);
    
          return call.interaction.reply(
            {
              content: `No tag found for \`\`${safeBlock(tagName.toLowerCase().substring(0, 20))}\`\`.${search.length ? ' Perhaps you were looking for one of these?' : ''}`,
              embeds: search.length !== 0 ? [new MessageEmbed().setColor(call.client.DEFAULT_EMBED_COLOR).setDescription(search.map((s, i) => `${i + 1}. **${s.name}**`).join('\n'))] : null,
              ephemeral: true
            }
          );
        }

        call.interaction.reply({ content: userToMention?.toString(), embeds: [embedTag(call.user, tag)] });

        return cooldown(call.user, tagName, call.channel);
      }

      if (!tagMod)
        return call.interaction.reply({ content: `You do not have permission to manage${isDevTag ? ' development' : ''} tags.`, ephemeral: true });

      if (command === 'create') {
        if (tag)
          return call.interaction.reply({ content: 'This is already an existing tag or alias.', ephemeral: true });

        await call.interaction.reply('The prompt will continue in your direct messages.');

        const value = await call.dmPrompt(`Please provide the value for the \`${tagName}\`${isDevTag ? ' development' : ''} tag.`, { time: 600_000 });

        if (!value)
          return;

        let imageUrl = null;

        if (image) {
          await call.dmPrompt(`Please provide the image (link or attachment) for the \`${tagName}\`${isDevTag ? ' development' : ''} tag.`, {
            correct: (m) => m.correct,
            filter: (m) => {
              const img = m.content?.match(call.client.IMAGE_URL_REGEX)?.[0] ?? m.attachments.first()?.proxyURL;

              if (!img) { 
                m.correct = 'That is an invalid image URL. Please make sure the URL ends with a valid image extension.';

                return false;
              }

              imageUrl = img;

              return true;
            }
          });

          if (!imageUrl) return;
        }

        await getClient().query('INSERT INTO public.tags ("name", "value", "devtag", image_url) VALUES($1, $2, $3, $4)', [tagName, value, isDevTag, imageUrl]);

        return finishUpdate(call, `Successfully created the \`${tagName}\`${isDevTag ? ' development' : ''} tag.`, true);
      } else if (command === 'delete') {
        if (!tag) return call.interaction.reply({ content: 'This is not an existing tag.', ephemeral: true });

        await getClient().query('DELETE FROM public.tags WHERE "name" = $1', [tagName]);

        return finishUpdate(call, `Successfully deleted the \`${tagName}\`${tag.devtag ? ' development' : ''} tag.`);
      } else if (command === 'edit') {
        if (!tag) return call.interaction.reply({ content: 'This is not an existing tag.', ephemeral: true });

        call.interaction.reply('The prompt will continue in your direct messages.');

        const value = await call.dmPrompt(`Please provide a value to replace the current value of the \`${tagName}\`${tag.devtag ? ' development' : ''} tag.`, { time: 600_000 });

        if (!value) return;

        await getClient().query('UPDATE public.tags SET "value" = $2 WHERE "name" = $1', [tag.name, value]);

        return finishUpdate(call, `Successfully edited the value of the \`${tagName}\`${tag.devtag ? ' development' : ''} tag.`, true);
      } else if (command === 'rename') {
        if (!tag) return call.interaction.reply({ content: 'This is not an existing tag. Try creating it with `/tag create`.', ephemeral: true });

        const newName = newValue?.toLowerCase().replace(INVALID_NAME_CHARS, ''),
          dupeTag = tags.find(findTag(newName));

        if (dupeTag)
          return call.interaction.reply({ content: `The \`${dupeTag.name}\` tag is either named or aliased \`${newName}\`. Please rename the tag or remove such alias from it before renaming this tag.`, ephemeral: true });

        await getClient().query('UPDATE public.tags SET "name" = $2 WHERE "name" = $1', [tag.name, newName]);

        return finishUpdate(call, `Successfully renamed the \`${tagName}\` tag to \`${newName}\`.`);
      } else if (command === 'alias') {
        if (!tag) return call.interaction.reply({ content: 'This is not an existing tag. Try creating it with `/tag create`.', ephemeral: true });

        const alias = newValue?.toLowerCase().replace(INVALID_NAME_CHARS, ''),
          dupeTag = tags.find(findTag(alias));

        if (dupeTag)
          return call.interaction.reply({
            content: `The \`${dupeTag.name}\` tag is either named or aliased \`${alias}\`. Please rename the tag or remove such alias from it before adding that alias to this tag.`,
            ephemeral: true
          });

        await getClient().query('UPDATE public.tags SET "aliases" = array_append("aliases", $2) WHERE "name" = $1', [tag.name, alias]);

        return finishUpdate(call, `Successfully aliased \`${alias}\` to \`${tagName}\`. Note that if another tag has this alias it will only display the tag created prior to this one.`);
      } else if (command === 'remove_alias') {
        if (!tag) return call.interaction.reply({ content: 'This is not an existing alias.', ephemeral: true });

        const alias = newValue?.toLowerCase().replace(INVALID_NAME_CHARS, '');

        await getClient().query('UPDATE public.tags SET "aliases" = array_remove("aliases", $2) WHERE "name" = $1', [tag.name, alias]);

        return finishUpdate(call, `Successfully de-aliased \`${alias}\` from \`${tagName}\`.`);
      } else if (command === 'image') {
        if (!tag) return call.interaction.reply({ content: 'This is not an existing tag. Try creating it with `/tag create`.', ephemeral: true });
        
        call.interaction.reply('The prompt will continue in your direct messages.');

        let imageUrl = null;

        await call.dmPrompt(`Please provide the image (link or attachment) for the \`${tagName}\`${tag.devtag ? ' development' : ''} tag.\nTo remove the image from the tag, response with \`remove\`.`, {
          correct: (m) => m.correct,
          filter: (m) => {
            if (['remove', 'delete'].includes(m.content?.toLowerCase())) return true;

            const img = m.content?.match(call.client.IMAGE_URL_REGEX)?.[0] ?? m.attachments.first()?.proxyURL;

            if (!img) { 
              m.correct = 'That is an invalid image URL. Please make sure the URL ends with a valid image extension.';

              return false;
            }

            imageUrl = img;

            return true;
          }
        }, false, false);

        await getClient().query('UPDATE public.tags SET image_url = $2 WHERE name = $1', [tag.name, imageUrl]);
          
        return finishUpdate(call, `Successfully ${imageUrl ? 'added' : 'removed'} the image ${imageUrl ? 'to' : 'from'} \`${tagName}\`.`, true); 
      }
    }
  },
};
