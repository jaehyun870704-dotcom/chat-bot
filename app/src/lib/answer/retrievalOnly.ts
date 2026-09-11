import type { Chunk } from '@/lib/rag/retriever';
import { markContinuation } from '@/lib/rag/sanitize';

// Claude API 를 붙이기 전의 답변 모드.
//
// 검색된 Supabase 자료만으로 PRD §7.1 템플릿을 채운다. 생성 모델이 없으므로
// 자료를 요약하거나 결론을 쓰지 않는다. 대신 찾은 자료를 구조화해 그대로 제시하고,
// 채울 수 없는 섹션은 PRD §7.5 근거_규칙대로 "확인할 수 없습니다"라고 명시한다.
//
// 지어내지 않는 것이 이 모드의 핵심이다. 자료에 있는 문장만 나간다.

const CATEGORY_LABEL: Record<string, string> = {
  판례: '판례',
  행정해석: '행정해석',
  행정심판: '행정심판',
  산재심사재결례: '산재심사 재결례',
  지침: '지침',
  reference: '실무 자료',
};

const EXCERPT_CHARS = 450;

function label(category: string | null): string {
  if (!category) return '자료';
  return CATEGORY_LABEL[category] ?? category;
}

function excerpt(chunk: Chunk, limit = EXCERPT_CHARS): string {
  // 앞부분을 잘라내지 않는다. 질문과 매칭된 문장이 청크 앞쪽에 있는 경우가 많아서다.
  // 문서 중간에서 이어지는 조각이면 표시만 한다.
  const flat = markContinuation(chunk.content, chunk.chunk_index)
    .replace(/\s*\n\s*/g, ' ')
    .trim();
  return flat.length <= limit ? flat : `${flat.slice(0, limit)}…`;
}

/** 판례 제목의 선고일자("2007. 10. 12. 선고")를 뽑아 정렬에 쓴다. 없으면 null. */
export function parseDecisionDate(title: string | null): Date | null {
  if (!title) return null;
  const m = title.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\./);
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** 같은 사건이 여러 청크로 쪼개져 있으므로 제목 기준으로 중복을 제거한다. */
function dedupeByTitle(chunks: Chunk[]): Chunk[] {
  const seen = new Set<string>();
  const out: Chunk[] = [];
  for (const c of chunks) {
    const key = (c.title ?? `id:${c.id}`).trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

const NOT_AVAILABLE = '제공된 자료 내에서는 해당 내용을 확인할 수 없습니다.';

/**
 * 검색 결과만으로 답변 본문을 조립한다.
 * 반환 문자열에는 면책 문구가 없다 — assemble() 이 붙인다(PRD §7.2).
 */
export function buildRetrievalOnlyBody(question: string, chunks: Chunk[]): string {
  if (chunks.length === 0) {
    return [
      '## 핵심 답변',
      '질문과 충분히 관련된 자료를 보유 자료에서 찾지 못했습니다. 질문을 조금 더 구체적으로 바꾸어 다시 시도해 주세요.',
      '',
      '## 근거 자료 상세',
      NOT_AVAILABLE,
      '',
      '## 실무적 적용',
      NOT_AVAILABLE,
      '',
      '## 연관 내용',
      NOT_AVAILABLE,
      '',
      '## 관련 판례',
      '제공된 자료 내에서 관련 판례를 확인할 수 없습니다.',
    ].join('\n');
  }

  const unique = dedupeByTitle(chunks);
  const counts = new Map<string, number>();
  for (const c of unique) {
    const key = label(c.category);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const breakdown = [...counts.entries()].map(([k, v]) => `${k} ${v}건`).join(', ');

  // [핵심 답변] 요약을 지어내지 않는다. 무엇을 찾았는지만 사실대로 쓴다.
  const summary = [
    '## 핵심 답변',
    `질문과 관련된 자료 ${unique.length}건을 찾았습니다(${breakdown}). 아래 근거 자료의 원문을 확인해 주세요.`,
    '현재는 검색된 자료를 그대로 제시하는 단계이며, 자료를 종합한 결론은 제시하지 않습니다. 자료에 없는 내용을 추측해 채우지 않기 위해서입니다.',
  ].join('\n');

  // [근거 자료 상세] 찾은 자료를 유사도 순으로. 출처 라벨 대신 제목을 소제목으로 쓴다.
  const details = [
    '## 근거 자료 상세',
    ...unique.slice(0, 6).map((c, i) => {
      const heading = c.title?.trim() || `${label(c.category)} 자료`;
      return `**${i + 1}. ${heading}** — ${label(c.category)}\n${excerpt(c)}`;
    }),
  ].join('\n\n');

  // [실무적 적용] 절차를 생성할 수 없다. 명시한다.
  const application = [
    '## 실무적 적용',
    `${NOT_AVAILABLE} 위 근거 자료의 원문에서 요건과 절차를 직접 확인해 주시기 바랍니다.`,
  ].join('\n');

  // [연관 내용] 같은 검색에서 함께 나온, 본문에 싣지 못한 자료 제목을 안내한다.
  const related = unique.slice(6);
  const relatedSection = [
    '## 연관 내용',
    related.length > 0
      ? `같은 검색에서 다음 자료도 함께 확인되었습니다: ${related
          .map((c) => c.title?.trim() || label(c.category))
          .join(' / ')}`
      : NOT_AVAILABLE,
  ].join('\n');

  // [관련 판례] 자료에 실재하는 판례만. 선고일자 최신순. 개수를 채우지 않는다.
  const cases = unique
    .filter((c) => c.category === '판례' && c.title?.trim())
    .sort((a, b) => {
      const da = parseDecisionDate(a.title)?.getTime() ?? 0;
      const db = parseDecisionDate(b.title)?.getTime() ?? 0;
      return db - da;
    });

  const caseSection = [
    '## 관련 판례',
    cases.length > 0
      ? cases.map((c) => `- ${c.title!.trim()}`).join('\n')
      : '제공된 자료 내에서 관련 판례를 확인할 수 없습니다.',
  ].join('\n');

  return [summary, details, application, relatedSection, caseSection].join('\n\n');
}
