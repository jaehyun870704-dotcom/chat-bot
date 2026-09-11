// 코퍼스 잡음 제거.
//
// 원문 적재 과정에서 두 종류의 잡음이 섞였다.
//
// (1) 인코딩 손상 — 판례1~4 소스는 CP949 → UTF-8 변환에서 일부 기호가 '?' 로 치환됐다.
//     실측(2026-09-11): 298,950 청크 중 129,067건(43.2%)에 '???' 가 포함되고,
//     평균 608자 중 20.7자(5.4%)가 '?' 다. 한글 본문 자체는 보존되어 있다.
//
// (2) 웹 스크랩 UI 문구 — 원본 사이트의 버튼·토스트 텍스트("번호 복사",
//     "복사되었습니다" 등)가 본문에 섞여 들어왔다. 자료 내용이 아니다.
//
// 임베딩은 이미 이 잡음을 포함한 채 생성되었으므로 검색 순위는 바로잡지 못한다.
// 다만 LLM 프롬프트와 사용자에게 보이는 인용에 잡음이 들어가는 것은 막는다
// (PRD §7.4: 인용은 자료에 실재하는 문구만 그대로 옮긴다).

// 물음표 2개 이상 연속 = 확실한 손상 흔적.
const MOJIBAKE_RUN = /\?{2,}/g;

// 단독 '?' 중 실제 물음표일 수 없는 자리만 고른다.
// 여는 괄호 바로 앞, 마침표 바로 뒤 — 한국어에서 물음표가 올 수 없는 위치다.
const MOJIBAKE_SINGLE = [
  /\?(?=[【〔「『(\[])/g, // "? 【요 지】"
  /(?<=[.\d])\?(?=\s*\S)/g, // "2.? 고쳐 쓰는 부분"
];

// 원본 사이트의 UI 문구. 자료 내용이 아니다.
const SCRAPE_NOISE = [
  /번호가?\s*복사(되었습니다)?\.?/g,
  /서식\s*없이\s*복사되었습니다\.?/g,
  /복사되었습니다\.?/g,
  /번호\s*복사(?![가-힣])/g,
];

export function sanitizeChunkContent(text: string): string {
  if (typeof text !== 'string') return '';

  let out = text.replace(MOJIBAKE_RUN, ' ');
  for (const pattern of MOJIBAKE_SINGLE) out = out.replace(pattern, '');
  for (const pattern of SCRAPE_NOISE) out = out.replace(pattern, ' ');

  return out
    .replace(/[ \t ]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\s+([.,)\]】])/g, '$1')
    .trim();
}

export function hasMojibake(text: string): boolean {
  return typeof text === 'string' && /\?{2,}/.test(text);
}

/**
 * 청크는 문서 중간을 잘라낸 것이라 문장 중간에서 시작하는 경우가 많다("를 해고하려면…").
 *
 * 앞부분을 잘라내지는 않는다. 질문과 매칭된 핵심 문장이 대개 청크 앞쪽에 있어서,
 * 문장 경계까지 버리면 정작 필요한 내용이 사라진다. 대신 이어지는 내용임을 표시만 한다.
 *
 * chunk_index 가 0보다 크면 문서의 첫 조각이 아니므로 반드시 중간에서 시작한다.
 */
export function markContinuation(text: string, chunkIndex: number): string {
  if (typeof text !== 'string' || !text) return '';
  if (chunkIndex <= 0) return text;
  return `… ${text}`;
}
