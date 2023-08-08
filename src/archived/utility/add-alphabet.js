// Loader file
// Used only to add a new unicode font to the letters bypasses.

const fs = require('fs'),

  json = JSON.parse(fs.readFileSync('./util/letters.json'));

/**
 * @example
 * add('𝐚 𝐛 𝐜 𝐝 𝐞 𝐟 𝐠 𝐡 𝐢 𝐣 𝐤 𝐥 𝐦 𝐧 𝐨 𝐩 𝐪 𝐫 𝐬 𝐭 𝐮 𝐯 𝐰 𝐱 𝐲 𝐳');
 */
// eslint-disable-next-line no-unused-vars
function add(alphabet) {
  alphabet.split(' ').forEach((char, i) => {
    if (!json[Object.keys(json)[i]].includes(char) && !/[a-zA-Z]/.test(char))
      json[Object.keys(json)[i]] = `${char} ${json[Object.keys(json)[i]]}`;
  });
}

fs.writeFileSync('./util/letters.json', JSON.stringify(json, null, '\t'));