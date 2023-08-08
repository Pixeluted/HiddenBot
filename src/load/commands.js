const { REST } = require('@discordjs/rest'),
  { Routes } = require('discord-api-types/v9'),
  Call = require('../handler/Call.js'),
  { fetchRoblox } = require('./webVerification'),
  fs = require('fs'),
  Infractions = require('../util/infractions.js');

const GUILDS = [
    '211228845771063296', // HiddenDevs
    '652673441761067028', // HiddenDevs Testing
    '488120689564450827', // Hidden Staff
  ],
  rolesBypass = [
    '443556382286020612', // Trial Staff
    '211229509150572544', // Staff
    '514932671034556418', // HD Bot Developer
  ],
  bypassChannels = [
    '535514713870565376', // cmds
    '534515683418177557', // bot-stuff
    '741271244024053901', // staff-cmds
    '652673441761067029', // Test Channels (category in testing server)
    '799352608682278983', // bot-cmds (channel in staff server)
  ];

module.exports = {
  id: 'commands',
  exec: async (client) => {
    Call.commands = fs
      .readdirSync('./src/commands')
      .reduce((commands, category) => {
        return commands.concat(
          fs
            .readdirSync(`./src/commands/${category}`)
            .map((c) => {
              try {
                if (!fs.statSync(`./src/commands/${category}/${c}`).isDirectory()) {
                  const module = require(`../commands/${category}/${c}`);

                  if (module.data) {
                    if (Array.isArray(module.data))
                      for (const d of module.data)
                        d.category = d.category ?? category;
                    else
                      module.data.category = module.data.category ?? category;

                    return module;
                  }
                }
              } catch (err) {
                console.warn(`Failed to load ${c} command`, err.stack);
              }
            })
            .filter((c) => c !== undefined)
        );
      }, []);

    const rest = new REST({ version: '9' }).setToken(process.env.BOT_TOKEN);

    if (process.env.NODE_ENV !== 'production') {
      for (const guildId of GUILDS) {
        if (!client.guilds.cache.has(guildId))
          continue;

        await rest.put(
          Routes.applicationGuildCommands(client.user.id, guildId),
          { body: Call.commands.filter((c) => c.data).map((c) => c.data).flat().map((d) => d.toJSON()) }
        );
      }
    } else {
      await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: Call.commands.filter((c) => c.data).map((c) => c.data).flat().map((d) => d.toJSON()) }
      );
    }

    client.on('interactionCreate', async (interaction) => {
      const { commandName } = interaction;

      // Autocomplete command options
      if (interaction.isAutocomplete()) {
        const command = Call.commands.find((c) => c.data.name === interaction.commandName);

        if (!command)
          return;

        command.autocomplete?.(interaction);
      // Command execution
      } else if (interaction.isCommand() || interaction.isApplicationCommand()) {
        let failed = false;

        if (!interaction.user.robloxId)
          interaction.user.robloxId = await fetchRoblox(interaction.user.id).catch(() => failed = true);

        const command = Call.commands.find((c) => c.data?.name === commandName || c.data?.some?.((d) => d.name === commandName));

        if (!failed && !interaction.user.robloxId && command.data.name !== 'ticket')
          return interaction.reply({ content: 'You must verify before using HiddenBot. Please check out <#678252217681051669> to learn how to verify.', ephemeral: true });

        if (commandName !== 'tag'
          && commandName !== 'myinfractions'
          && interaction.channel.type !== 'DM'
          && !interaction.channel.isThread()
          && !command.useAnywhere
          && !bypassChannels.includes(interaction.channelId)
          && !bypassChannels.includes(interaction.channel.parentId)
          && !command.bypassChannels?.includes(interaction.channelId)
          && !command.bypassChannels?.includes(interaction.channel.parentId)
          && interaction.member?.roles.cache.every((r) => !rolesBypass.includes(r.id)))
          return interaction.reply({ content: 'This command cannot be used here.', ephemeral: true });

        try {
          if (command.canUse &&
            !command.canUse.users?.includes(interaction.user.id) &&
            !interaction.member?.roles.cache.some((r) => command.canUse?.roles?.includes(r.id)))
            return interaction.reply({ content: 'You do not have permission to run this command.', ephemeral: true });

          // Load infractions in the current guild if they have not been loaded yet.
          if (process.env.NODE_ENV === 'production' && interaction.inGuild() && !Infractions.ids[interaction.guildId])
            await Infractions.lastId(interaction.guildId);

          const call = new Call(
            interaction,
            command,
            Call.commands
          );

          client.emit('commandUsed', call, command?.exec(call));
        } catch (err) {
          if (interaction.replied)
            interaction.user.send(`An error occurred running the \`${command.data.name}\` command. Please report this issue in the <#669267304101707777> channel.`);
          else
            interaction.reply({ content: `An error occurred running the \`${command.data.name}\` command. Please report this issue in the <#669267304101707777> channel.`, ephemeral: true });

          process.emit('logBotError', err);
        }
      }
    });
  }
};
