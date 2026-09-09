const fs = require('fs');
const path = require('path');
const { cleanText } = require('./textUtil');
const { embedPassages, getSplitter } = require('./embeddingClient');
const { openWriter } = require('./vectorStore');
const { openJsonlWriter } = require('./jsonlWriter');
const { makeTracker } = require('./progress');

const SRC_DIR = path.join(__dirname, '..', '..', '자료실');
const BATCH_SIZE = 16; // chunks embedded per model call
const FLUSH_SIZE = 300; // chunks per vector-index write

async function run() {
  const files = fs
    .readdirSync(SRC_DIR)
    .filter((f) => f.toLowerCase().endsWith('.txt'));

  console.log(`found ${files.length} txt files in 자료실`);

  const splitter = await getSplitter(1000, 100);
  const writer = await openWriter();
  const jsonl = openJsonlWriter('vectors.jsonl');
  const tracker = makeTracker();

  let totalChunks = 0;
  let pendingItems = [];

  async function flush() {
    if (pendingItems.length === 0) return;
    await writer.addBatch(pendingItems);
    totalChunks += pendingItems.length;
    pendingItems = [];
  }

  for (const file of files) {
    const uri = `txt://자료실/${file}`;
    if (tracker.isDone(uri)) {
      console.log(`skip (already done): ${file}`);
      continue;
    }

    const raw = fs.readFileSync(path.join(SRC_DIR, file), 'utf8');
    const text = cleanText(raw);
    if (!text) {
      console.log(`skip (empty): ${file}`);
      tracker.markDone(uri);
      continue;
    }

    const chunks = splitter.split(text);
    console.log(`${file}: ${chunks.length} chunks`);

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const texts = batch.map((c) => c.text.replace(/\n/g, ' '));
      const vectors = await embedPassages(texts);

      for (let j = 0; j < batch.length; j++) {
        const metadata = {
          source: file,
          category: 'reference',
          docType: 'txt',
          uri,
          chunkIndex: i + j,
          text: batch[j].text,
        };
        pendingItems.push({ vector: vectors[j], metadata });
        jsonl.writeChunk({ uri, chunkIndex: i + j, text: batch[j].text, vector: vectors[j], metadata });
      }

      if (pendingItems.length >= FLUSH_SIZE) {
        await flush();
        console.log(`  ...flushed, total chunks so far: ${totalChunks}`);
      }
    }

    tracker.markDone(uri);
    tracker.save();
  }

  await flush();
  tracker.save();
  await jsonl.close();

  console.log(`done. total chunks embedded: ${totalChunks}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
