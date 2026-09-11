// 검색 전용 모드(Claude API 없이)가 실제로 어떤 답변을 내는지 눈으로 확인한다.
// 실행: npx tsx --conditions react-server scripts/preview-answer.mts "질문"

import { readFileSync } from 'node:fs';

for (const file of ['.env.local', '.env', '../vector-pipeline/.env']) {
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {
    // 없으면 넘어간다
  }
}

const { retrieve } = await import('../src/lib/rag/retriever');
const { buildRetrievalOnlyBody } = await import('../src/lib/answer/retrievalOnly');
const { assemble, verifyAssembled } = await import('../src/lib/answer/assemble');
const { looksLaborRelated } = await import('../src/lib/answer/keywords');
const { OUT_OF_SCOPE_MESSAGE } = await import('../src/lib/answer/disclaimer');

const question = process.argv[2] ?? '취업규칙을 근로자에게 불리하게 변경하려면 어떤 동의가 필요한가요?';

console.log(`질문: ${question}\n`);

const t0 = Date.now();
const retrieval = await retrieve(question);
console.log(
  `회수 ${retrieval.retrieved} → 채택 ${retrieval.chunks.length} / 임베딩 ${retrieval.embedMs}ms / 검색 ${retrieval.searchMs}ms / 총 ${Date.now() - t0}ms`
);
console.log(`노동 용어 포함: ${looksLaborRelated(question)}\n`);

if (retrieval.chunks.length === 0 && !looksLaborRelated(question)) {
  console.log('=== 범위 밖으로 판정 — 고정 거절 문구 ===');
  console.log(OUT_OF_SCOPE_MESSAGE);
  process.exit(0);
}

const body = buildRetrievalOnlyBody(question, retrieval.chunks);
const assembled = assemble(body);
const check = verifyAssembled(assembled);

console.log('='.repeat(78));
console.log(assembled);
console.log('='.repeat(78));
console.log(`\n면책 검증: ${check.ok ? 'PASS' : 'FAIL — ' + check.problems.join(', ')}`);
console.log(`본문 길이: ${body.length}자`);
