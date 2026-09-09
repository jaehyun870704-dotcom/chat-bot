const { TransformersEmbeddings } = require('vectra');
const { createChunker } = require('./chunker');

const MODEL = 'Xenova/multilingual-e5-small';

let basePromise = null;

function getBase() {
  if (!basePromise) {
    basePromise = TransformersEmbeddings.create({
      model: MODEL,
      dtype: 'q8',
      device: 'cpu',
      progressCallback: (p) => {
        if (p.status === 'progress' && p.file && Math.round(p.progress || 0) % 25 === 0) {
          console.log(`[model] ${p.file} ${Math.round(p.progress)}%`);
        }
      },
    });
  }
  return basePromise;
}

async function embedPassages(texts) {
  const base = await getBase();
  const prefixed = texts.map((t) => 'passage: ' + t);
  const res = await base.createEmbeddings(prefixed);
  if (res.status !== 'success') throw new Error('embedding failed: ' + res.message);
  return res.output;
}

async function embedQuery(text) {
  const base = await getBase();
  const res = await base.createEmbeddings(['query: ' + text]);
  if (res.status !== 'success') throw new Error('embedding failed: ' + res.message);
  return res.output[0];
}

async function getSplitter(targetChars = 1000, overlapChars = 100) {
  const base = await getBase();
  return createChunker({
    tokenizer: base.getTokenizer(),
    targetChars,
    overlapChars,
    maxTokens: 480,
  });
}

module.exports = { MODEL, getBase, embedPassages, embedQuery, getSplitter };
