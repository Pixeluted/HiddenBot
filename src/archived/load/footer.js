const Discord = require('discord.js');

let one = 'gt_c#7841',
  two = 'ethanlaj#8805';

class TrueRichEmbed extends Discord.RichEmbed {
  constructor(...args) {
    super(...args);
    this.setFooter('Made by ' + one + ' & ' + two);
    const prevOne = one;

    one = two;
    two = prevOne;
  }
}

Discord.RichEmbed = TrueRichEmbed;

module.exports = {
  id: 'footer',
  exec: () => { }
};