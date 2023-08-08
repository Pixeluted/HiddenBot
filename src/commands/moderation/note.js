'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders'),
  { Modal, MessageActionRow, TextInputComponent } = require('discord.js'),
  { getClient } = require('../../load/database.js'),
  ROLES = require('../../util/roles.json'),
  { safeBlock } = require('../../util/common.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('note')
    .setDescription('Puts a note on the provided user\'s infraction page.')
    .setDMPermission(false)
    .addUserOption((option) => 
      option.setName('target')
        .setDescription('The user to assign the note.')
        .setRequired(true))
    .addBooleanOption((option) =>
      option.setName('delete_note')
        .setDescription('Whether or not to delete this user\'s note. False by default.')
        .setRequired(false)),
  canUse: {
    users: ['118496586299998209'],
    roles: [ROLES.MOD, ROLES.SENIOR_MOD, ROLES.SCAM_INVESTIGATOR, ROLES.ADMINISTRATOR, ROLES.REPRESENTATIVE],
    cant: 'You do not have permission to run this command.',
  },
  exec: async (call) => {
    const user = call.interaction.options.getUser('target');

    if (!user) return call.interaction.reply({ content: 'Please rerun the command and specify a valid `target` to set a note for', ephemeral: true });

    if (user.id === call.user.id) return call.interaction.reply({ content: 'You cannot set a note for yourself.', ephemeral: true });

    if (user.id === call.client.user.id) return call.interaction.reply({ content: 'You cannot set a note for me.', ephemeral: true });

    const member = await call.interaction.guild.members.fetch(user.id).catch(() => null);

    if (member && (call.member.roles.highest.position <= member.roles.highest.position || call.interaction.guild.ownerId === member.id))
      return call.interaction.reply({ content: 'You are not high enough in role hierarchy to set a note for this user.', ephemeral: true });

    const deleteNote = call.interaction.options.getBoolean('delete_note');
    
    if (deleteNote) {
      await getClient().query('DELETE FROM public.notes WHERE user_id = $1', [user.id]);

      return call.interaction.reply({ content: 'Successfully deleted this user\'s note.', ephemeral: true });
    }

    const noteInteraction = await call.modalPrompt(
        new Modal()
          .setCustomId('note')
          .setTitle('Note Prompt')
          .addComponents(
            new MessageActionRow().addComponents(
              new TextInputComponent()
                .setCustomId('note')
                .setLabel('Note')
                .setStyle('PARAGRAPH')))),
      note = safeBlock(noteInteraction.fields.getTextInputValue('note') ?? '');

    if (!note)
      return call.interaction.followUp({ content: 'A note must be provided.', ephemeral: true });

    try {
      // Insert if not exists
      if (await getClient().query('SELECT note FROM public.notes WHERE user_id = $1', [user.id]).then((result) => result.rows[0]))
        await getClient().query('UPDATE public.notes SET note = $2 WHERE user_id = $1', [user.id, note]);
      else
        await getClient().query('INSERT INTO public.notes (user_id, note) VALUES ($1, $2)', [user.id, note]);

      noteInteraction.reply({ content: 'Successfully changed the note of this user.', ephemeral: true });
    } catch (err) {
      noteInteraction.reply({ content: 'Failed to change the note of this user, please try again.', ephemeral: true });
    }
  },
};
