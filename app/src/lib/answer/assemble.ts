import { DISCLAIMER_BOTTOM, DISCLAIMER_TOP } from './disclaimer';
import { sanitizeBody } from './sanitize';

// PRD §7.1 답변 구조. 면책 문구는 코드가 강제 삽입한다.
//
// 이 함수 외의 경로로 답변이 사용자에게 나가서는 안 된다.
// LLM 출력이 비었거나, 지시를 무시했거나, 프롬프트 인젝션을 당했더라도
// 상·하단 면책 문구는 항상 붙는다.

export const SECTIONS = [
  '핵심 답변',
  '근거 자료 상세',
  '실무적 적용',
  '연관 내용',
  '관련 판례',
] as const;

const EMPTY_BODY_FALLBACK =
  '## 핵심 답변\n제공된 자료 내에서는 해당 내용을 확인할 수 없습니다.';

/**
 * LLM 본문에 상·하단 면책 문구를 강제로 붙인다.
 *
 * @param body LLM 이 생성한 5개 섹션 본문 (면책 문구를 포함해서는 안 된다)
 */
export function assemble(body: string): string {
  const cleaned = sanitizeBody(body);
  const content = cleaned.length > 0 ? cleaned : EMPTY_BODY_FALLBACK;

  return [DISCLAIMER_TOP, '', content, '', DISCLAIMER_BOTTOM].join('\n');
}

/**
 * 조립 결과가 §7 요구사항을 만족하는지 검사한다.
 * 렌더링 직전 마지막 관문으로 쓴다.
 */
export function verifyAssembled(assembled: string): { ok: boolean; problems: string[] } {
  const problems: string[] = [];

  if (!assembled.startsWith(DISCLAIMER_TOP)) {
    problems.push('상단 면책 문구가 없거나 변형되었습니다.');
  }
  if (!assembled.trimEnd().endsWith(DISCLAIMER_BOTTOM)) {
    problems.push('하단 면책 문구가 없거나 변형되었습니다.');
  }

  // 면책 문구는 정확히 한 번씩만 나타나야 한다.
  if (occurrences(assembled, DISCLAIMER_TOP) !== 1) {
    problems.push('상단 면책 문구가 중복되었습니다.');
  }
  if (occurrences(assembled, DISCLAIMER_BOTTOM) !== 1) {
    problems.push('하단 면책 문구가 중복되었습니다.');
  }

  return { ok: problems.length === 0, problems };
}

function occurrences(haystack: string, needle: string): number {
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}
