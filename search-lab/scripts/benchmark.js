'use strict';

// Phase 1 - 검색 파이프라인 단독 검증
// 질문 텍스트 → 임베딩 → pgvector 검색 → 상위 8개 출력, 품질/소요시간을 표로 보고한다.

const fs = require('fs');
const path = require('path');
const { loadEnv, REPO_ROOT } = require('../src/env');

loadEnv();

const { search, DEFAULT_TOP_K } = require('../src/retriever');
const { rerank, DEFAULT_KEEP, DEFAULT_MIN_SIMILARITY } = require('../src/rerank');
const { BENCHMARK_QUESTIONS } = require('../src/questions');
const { MODEL, QUERY_PREFIX } = require('../src/embedding');

function excerpt(text, len = 90) {
  const flat = String(text || '').replace(/\s+/g, ' ').trim();
  return flat.length <= len ? flat : flat.slice(0, len) + '…';
}

function pad(s, width) {
  const str = String(s);
  // 한글 폭 보정 없이 단순 정렬(터미널 가독용)
  return str.length >= width ? str : str + ' '.repeat(width - str.length);
}

async function main() {
  const started = new Date();
  const results = [];

  console.log(`모델: ${MODEL} / 질의 프리픽스: "${QUERY_PREFIX}"`);
  console.log(`top-k=${DEFAULT_TOP_K} → 컷오프 ${DEFAULT_MIN_SIMILARITY} → 최대 ${DEFAULT_KEEP}건\n`);

  for (const q of BENCHMARK_QUESTIONS) {
    process.stdout.write(`[${q.id}] ${q.text}\n`);
    let row;
    try {
      const { chunks, embedMs, searchMs } = await search(q.text, { topK: DEFAULT_TOP_K });
      const kept = rerank(chunks);
      row = {
        ...q,
        ok: true,
        embedMs,
        searchMs,
        totalMs: embedMs + searchMs,
        retrieved: chunks.length,
        kept: kept.length,
        topSimilarity: chunks.length ? chunks[0].similarity : null,
        keptChunks: kept.map((c) => ({
          id: c.id,
          source: c.source,
          docType: c.doc_type,
          category: c.category,
          title: c.title,
          similarity: c.similarity,
          excerpt: excerpt(c.content, 200),
        })),
      };
      console.log(`  임베딩 ${embedMs}ms / 검색 ${searchMs}ms / 회수 ${chunks.length} → 채택 ${kept.length}`);
      kept.slice(0, DEFAULT_KEEP).forEach((c, i) => {
        console.log(
          `   ${pad(i + 1 + '.', 4)}${c.similarity.toFixed(4)}  ${pad(excerpt(c.source, 24), 26)} ${excerpt(c.title, 40)}`
        );
        console.log(`        ${excerpt(c.content, 110)}`);
      });
      if (!kept.length && chunks.length) {
        console.log(`   (컷오프 미달 - 최고 유사도 ${chunks[0].similarity.toFixed(4)})`);
      }
    } catch (err) {
      row = { ...q, ok: false, error: err.message };
      console.log(`  실패: ${err.message}`);
    }
    console.log('');
    results.push(row);
  }

  const okRows = results.filter((r) => r.ok);
  const summary = {
    startedAt: started.toISOString(),
    finishedAt: new Date().toISOString(),
    model: MODEL,
    queryPrefix: QUERY_PREFIX,
    topK: DEFAULT_TOP_K,
    minSimilarity: DEFAULT_MIN_SIMILARITY,
    keep: DEFAULT_KEEP,
    questions: results.length,
    succeeded: okRows.length,
    avgEmbedMs: okRows.length ? Math.round(okRows.reduce((s, r) => s + r.embedMs, 0) / okRows.length) : null,
    avgSearchMs: okRows.length ? Math.round(okRows.reduce((s, r) => s + r.searchMs, 0) / okRows.length) : null,
    maxSearchMs: okRows.length ? Math.max(...okRows.map((r) => r.searchMs)) : null,
    minSearchMs: okRows.length ? Math.min(...okRows.map((r) => r.searchMs)) : null,
  };

  console.log('=== 요약 ===');
  console.log(`성공 ${summary.succeeded}/${summary.questions}`);
  console.log(`임베딩 평균 ${summary.avgEmbedMs}ms`);
  console.log(`검색 평균 ${summary.avgSearchMs}ms (최소 ${summary.minSearchMs} / 최대 ${summary.maxSearchMs})`);

  const outDir = path.join(REPO_ROOT, 'docs', 'phase1');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'search-benchmark.json');
  fs.writeFileSync(outFile, JSON.stringify({ summary, results }, null, 2), 'utf8');
  console.log(`\n결과 저장: ${path.relative(REPO_ROOT, outFile)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
