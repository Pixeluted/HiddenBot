'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders'),
  { MessageEmbed } = require('discord.js'),
  { parseTime, validTimezone, flatten } = require('../../util/common'),
  dayjs = require('dayjs'),
  customParseFormat = require('dayjs/plugin/customParseFormat'),
  advancedFormat = require('dayjs/plugin/advancedFormat'),
  timezonePlugin = require('dayjs/plugin/timezone'),
  utcPlugin = require('dayjs/plugin/utc'),
  fetch = require('node-fetch'),

  defaultType = 'R',
  types = [
    { name: 'Short Time', value: 't' },
    { name: 'Long Time', value: 'T' },
    { name: 'Short Date', value: 'd' },
    { name: 'Long Date', value: 'D' },
    { name: 'Short Date/Time', value: 'f' },
    { name: 'Long Date/Time', value: 'F' },
    { name: 'Relative Time (Default)', value: 'R' },
  ];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unix')
    .setDescription('Converts a date and time into a Unix timestamp. If timezone is provided, response will be ephemeral.')
    .addStringOption((option) => 
      option
        .setName('type')
        .setDescription('The type of timestamp that will be returned.')
        .setRequired(false)
        .addChoices(...types.map((type) => ({ name: type.name, value: type.value })))
    )
    .addStringOption((option) =>
      option
        .setName('date')
        .setDescription('The date of the timestamp that will be returned. Format: YYYY/MM/DD Example: 2022/01/26')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('time')
        .setDescription('The time of the timestamp that will be returned. Format: HH:mm Example: 16:30')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('initial_timezone')
        .setDescription('The timezone that you are in. Only you will be able to see this. Format: Location/City')
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addStringOption((option) =>
      option
        .setName('converting_timezone')
        .setDescription('The timezone that will be converted to. Format: Location/City Example: America/Los_Angeles')
        .setRequired(false)
        .setAutocomplete(true)
    ),
  exec: async (call) => {    
    const type = call.interaction.options.getString('type') ?? defaultType,
      date = call.interaction.options.getString('date')?.replace(/[/\\-]/g, ' ') ?? new Date(),
      time =  call.interaction.options.getString('time') ?? '00:00',
      initial_timezone = call.interaction.options.getString('initial_timezone') ?? 'GMT',
      converting_timezone = call.interaction.options.getString('converting_timezone') ?? 'GMT';
    
    dayjs.extend(customParseFormat);
    dayjs.extend(advancedFormat);
    dayjs.extend(timezonePlugin);
    dayjs.extend(utcPlugin);

    if (!validTimezone(initial_timezone) || !validTimezone(converting_timezone))
      return call.interaction.reply({ content: 'Invalid timezone provided.', ephemeral: true });

    const _date = (
        typeof date === 'object' 
          ? dayjs.tz(date, initial_timezone)
          : dayjs.tz(`${date} ${time}`, 'YYYY MM DD HH:mm', initial_timezone)
      ).tz(converting_timezone),
      invalid = _date.toString() === 'Invalid Date';

    let unix = invalid ? parseTime(date) : _date.format('X');

    if (!unix) return call.interaction.reply({ content: 'Invalid date provided.', ephemeral: true });

    if (invalid) unix = Math.floor((unix + Date.now()) / 1000);

    const embed = new MessageEmbed()
      .setTitle('Unix Timestamp')
      .setDescription(`\`\`\`\n<t:${unix}:${type}>\n\`\`\``)
      .addField('What you provided', `\`\`\`\n${_date.format('YYYY/MM/DD HH:mm')}\n\`\`\``)
      .addField('View it in the embed', `<t:${unix}:${type}>`)
      .setFooter({ text: `Requested by ${call.user.tag}`, iconURL: call.user.displayAvatarURL({ dynamic: true }) })
      .setColor(call.client.DEFAULT_EMBED_COLOR);

    call.interaction.reply({ embeds: [embed], ephemeral: !!call.interaction.options.getString('initial_timezone') });
  },
  autocomplete: async (interaction) => {
    const timezones = await fetch('https://raw.githubusercontent.com/dmfilipenko/timezones.json/master/timezones.json')
        .then((res) => res.json().then((data) => ([...new Set(flatten(data.map((t) => t.utc)))].sort()))),
      value = interaction.options.getFocused();


    interaction.respond(
      timezones
        .filter((t) => t.toLowerCase().startsWith(value.toLowerCase()))
        .slice(0, 25)
        .map((t) => ({ name: t, value: t }))
    );
  
  }
};