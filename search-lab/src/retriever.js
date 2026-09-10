'use strict';

const { createClient } = require('@supabase/supabase-js');
const { requireEnv } = require('./env');
const { embedQuery, DIMENSIONS } = require('./embedding');
const { sanitizeContent, hasMojibake } = require('./sanitize');

const DEFAULT_TOP_K = 20;

let clientInstance = null;

function getClient() {
  if (!clientInstance) {
    clientInstance = createClient(
      requireEnv('SUPABASE_URL'),
      requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }
  return clientInstance;
}

/**
 * 질문 텍스트로 labor_chunks 를 코사인 유사도 검색한다.
 * @returns {{ chunks: Array, embedMs: number, searchMs: number }}
 */
async function search(question, { topK = DEFAULT_TOP_K } = {}) {
  const t0 = Date.now();
  const embedding = await embedQuery(question);
  const embedMs = Date.now() - t0;

  const t1 = Date.now();
  const { data, error } = await getClient().rpc('match_labor_chunks', {
    query_embedding: embedding,
    match_count: topK,
  });
  const searchMs = Date.now() - t1;

  if (error) {
    throw new Error(`검색 실패: ${error.message}${error.hint ? ` (${error.hint})` : ''}`);
  }

  // 코퍼스 인코딩 손상('???')을 프롬프트·인용에 노출하지 않는다. 원문은 rawContent 로 보존.
  const chunks = (data || []).map((c) => ({
    ...c,
    rawContent: c.content,
    content: sanitizeContent(c.content),
    sanitized: hasMojibake(c.content),
  }));

  return { chunks, embedMs, searchMs };
}

module.exports = { search, getClient, DEFAULT_TOP_K, DIMENSIONS };
