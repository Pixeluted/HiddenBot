'use strict';

const fetch = require('node-fetch'),
  { sentenceCase } = require('./common'),
  { fileNames } = require('./compilationDetails');

const aliases = {
  assembly: ['asm'],
  clojure: ['clj'],
  coffeescript: ['cs', 'coffee'],
  crystal: ['cry'],
  csharp: ['c#'],
  elixir: ['elx'],
  erlang: ['erl'],
  fsharp: ['f#'],
  groovy: ['grv'],
  haskell: ['hs'],
  javascript: ['js'],
  kotlin: ['kt'],
  python: ['py'],
  ruby: ['rb'],
  rust: ['rs'],
  swift: ['sw'],
  typescript: ['ts'],
};

let languageCache = [];
/**
 * @returns {Promise<String[]>} All languages
 */

async function getLanguages() {
  if (languageCache.length)
    return languageCache;
  else 
    return languageCache = await fetch('https://glot.io/api/run')
      .then((res) => res.json())
      .then((res) => res.map((lang) => lang.name));
}

/**
 * 
 * @param {String} _lang The language to get the version of 
 * @returns {Promise<String[]>} An array of versions that the language supports
 */
function findVersions(lang) {
  return fetch(`https://glot.io/api/run/${lang}`)
    .then((res) => res.json())
    .then((res) => Array.isArray(res) ? res.map((l) => l.version) : res.version);
}

/**
 * @typedef {object} CompilerLoad
 * @property {string} language The language that the expression will be compiled in.
 * @property {string} version The version of the language that the expression will be compiled in.
 * @property {string} code The code that will be compiled.
 */

/**
 * 
 * @param {CompilerLoad} load An object containing various values 
 * @returns {Promise<Object>} { overLimit: boolean, body: Object }
 */
async function compileCode(load) {
  const headers = new fetch.Headers();

  headers.set('Content-Type', 'application/json');
  headers.set('Authorization', `Token ${process.env.GLOT_TOKEN}`);

  const res = await fetch(`https://glot.io/api/run/${load.language}/${load.version || 'latest'}`, {
    headers,
    method: 'POST',
    body: JSON.stringify({
      files: [
        { 
          name: fileNames[load.language],
          content: load.code,
        }
      ],
    }).replace(/\\/g, '\\')
  }).then((r) => r.json());

  let overLimit, errMessage;

  if (typeof res.stderr === 'string' && typeof res.stdout === 'string') {
    if (res.stderr.length > 4000 || res.stdout.length > 4000) {
      overLimit = true;
      errMessage = 'The compiled result was over 4000 characters.';
    } else if (res.stderr.match(/\n/g)?.length > 100 || res.stdout.match(/\n/g)?.length > 100) {
      overLimit = true;
      errMessage = 'The compiled result was over 100 lines.';
    }
  }



  return { overLimit, errMessage, body: res };
}

/**
 * 
 * @param {CompilerLoad} load Object containing various values.
 * @returns {promise<string>} 
 */
async function createSnippet(load) {
  const headers = new fetch.Headers();

  headers.set('Content-Type', 'application/json');

  const res = await fetch('https://glot.io/api/snippets', {
    headers,
    method: 'POST',
    body: JSON.stringify({
      language: load.language,
      title: `${sentenceCase(load.language)} Snippet`,
      public: true,
      files: [
        { 
          name: fileNames[load.language],
          content: load.body,
        }
      ],
    })
  }).then((r) => r.json());

  return `https://glot.io/snippets/${res.id}`;
}

module.exports = {
  aliases,
  compileCode,
  createSnippet,
  findVersions,
  getLanguages,
};