const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { decodeBuffer, cleanText } = require('./textUtil');
const { embedPassages, getSplitter } = require('./embeddingClient');
const { openWriter } = require('./vectorStore');
const { openJsonlWriter } = require('./jsonlWriter');
const { makeTracker } = require('./progress');
const { CSV_FILES } = require('./csvSources');

const EMBED_BATCH_SIZE = 32; // chunks per model call
const FLUSH_SIZE = 3000; // chunks per vector-index write
const TRACKER_SAVE_EVERY_ROWS = 500;
const MIN_TEXT_LEN = 20;

function normalizeCaseLink(row) {
  const link = (row.case_link || '').trim();
  return link;
}

async function run() {
  const splitter = await getSplitter(1000, 100);
  const writer = await openWriter();
  const jsonl = openJsonlWriter('vectors.jsonl');
  const tracker = makeTracker();

  let totalChunks = 0;
  let totalRowsSeen = 0;
  let totalRowsEmbedded = 0;
  let totalRowsSkippedDup = 0;
  let pendingItems = [];
  let rowsSinceSave = 0;

  async function flush() {
    if (pendingItems.length === 0) return;
    await writer.addBatch(pendingItems);
    totalChunks += pendingItems.length;
    pendingItems = [];
  }

  const startedAt = Date.now();

  for (const file of CSV_FILES) {
    if (!fs.existsSync(file.path)) {
      console.log(`WARN missing file: ${file.path}`);
      continue;
    }
    console.log(`\n=== ${file.label} ===`);
    const buf = fs.readFileSync(file.path);
    const text = decodeBuffer(buf);
    const rows = parse(text, {
      columns: true,
      relax_column_count: true,
      skip_empty_lines: true,
      bom: true,
    });
    console.log(`${file.label}: ${rows.length} rows parsed`);

    // Buffer of { text, metadataBase } chunk sources awaiting embedding
    let rowChunkBuffer = []; // { text, metadataBase }

    async function embedBufferedChunks() {
      if (rowChunkBuffer.length === 0) return;
      for (let i = 0; i < rowChunkBuffer.length; i += EMBED_BATCH_SIZE) {
        const batch = rowChunkBuffer.slice(i, i + EMBED_BATCH_SIZE);
        const vectors = await embedPassages(batch.map((b) => b.text));
        for (let j = 0; j < batch.length; j++) {
          const metadata = { ...batch[j].metadataBase, text: batch[j].text };
          pendingItems.push({ vector: vectors[j], metadata });
          jsonl.writeChunk({ uri: batch[j].metadataBase.uri, text: batch[j].text, vector: vectors[j], metadata });
        }
        if (pendingItems.length >= FLUSH_SIZE) {
          await flush();
          const elapsedMin = ((Date.now() - startedAt) / 60000).toFixed(1);
          console.log(
            `  [flush] totalChunks=${totalChunks} rowsEmbedded=${totalRowsEmbedded} rowsSkippedDup=${totalRowsSkippedDup} elapsed=${elapsedMin}min`
          );
        }
      }
      rowChunkBuffer = [];
    }

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      totalRowsSeen++;

      const caseLink = normalizeCaseLink(row);
      const uri = caseLink || `csv://${file.label}#${row.web_scraper_order || idx}`;

      if (tracker.isDone(uri)) {
        totalRowsSkippedDup++;
        continue;
      }

      const title = cleanText(row.title || '');
      const content = cleanText(row.content || '');
      const combined = [title, content].filter(Boolean).join('\n\n');

      if (combined.length < MIN_TEXT_LEN) {
        tracker.markDone(uri);
        continue;
      }

      const chunks = splitter.split(combined);
      for (let c = 0; c < chunks.length; c++) {
        rowChunkBuffer.push({
          text: chunks[c].text.replace(/\n/g, ' '),
          metadataBase: {
            source: file.label,
            category: file.category,
            docType: 'csv',
            uri,
            caseLink,
            title: title.slice(0, 300),
            chunkIndex: c,
          },
        });
      }

      tracker.markDone(uri);
      totalRowsEmbedded++;
      rowsSinceSave++;

      if (rowChunkBuffer.length >= EMBED_BATCH_SIZE * 4) {
        await embedBufferedChunks();
      }
      if (rowsSinceSave >= TRACKER_SAVE_EVERY_ROWS) {
        tracker.save();
        rowsSinceSave = 0;
      }
    }

    await embedBufferedChunks();
    await flush();
    tracker.save();
    console.log(
      `${file.label} done. rowsSeen=${rows.length} rowsEmbedded(this run)=${totalRowsEmbedded} totalChunksSoFar=${totalChunks}`
    );
  }

  tracker.save();
  await jsonl.close();

  console.log(`\nALL DONE.`);
  console.log(`rows seen: ${totalRowsSeen}, rows embedded: ${totalRowsEmbedded}, rows skipped(dup/resume): ${totalRowsSkippedDup}`);
  console.log(`total chunks: ${totalChunks}`);
  console.log(`elapsed: ${((Date.now() - startedAt) / 60000).toFixed(1)} min`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
