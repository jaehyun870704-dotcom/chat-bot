// PRD C-02 검증: 앱(app/src/lib/rag/embedding.ts)이 쓰는 직접 파이프라인 호출이
// 문서 적재에 쓰인 vectra TransformersEmbeddings 경로와 완전히 같은 벡터를 내는가.
//
// 다르면 질의와 문서가 다른 벡터 공간에 놓이고, 검색 품질이 조용히 무너진다.
// 실행: node scripts/verify-embedding-parity.mjs

import { createRequire } from 'node:module';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

const cacheDir = path.join(
  repoRoot, 'vector-pipeline', 'node_modules', '@huggingface', 'transformers', '.cache'
);
if (!existsSync(path.join(cacheDir, 'Xenova', 'multilingual-e5-small'))) {
  console.error('모델 캐시를 찾지 못했습니다:', cacheDir);
  process.exit(1);
}

const MODEL = 'Xenova/multilingual-e5-small';
const QUERIES = [
  'query: 연차휴가 산정 방법',
  'query: 수습기간 중 해고의 정당한 이유',
  'query: 취업규칙 불이익변경 동의 요건',
];

// --- 경로 A: 문서 적재가 쓴 vectra 경로 ---
const transformers = require('@huggingface/transformers');
transformers.env.cacheDir = cacheDir;

const { TransformersEmbeddings } = require('vectra');
const vectraEmbedder = await TransformersEmbeddings.create({
  model: MODEL,
  dtype: 'q8',
  device: 'cpu',
});
const vectraResult = await vectraEmbedder.createEmbeddings(QUERIES);
if (vectraResult.status !== 'success') {
  console.error('vectra 임베딩 실패:', vectraResult.message);
  process.exit(1);
}

// --- 경로 B: 앱이 쓰는 직접 파이프라인 호출 ---
const pipe = await transformers.pipeline('feature-extraction', MODEL, {
  device: 'cpu',
  dtype: 'q8',
});
const output = await pipe(QUERIES, { pooling: 'mean', normalize: true });
const [batch, dim] = output.dims;

const direct = [];
for (let i = 0; i < batch; i++) {
  direct.push(Array.from(output.data).slice(i * dim, (i + 1) * dim));
}

// --- 비교 ---
let worstDelta = 0;
let worstCosine = 1;

for (let i = 0; i < QUERIES.length; i++) {
  const a = vectraResult.output[i];
  const b = direct[i];

  if (a.length !== b.length) {
    console.error(`FAIL 차원 불일치: ${a.length} vs ${b.length}`);
    process.exit(1);
  }

  let maxDelta = 0;
  let dot = 0;
  for (let j = 0; j < a.length; j++) {
    maxDelta = Math.max(maxDelta, Math.abs(a[j] - b[j]));
    dot += a[j] * b[j];
  }

  worstDelta = Math.max(worstDelta, maxDelta);
  worstCosine = Math.min(worstCosine, dot);

  console.log(
    `${QUERIES[i].slice(0, 34).padEnd(36)} dim=${a.length}  최대편차=${maxDelta.toExponential(2)}  코사인=${dot.toFixed(10)}`
  );
}

console.log();
const ok = worstDelta < 1e-6 && worstCosine > 0.999999;
console.log(ok ? 'PASS — 두 경로가 동일한 벡터를 만든다' : 'FAIL — 벡터가 다르다');
console.log(`최대편차 ${worstDelta.toExponential(3)} / 최저코사인 ${worstCosine.toFixed(12)}`);
process.exit(ok ? 0 : 1);
