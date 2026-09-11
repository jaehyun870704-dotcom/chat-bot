import { SECTIONS } from './assemble';

// 답변 본문은 '## 제목' 으로 나뉜 5개 섹션이다(PRD §7.1).
// 렌더링을 위해 구조로 되돌린다. 알 수 없는 제목이 오더라도 버리지 않고 그대로 싣는다.

export type Section = { heading: string; body: string };

const KNOWN = new Set<string>(SECTIONS);

export function splitSections(body: string): Section[] {
  if (typeof body !== 'string' || !body.trim()) return [];

  const lines = body.split('\n');
  const out: Section[] = [];
  let current: Section | null = null;

  for (const line of lines) {
    const match = line.match(/^\s*#{2,3}\s+(.+?)\s*$/);
    if (match) {
      if (current) out.push(current);
      current = { heading: match[1], body: '' };
      continue;
    }
    if (!current) {
      // 제목보다 앞선 내용은 첫 섹션으로 묶는다.
      current = { heading: '', body: '' };
    }
    current.body += (current.body ? '\n' : '') + line;
  }

  if (current) out.push(current);

  return out
    .map((s) => ({ heading: s.heading, body: s.body.trim() }))
    .filter((s) => s.heading || s.body);
}

export function isKnownSection(heading: string): boolean {
  return KNOWN.has(heading);
}

/** 섹션별 아이콘. 목업의 카드 헤더 패턴에 맞춘다. */
export function sectionIcon(heading: string): string {
  switch (heading) {
    case '핵심 답변':
      return 'target';
    case '근거 자료 상세':
      return 'menu_book';
    case '실무적 적용':
      return 'checklist';
    case '연관 내용':
      return 'lan';
    case '관련 판례':
      return 'gavel';
    default:
      return 'article';
  }
}
