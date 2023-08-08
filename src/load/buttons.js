'use strict';

const events = require('events');

const buttonPrompts = [];

class ButtonPrompt extends events.EventEmitter {
  constructor(message) {
    super();

    this.message = message;
    this.deleted = false;
  }

  next(options) {
    options = options || {};
    options.timeout = options.timeout ?? 120000;
    options.filter = options.filter ?? (() => true);
    options.correct = options.correct ?? (() => { });

    return new Promise((resolve, reject) => {
      const inputCheck = (input) => {
        if (options.filter(input)) {
          // Garbage collection
          this.removeListener('click', inputCheck);
          resolve(input);
        } else {
          options.correct(input);
        }
      };

      this.once('click', inputCheck);

      setTimeout(() => {
        // Garbage collection
        this.removeListener('click', inputCheck);
        reject(new Error('Prompt ended: time'));
      }, options.timeout);
    });
  }

  nextMultiple(options) {
    options = options || {};
    options.timeout = options.timeout ?? 120000;
    options.amount = options.amount ?? options.amount;
    options.filter = options.filter ?? (() => true);
    options.until = options.until ?? (() => false);
    options.correct = options.correct ?? (() => { });
    options.addLast = options.pushLast ?? false;

    return new Promise((resolve) => {
      const results = [],

        inputCheck = (input) => {
          if (options.filter(input)) {
            if (options.until(input)) {
              if (options.pushLast) results.push(input);

              // Garbage collection
              this.removeListener('click', inputCheck);

              return resolve(results);
            } else {
              results.push(input);
            }

            if (results.length === options.amount) resolve(results);
          } else {
            options.correct(input);
          }
        };

      this.on('click', inputCheck);

      setTimeout(() => {
        // Garbage collection
        this.removeListener('click', inputCheck);
        resolve(results);
      }, options.timeout);
    });
  }

  delete() {
    if (this.deleted) return;

    buttonPrompts.splice(buttonPrompts.indexOf(this), 1);

    this.removeAllListeners();
    this.deleted = true;
  }
}

module.exports = {
  id: 'buttons',
  buttonPrompts,
  exec: function(client) {
    client.on('interactionCreate', (interaction) => {
      if (!interaction.isButton() && !interaction.isSelectMenu()) return;

      const buttonPrompt = buttonPrompts.find((p) => (p.message.id || p.message) === interaction.message.id || interaction.customId.includes(p.message.id || p.message));

      if (buttonPrompt) buttonPrompt.emit('click', interaction);
    });
  },
  createButtonPrompt: function(message) {
    const prompt = new ButtonPrompt(message);

    this.buttonPrompts.push(prompt);

    return prompt;
  },
};
