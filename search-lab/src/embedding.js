'use strict';

const { resolveModelCacheDir } = require('./env');

// C-02: 문서 임베딩과 반드시 동일한 모델·차원·설정이어야 한다.
// vector-pipeline/src/embeddingClient.js 가 사용한 것과 같은 경로(vectra
// TransformersEmbeddings, dtype q8, mean pooling, normalize)를 그대로 쓴다.
const MODEL = 'Xenova/multilingual-e5-small';
const DIMENSIONS = 384;

// 문서는 'passage: ' 로 임베딩되어 있다(labor_chunks.embedding 컬럼 코멘트 및
// vector-pipeline/src/embeddingClient.js:26 로 확인). e5 계열은 프리픽스에 민감하므로
// 질의는 반드시 'query: ' 를 붙인다.
const QUERY_PREFIX = 'query: ';

let basePromise = null;

async function getBase() {
  if (!basePromise) {
    basePromise = (async () => {
      const transformers = require('@huggingface/transformers');
      transformers.env.cacheDir = resolveModelCacheDir();

      const { TransformersEmbeddings } = require('vectra');
      return TransformersEmbeddings.create({
        model: MODEL,
        dtype: 'q8',
        device: 'cpu',
      });
    })();
  }
  return basePromise;
}

async function embedQuery(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('embedQuery: 비어 있지 않은 문자열이 필요합니다.');
  }
  const base = await getBase();
  const res = await base.createEmbeddings([QUERY_PREFIX + text.trim()]);
  if (res.status !== 'success') {
    throw new Error('embedding failed: ' + res.message);
  }
  const vector = res.output[0];
  if (!Array.isArray(vector) || vector.length !== DIMENSIONS) {
    throw new Error(
      `embedQuery: 차원 불일치 - 기대 ${DIMENSIONS}, 실제 ${vector && vector.length}`
    );
  }
  return vector;
}

module.exports = { MODEL, DIMENSIONS, QUERY_PREFIX, embedQuery, getBase };
