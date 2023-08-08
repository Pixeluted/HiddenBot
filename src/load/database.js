'use strict';

const { Client } = require('pg');

'use strict';

// const mysql = require('mysql2'),
//   config = {
//     host: '162.248.246.10',
//     port: 3306,
//     user: 'hiddenbot',
//     password: process.env.WEBSITE_DATABASE_PASSWORD,
//     database: 'hiddendevs',
//   },
//   webClient = mysql.createPool(config);

function createClient() {
  return new Client({
    connectionString: process.env.DATABASE_URL ?? process.env.HiddenDB,
    ssl: { rejectUnauthorized: false },
  });
}

let client = createClient();

client.on('error', (err) => {
  console.warn(err.stack);

  if (err.message === 'Client has encountered a connection error and is not queryable')
    client = createClient();

  process.emit('logBotError', err);
});

module.exports = {
  id: 'database',
  getClient: function() {
    return client;
  },
  // Webclient function incase we ever need to recreate webclient after disconnects
  // getWebClient: function() {
  //   return webClient;
  // },
  exec: async function() {
    try {
      await this.getClient().connect();

      console.log('Connected database client.');

      require('./filter.js').loadWords();
    } catch (err) {
      process.emit('logBotError', err);
      console.log('Database failed to connect.');

      await new Promise((resolve) => setTimeout(resolve, 3000));

      require('./filter.js').loadWords();
    }
  },
};
