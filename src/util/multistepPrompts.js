'use strict';

const { fetchRoblox } = require('../load/webVerification.js'),
  { getRobloxAge } = require('./common.js');

// Limit number to 10,000,000.
function formatNumber(num) {
  if (num > 10000000) return '10,000,000';

  num = Math.ceil(num).toLocaleString();

  return num;
}

//const CURRENCY_REGEXP = /^(R?\$|£|¥|%)? *\d+(-\d+)? *(K|THOUSAND|GRAND|MIL(LION)?)? *(|ROBUX|USD|EUR|JPY|GBP|CAD|CHF|R?\$|£|¥|%)?$/i;
const FLOOR_PRICES = {
  animator: { 'real money': 1.75, robux: 500 },
  builder: { 'real money': 3.5, robux: 1000 },
  clothing: { 'real money': 1.75, robux: 500 },
  graphics: { 'real money': 1.75, robux: 500 },
  modeler: { 'real money': 1.75, robux: 500 },
  other: { 'real money': 1.75, robux: 500 },
  programmer: { 'real money': 5.0 },
  scripter: { 'real money': 3.5, robux: 1000 },
  sound: { 'real money': 1.75, robux: 500 },
  tutor: { 'real money': 1.75, robux: 500 },
  ui: { 'real money': 1.75, robux: 500 },
  video_editor: { 'real money': 5, robux: 1500 },
  vfx: { 'real money': 5, robux: 1500 }
};

const { DEVEX_CONVERSION_RATE } = require('./constants.js');

function promptAmount(call, payment, hiring = true, minimum = true, category) {
  const f = hiring ? 'you are offering' : 'you would like',
    g = hiring ? 'task' : 'product',
    floorValue = FLOOR_PRICES[category][payment];

  return call
    .dmPrompt(
      payment === 'robux'
        ? `Please specify how much robux ${f} for this ${g}.${hiring ? `\nYou must enter at least \`${floorValue}R$\` for the \`${category}\` category.` : ''}`
        : payment === 'real money'
          ? `Please specify the amount of money ${f} for this ${g}, in USD.${hiring ? `\nYou must enter at least \`${floorValue} USD\` for the \`${category}\` category.\n\nPlease note that if your amount exceeds 100 USD, your post will be subject to inspection by our staff members to prove you have the funds. Please be prepared to provide video or to screenshare the evidence. Screenshots as evidence are not allowed.` : ''}`
          : 'Please specify how much game percentage you are offering for this task. Sole percentage payments are only allowed for games already making profit.',
      {
        filter: (msg) => {
          if (!minimum) return true;

          if (!msg.content || !/^(\d+)?(\.\d{1,2})?$/.test(msg.content)) {
            msg.correct = 'Input must be a valid number. e.g. `1000`';

            return false;
          }

          // Hireable posts do not have price minimums
          if (!hiring) return true;

          // Percentage payments
          if (!floorValue && parseFloat(msg.content) > 100) {
            msg.correct = 'Percentage payhments may not be more than 100%.';

            return false;
          }

          if (floorValue > parseFloat(msg.content)) {
            msg.correct = `Input must be at least ${payment === 'real money' ? `${floorValue} USD` : `${floorValue} R$`} for the "${category}" category`;

            return false;
          }

          return true;
        },
        correct: (msg) => msg.correct,
      }
    )
    .then((msg) => (minimum ? parseFloat(msg) : msg));
}

module.exports = {
  hirePayments: async function(call, category, hiring = true) {
    let paymentOptions = Object.keys(FLOOR_PRICES[category]),
      payments = '',
      ranOnce = false,
      amount;

    if (!hiring) paymentOptions = ['real money', 'robux'];

    if (paymentOptions.find((o) => o === 'robux') && hiring) paymentOptions.push('percentage');

    if (paymentOptions.length === 1) {
      amount = await promptAmount(call, paymentOptions[0], hiring, !!category, category);

      payments += `**${paymentOptions[0].replace(/(\b| )\w/g, (c) => (c !== 'o' ? c.toUpperCase() : c))}:** ${!category
        ? amount.content
        : `${formatNumber(amount)} ${paymentOptions[0] === 'real money' ? 'USD' : ''} ${paymentOptions[0] === 'robux' ? `*($${(amount * DEVEX_CONVERSION_RATE).toFixed(2)} USD)*` : ''}`
      }\n`;
    }

    while (paymentOptions.length > 1) {
      const payment = await call.dmPrompt(
        `Please specify ${ranOnce ? 'any other form of' : 'the'} payment for this task.\n> ${paymentOptions.map((m) => `\`${m}\``).join(', ')}`,
        {
          filter: paymentOptions,
        },
        true
      );

      if (!ranOnce) paymentOptions.push('done');

      ranOnce = true;

      if (payment === 'done') break;

      paymentOptions.splice(paymentOptions.indexOf(payment), 1);
      amount = await promptAmount(call, payment, hiring, !!category, category);

      payments += `**${payment.replace(/(\b| )\w/g, (c) => (c !== 'o' ? c.toUpperCase() : c))}:** ${!category ? amount.content : `${formatNumber(amount)} ${payment === 'real money' ? 'USD' : ''} ${payment === 'robux' ? `*($${(amount * DEVEX_CONVERSION_RATE).toFixed(2)} USD)*` : ''}`
      }\n`;
    }

    return payments;
  },
  sellPayments: async function(call) {
    let paymentOptions = ['robux', 'real money'],
      payments = '',
      ranOnce = false,
      amount;

    while (paymentOptions.length > 1) {
      const payment = await call.dmPrompt(
        `Please specify ${ranOnce ? 'any other payment options are there (if any) ' : 'a payment option '}for what you are selling.\n> ${paymentOptions.map((m) => `\`${m}\``).join(', ')}`,
        {
          filter: paymentOptions,
        },
        true
      );

      if (!ranOnce) paymentOptions = ['robux', 'real money', 'done'];

      ranOnce = true;

      if (payment === 'done') break;

      paymentOptions.splice(paymentOptions.indexOf(payment), 1);
      amount = await promptAmount(call, payment, false, false);

      payments += `${payment.replace(/(\b| )\w/g, (c) => c.toUpperCase())}: ${formatNumber(amount)} ${payment === 'real money' ? 'USD' : ''}\n`;
    }

    return payments;
  },
  getPaymentType: async function(call, hiring = true) {
    const paymentTypes = ['per task', 'upon completion'],

      paymentType = await call.dmPrompt(
        `Please specify what type of payment you are ${hiring ? 'offering' : 'expecting'}. In simple terms, are ${hiring ? 'you paying' : 'expecting payment'} per task, or are ${hiring ? 'you paying' : 'expecting payment'
        } upon completion of the commission?\n> ${paymentTypes.map((t) => `\`${t}\``).join(', ')}`,
        {
          filter: paymentTypes,
        },
        true
      );

    return paymentType;
  },
  getContacts: async function(call) {
    const contactOptions = ['discord', 'twitter', 'email', 'link'];

    let contacts = '',
      ranOnce = false;

    while (contactOptions.length > 1) {
      const contact = await call.dmPrompt(
        `Please specify where ${ranOnce ? 'else ' : ''}you can be contacted from.` + `\n> ${contactOptions.map((m) => `\`${m}\``).join(', ')}`,
        {
          filter: contactOptions,
        },
        true
      );

      if (contact === 'done') break;

      let detail;

      if (!ranOnce) contactOptions.push('done');

      ranOnce = true;

      if (contact === 'discord') detail = call.user;

      contactOptions.splice(contactOptions.indexOf(contact), 1);

      if (!detail) {
        detail = await call.dmPrompt(
          contact === 'twitter' ? 'Please specify your Twitter username.' : contact === 'email' ? 'Please specify your email address.' : 'Please specify the link you would like to attach.',
          {
            filter: contact === 'twitter' ? /^@?(\w){1,15}$/ : contact === 'email' ? /^([a-zA-Z0-9_\-.]+)@([a-zA-Z0-9_\-.]+)\.([a-zA-Z]{2,5})$/ : /(https?:\/\/[^ ]*)/,
          },
          true
        );
      }

      contacts += contact === 'discord' ? `<:Discord:555869594581991428> Discord: ${call.user}\n`
        : contact === 'roblox' ? `<:roblox:693218877500293131> Roblox: [${detail.RobloxUsername}](https://www.roblox.com/users/${detail.RobloxId}/profile)\n`
        : contact === 'twitter' ? `<:Twitter:230378391172284416> Twitter: [${detail}](https://twitter.com/${detail.match(/^@?(\w){1,15}$/)[0]})\n`
        : contact === 'email' ? `:incoming_envelope: Email: ${detail}\n`
        : `:link: Attachment: [Link](${detail})\n`;
    }

    if (contacts) {
      const info = await fetchRoblox(call.user.id).catch(() => null);

      if (info)
        contacts +=
					`<:roblox:693218877500293131> Roblox: [${await call.client.getRobloxNameFromId(info)}](https://www.roblox.com/users/${info}/profile)` + ` (${await getRobloxAge(info)} days old)\n`;
    }

    return contacts ? contacts : 'skip';
  },
};
