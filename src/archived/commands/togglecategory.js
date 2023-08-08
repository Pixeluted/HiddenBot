module.exports = {
  id: 'togglecategory',
  desc: 'Toggles a category for viewing.',
  exec: (call) => {
    if (!call.client.isTicketAdmin(call.user.id)) return;

    const voiceChannels = call.client.channels.get('403886627614883850'),
      businessChannels = call.client.channels.get('360585125970444288'),
      tradeChannels = call.client.channels.get('534708230459359242'),
      devChannels = call.client.channels.get('438636664261181440');

    let failed = false;

    if (!call.args[0]) return call.message.channel.send('You must provide an option.\nOptions: `voice`, `business`, `trade`, `dev`');

    try {
      call.args[0].toLowerCase() === 'voice' ? voiceChannels.overwritePermissions(call.user.id,
        { 'VIEW_CHANNEL': !voiceChannels.memberPermissions(call.user).has('VIEW_CHANNEL') }) :

        call.args[0].toLowerCase() === 'business' ? businessChannels.overwritePermissions(call.user.id,
          { 'VIEW_CHANNEL': !businessChannels.memberPermissions(call.user).has('VIEW_CHANNEL') }) :

        call.args[0].toLowerCase() === 'trade' ? tradeChannels.overwritePermissions(call.user.id,
          { 'VIEW_CHANNEL': !tradeChannels.memberPermissions(call.user).has('VIEW_CHANNEL') }) :

        call.args[0].toLowerCase() === 'dev' ? devChannels.overwritePermissions(call.user.id,
          { 'VIEW_CHANNEL': !devChannels.memberPermissions(call.user).has('VIEW_CHANNEL') }) :

        failed = true;

      call.message.channel.send(failed ? 'Invalid option.\nOptions: `voice`, `business`, `trade`, `dev`' : 'Successfully updated your permissions.');
    } catch (e) {
      call.message.channel.send('Something went wrong when updating your permissions, please try again.');
    }
  }
};