'use strict';

const { getClient } = require('../../load/database.js');

module.exports = {
  id: 'review',
  desc: 'Allows a user to review another user. You can review a user when both parties have agreed to the commission using the 🔍 emoji on marketplace posts.',
  exec: async (call) => {
    const user = await call.fetchUser(0);

    if (!user)
      return call.message.channel.send('Please rerun the command and specify a valid user to review.');

    let reviews = await getClient().query('SELECT reviews FROM public.reviews WHERE "user" = $1', [user.id]).then(((res) => res.rows[0]?.reviews));

    if (!reviews || reviews[call.user.id] !== 1)
      return call.message.channel.send('You cannot review this user.');

    await call.user.createDM();

    if (call.interaction.channel.type === 'GUILD_TEXT')
      await call.message.channel.send('The prompt will continue in your direct messages.');

    const stars = await call.dmPrompt('How many stars (out of 5) would you like to give this user?', { filter: /^[1-5]$/, correct: 'Input must be a single digit no greater than 5 and no less than 1.' }),
      reason = await call.dmPrompt('Please provide an explanation for the review you gave. If an invalid explanation is provided, the review will likely be removed.',
        { filter: (m) => m.content.length <= 400, correct: 'Input must be less than or equal to 400 characters. Please keep reviews concise.' });

    // In case other reviews were submitted for the same user during the same time.
    reviews = await getClient().query('SELECT reviews FROM public.reviews WHERE "user" = $1', [user.id]).then(((res) => res.rows[0].reviews));
    reviews[call.user.id] = { stars: parseInt(stars), reason: reason };

    await getClient().query('UPDATE public.reviews SET reviews = $2 WHERE "user" = $1', [user.id, reviews]);

    call.user.send('Successfully left this review.');
  }
};