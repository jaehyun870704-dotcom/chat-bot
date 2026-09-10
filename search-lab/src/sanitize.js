'use strict';

// 코퍼스 인코딩 손상 보정.
// 판례1~4 소스는 원문 적재 시 CP949 → UTF-8 변환에서 일부 기호(문단 표시 등)가
// '?' 로 치환되어 있다. 실측: 298,950 청크 중 129,067건(43.2%)에 '???' 가 포함되고,
// 평균적으로 608자 중 20.7자(5.4%)가 '?' 다. 한글 본문 자체는 보존되어 있다.
//
// 임베딩은 이미 이 잡음을 포함한 채 생성되었으므로 여기서는 바로잡지 못한다.
// 다만 LLM 프롬프트와 인용 표시에 잡음이 그대로 들어가는 것은 막는다
// (PRD §7.4: 인용은 자료에 실재하는 문구만 그대로 옮긴다).

const MOJIBAKE_RUN = /\?{2,}/g;

function sanitizeContent(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(MOJIBAKE_RUN, ' ')   // 물음표 2개 이상 연속 = 손상 흔적. 단독 '?'는 실제 물음표일 수 있어 보존한다.
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

function hasMojibake(text) {
  return typeof text === 'string' && /\?{2,}/.test(text);
}

module.exports = { sanitizeContent, hasMojibake };
