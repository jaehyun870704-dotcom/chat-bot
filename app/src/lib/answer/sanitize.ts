// LLM 본문 후처리. PRD §7.2 / §7.4.
//
// LLM 이 어떤 지시를 받든 면책 문구가 누락·변형되는 경로가 없어야 한다.
// 따라서 (1) 본문에서 면책성 문장을 제거하고, (2) 조립은 코드가 한다.

// §7.4: 본문에 '출처:', '참고:', '링크:' 라벨이나 URL 을 쓰지 않는다.
const LABEL_LINE =
  /^\s*(?:\*\*)?(?:출처|참고|링크|references?|출처 표기)(?:\*\*)?\s*[:：].*$/gim;
const URL_PATTERN = /\b(?:https?:\/\/|www\.)\S+/gi;
const BARE_DOMAIN = /\b[a-z0-9-]+\.(?:kr|com|net|org|co\.kr|go\.kr|or\.kr)\b(?:\/\S*)?/gi;

// 면책성 문구 — LLM 이 흉내 내어 쓴 경우 제거한다. 코드가 붙이는 원본과 중복되면 안 된다.
const DISCLAIMER_LIKE_SOURCE = [
  '법률\\s*자문(?:이|가)?\\s*아닙니다',
  '노무\\s*상담(?:이|가)?\\s*아닙니다',
  '정보\\s*제공용',
  '전문가의?\\s*(?:검토|상담)(?:가|이)?\\s*필요',
  '좋은인재연구소',
  'goodhr',
  '본\\s*답변은\\s*제공된\\s*자료',
].join('|');

function disclaimerLike(): RegExp {
  return new RegExp(DISCLAIMER_LIKE_SOURCE, 'i');
}

/**
 * LLM 이 생성한 본문에서 표기 규칙 위반과 면책성 문구를 제거한다.
 * 면책 문구 자체는 여기서 붙이지 않는다 — assemble() 이 담당한다.
 */
export function sanitizeBody(raw: string): string {
  if (typeof raw !== 'string') return '';

  let text = raw.replace(LABEL_LINE, '');
  text = text.replace(URL_PATTERN, '');
  text = text.replace(BARE_DOMAIN, '');

  // 면책성 문장이 섞인 줄은 통째로 버린다. 섹션 제목(##)은 보존한다.
  const pattern = disclaimerLike();
  const kept = text.split('\n').filter((line) => {
    if (line.trimStart().startsWith('#')) return true;
    return !pattern.test(line);
  });

  return kept
    .join('\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function containsDisclaimerLike(text: string): boolean {
  return disclaimerLike().test(text);
}

export function containsUrl(text: string): boolean {
  return new RegExp(URL_PATTERN.source, 'i').test(text) ||
    new RegExp(BARE_DOMAIN.source, 'i').test(text);
}
