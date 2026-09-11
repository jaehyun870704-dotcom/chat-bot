import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { embedQuery } from './embedding';
import { hasMojibake, sanitizeChunkContent } from './sanitize';

// PRD §3.3 [4][5]: pgvector 코사인 검색 top-k(k=20) → 리랭킹으로 8개 압축.

export const TOP_K = 20;
export const KEEP = 8;

// 컷오프 임계값 — Phase 1 실측으로 보정한 값.
//
// e5-small 정규화 코사인은 값이 좁은 구간에 몰린다. 실측 분포:
//   온토픽 노무 질문 10개   : top 0.8966 ~ 0.9381, 채택 8건 최저 0.8907
//   희귀 노무 질문(가사근로자): top 0.8868
//   오프토픽(여행)           : top 0.8562
//   오프토픽(코딩)           : top 0.8484
//
// 온토픽 최저(0.8868)와 오프토픽 최고(0.8562) 사이 여유는 0.03뿐이다.
// 따라서 이 컷오프는 '주제 범위 가드'가 아니라 '근거 없음' 판정용 안전망으로만 쓴다.
// 범위 판정은 PRD F-04 의 LLM 단계가 담당한다.
export const MIN_SIMILARITY = 0.87;

export type Chunk = {
  id: number;
  uri: string;
  chunk_index: number;
  doc_type: string | null;
  source: string | null;
  category: string | null;
  title: string | null;
  case_link: string | null;
  content: string;
  similarity: number;
  sanitized: boolean;
};

export type RetrievalResult = {
  chunks: Chunk[];
  retrieved: number;
  embedMs: number;
  searchMs: number;
};

/**
 * 질문 텍스트로 labor_chunks 를 코사인 유사도 검색하고 상위 KEEP 개로 압축한다.
 *
 * 벡터 인덱스가 없어 매 검색이 298,950행 전수 스캔이다(실측 평균 17.7초).
 * RPC 쪽에 statement_timeout = 120s 를 걸어 두었다. 인덱스 도입 시 함께 되돌려야 한다.
 */
export async function retrieve(question: string): Promise<RetrievalResult> {
  const t0 = Date.now();
  const embedding = await embedQuery(question);
  const embedMs = Date.now() - t0;

  const t1 = Date.now();
  const { data, error } = await createAdminClient().rpc('match_labor_chunks', {
    query_embedding: embedding,
    match_count: TOP_K,
  });
  const searchMs = Date.now() - t1;

  if (error) {
    throw new Error(`검색 실패: ${error.message}`);
  }

  const rows = (data ?? []) as Omit<Chunk, 'sanitized'>[];

  const chunks = rows
    .map((c) => ({
      ...c,
      content: sanitizeChunkContent(c.content),
      sanitized: hasMojibake(c.content),
    }))
    .filter((c) => c.similarity >= MIN_SIMILARITY)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, KEEP);

  // 컷오프를 넘는 게 없으면 억지로 채우지 않는다.
  // 근거 없는 답변을 만드는 것보다 "자료 없음"이 낫다(PRD §7.5 근거_규칙).
  return { chunks, retrieved: rows.length, embedMs, searchMs };
}
