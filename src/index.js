'use strict';

const { Client, Collection, DiscordAPIError, WebhookClient, Options } = require('discord.js'),
  fs = require('fs');

// MessageManager cache size can be infinity due to HiddenBot being hosted on Heroku, which restarts about daily.
const client = new Client({
    allowedMentions: { parse: ['users'], repliedUser: true },
    makeCache: Options.cacheWithLimits({
      MessageManager: process.env.NODE_ENV === 'production' ? Infinity : 200
    }),
    restTimeOffset: 1500,
    restRequestTimeout: 45000,
    intents: [
      'GUILDS',
      'GUILD_MEMBERS',
      'GUILD_PRESENCES',
      'GUILD_BANS',
      'GUILD_EMOJIS_AND_STICKERS',
      'GUILD_WEBHOOKS',
      'GUILD_VOICE_STATES',
      'GUILD_MESSAGES',
      'GUILD_MESSAGE_REACTIONS',
      'DIRECT_MESSAGES',
      'DIRECT_MESSAGE_REACTIONS'
    ],
    partials: ['CHANNEL']
  }),
  errorWebhook = new WebhookClient({
    id: '863346139963981834',
    token: 'VIU0w-RA0r9ZCGvMntw5d97BjdeRBSdJKc8sw7HSn49tfeX_6Nh3wgKFGqxmAFC6nY5q'
  }),
  loaders = new Collection(
    fs
      .readdirSync('./src/load')
      .map((n) => require(`./load/${n}`))
    // Remove loaders without ids.
      .filter((l) => l.id)
    // Put loaders with a prepend property at the start to be loaded first.
      .sort((a, b) => (b.prepend ?? 0) - (a.prepend ?? 0))
    // Map the loaders so that it will be correctly converted into a Collection.
      .map((l) => [l.id, l])
  );
  
function ignoreError(err) {
  return err.message.includes('Prompt ended:') || (process.env.NODE_ENV === 'production' && err instanceof DiscordAPIError);
}

client
  .once('ready', () => {
    console.log(client.user.username + ' has successfully launched');

    client.on('ready', () => console.log(client.user.username + ' has successfully launched'));

    for (const loader of loaders.values()) if (typeof loader.exec === 'function') loader.exec(client);

    setTimeout(() => console.log(`Bot launched using ${Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100}MB of memory.`), 20000);
  })
  .setMaxListeners(20);

process
  .on('unhandledRejection', (err) => {
    if (err.message === 'Client has encountered a connection error and is not queryable')
      return process.exit();

    process.emit('logBotError', err);
  })
  .on('logBotError', (err) => {
    console.warn(err.stack ?? err);

    if (process.env.NODE_ENV === 'production' && !ignoreError(err))
      errorWebhook.send({
        content: `\`\`\`${err.stack}\`\`\`\n\n**GitHub Links**\n${
          err.stack
            .match(/(?<!node_modules.+)(\/|\\)src(.+?):(\d+)/g)
            ?.map((t) => `https://github.com/SoloDeveloper/hiddenbot/blob/master${t.replace(/:/, '#L')}`)
            .join('\n\n') ?? 'none'}`
      });
  });

client.login(process.env.HIDDENBOT_TOKEN ?? process.env.BOT_TOKEN);

module.exports = client;
