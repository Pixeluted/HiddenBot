const { client: clientPG } = require('./database');

async function getManyMessages(channel, limit = 500) {
  const total = [];

  let lastID;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const messages = await channel.fetchMessages({ limit: 100, before: lastID });

    total.push(...messages.array());
    lastID = messages.last().id;

    if (messages.size != 100 || total.length >= limit)
      break;

    await new Promise((resolve) => setTimeout(resolve, 10000));

    console.log(total.length, limit);
  }

  return total;
}

module.exports = {
  id: 'temp-creationsFetch',
  exec: async (client) => {
    const creations = client.channels.get('271790587974385675');

    if (!creations)
      return;

    const messages = await getManyMessages(creations, 16400),
      query = {};

    for (const message of messages) {
      if (!message.reactions.has('🌟'))
        continue;

      if (!query[message.author.id])
        query[message.author.id] = { stars: 0, posts: 0 };

      const data = query[message.author.id];

      data.posts++;

      data.stars += (message.reactions.get('🌟').count - 1);
    }

    clientPG.query(`INSERT INTO public.users ("user", "creation_posts", "creation_stars")
                VALUES ${Object.entries(query).map(([a, q]) => `(${a}, ${q.posts}, ${q.stars})`).join(',\n')}`).then(() => console.log('success'));
  }
};