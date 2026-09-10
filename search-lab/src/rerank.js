'use strict';

// PRD §3.3 [5]: 상위 20 → 8개로 압축. 초기 구현은 유사도 컷오프만 적용한다.
const DEFAULT_KEEP = 8;

// 컷오프 임계값 — Phase 1 실측으로 보정한 값.
//
// e5-small 정규화 코사인은 값이 좁은 구간에 몰린다. 실측 분포:
//   온토픽 노무 질문 10개  : top 0.8966 ~ 0.9381, 채택 8건 최저 0.8907
//   희귀 노무 질문(가사근로자): top 0.8868
//   오프토픽(여행)          : top 0.8562
//   오프토픽(코딩)          : top 0.8484
//
// 온토픽 최저(0.8868)와 오프토픽 최고(0.8562) 사이 여유는 0.03에 불과하다.
// 따라서 이 컷오프는 '주제 범위 가드'가 아니라 '근거 없음' 판정용 안전망으로만 쓴다.
// 범위 판정은 PRD F-04 의 LLM(Haiku) 단계가 담당한다.
const DEFAULT_MIN_SIMILARITY = 0.87;

function rerank(chunks, { keep = DEFAULT_KEEP, minSimilarity = DEFAULT_MIN_SIMILARITY } = {}) {
  const sorted = [...chunks].sort((a, b) => b.similarity - a.similarity);
  const passed = sorted.filter((c) => c.similarity >= minSimilarity);

  // 컷오프를 넘는 게 하나도 없으면 억지로 채우지 않고 빈 배열을 돌려준다.
  // 근거 없는 답변을 만드는 것보다 "자료 없음"이 낫다(PRD §7.5 근거_규칙).
  return passed.slice(0, keep);
}

module.exports = { rerank, DEFAULT_KEEP, DEFAULT_MIN_SIMILARITY };
