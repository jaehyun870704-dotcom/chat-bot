const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');
const { LocalIndex } = require('vectra');

// A single vectra LocalIndex keeps the whole index in memory and rewrites it
// as one JSON string on every write. That hits V8's ~1GB max string length
// once the corpus grows past roughly 50-60k chunks (confirmed by an actual
// "RangeError: Invalid string length" crash during a real run). Sharding
// into capped-size indexes keeps each file well under that ceiling and
// keeps per-flush serialize/write cost bounded instead of growing with the
// whole corpus.
const INDEX_ROOT = path.join(__dirname, '..', 'data', 'vector-index');
const SHARD_MAX_ITEMS = 10000;

function shardPath(i) {
  return path.join(INDEX_ROOT, `shard-${i}`);
}

function listShardIndices() {
  if (!fs.existsSync(INDEX_ROOT)) return [];
  return fs
    .readdirSync(INDEX_ROOT)
    .filter((d) => /^shard-\d+$/.test(d))
    .map((d) => parseInt(d.split('-')[1], 10))
    .sort((a, b) => a - b);
}

// Stateful writer: tracks the current shard + its item count in memory so
// we don't need to reload index stats from disk on every batch.
async function openWriter() {
  const shardIdxs = listShardIndices();
  let currentShard = shardIdxs.length ? shardIdxs[shardIdxs.length - 1] : 0;
  let index = new LocalIndex(shardPath(currentShard));
  if (!(await index.isIndexCreated())) {
    await index.createIndex();
  }
  let stats = await index.getIndexStats();
  let count = stats.items;

  return {
    async addBatch(items) {
      let remaining = items;
      while (remaining.length > 0) {
        if (count >= SHARD_MAX_ITEMS) {
          currentShard++;
          index = new LocalIndex(shardPath(currentShard));
          await index.createIndex();
          count = 0;
        }
        const space = SHARD_MAX_ITEMS - count;
        const slice = remaining.slice(0, space);
        remaining = remaining.slice(space);
        const withIds = slice.map((it) => ({ id: uuid(), vector: it.vector, metadata: it.metadata }));
        await index.batchInsertItems(withIds);
        count += withIds.length;
      }
    },
  };
}

async function query(vector, queryText, topK = 8) {
  const shardIdxs = listShardIndices();
  let allResults = [];
  for (const i of shardIdxs) {
    const idx = new LocalIndex(shardPath(i));
    if (await idx.isIndexCreated()) {
      const res = await idx.queryItems(vector, queryText, topK);
      allResults.push(...res);
    }
  }
  allResults.sort((a, b) => b.score - a.score);
  return allResults.slice(0, topK);
}

module.exports = { INDEX_ROOT, SHARD_MAX_ITEMS, openWriter, query, listShardIndices };
