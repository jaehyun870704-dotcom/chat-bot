const { embedQuery } = require('./embeddingClient');
const { query } = require('./vectorStore');

async function main() {
  const question = process.argv[2];
  const topK = parseInt(process.argv[3] || '5', 10);
  if (!question) {
    console.error('usage: node src/search.js "질문" [topK]');
    process.exit(1);
  }

  const vector = await embedQuery(question);
  const results = await query(vector, question, topK);

  console.log(`\n질문: ${question}\n`);
  results.forEach((r, i) => {
    const m = r.item.metadata;
    console.log(`--- #${i + 1} score=${r.score.toFixed(4)} source=${m.source} category=${m.category} ---`);
    if (m.title) console.log(`제목: ${m.title}`);
    if (m.caseLink) console.log(`링크: ${m.caseLink}`);
    console.log((m.text || '').slice(0, 400));
    console.log();
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
