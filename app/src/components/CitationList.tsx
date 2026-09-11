'use client';

import { useState } from 'react';
import { Icon } from './Icon';

export type Citation = {
  id?: number;
  source?: string | null;
  title?: string | null;
  category?: string | null;
  caseLink?: string | null;
  similarity?: number;
  excerpt?: string;
};

// PRD F-03: 답변 하단에 인용 근거를 접이식으로 노출한다(출처명 + 원문 발췌 + 유사도).
// 카드 모양은 목업의 옵션 카드 패턴을 따른다 — 배지 + 우측 복사 버튼 + 본문.

// 자료 종류마다 배지 색을 달리해 한눈에 구분되게 한다.
const BADGE_TONE: Record<string, string> = {
  판례: 'bg-primary-fixed text-on-primary-fixed',
  행정해석: 'bg-secondary-fixed text-on-secondary-fixed',
  행정심판: 'bg-tertiary-fixed text-on-tertiary-fixed',
  '산재심사 재결례': 'bg-surface-container-high text-on-primary-fixed',
  산재심사재결례: 'bg-surface-container-high text-on-primary-fixed',
  지침: 'bg-surface-container-high text-on-surface-variant',
};

export function CitationList({ citations }: { citations: Citation[] }) {
  const [open, setOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copyOne(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(key);
      setTimeout(() => setCopiedId((v) => (v === key ? null : v)), 1500);
    } catch {
      // 클립보드 접근이 막힌 환경에서는 조용히 넘어간다.
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center justify-between rounded-xl bg-surface-container-low px-3 py-2.5 text-left transition-colors hover:bg-surface-container"
      >
        <span className="flex items-center gap-1.5">
          <Icon name="format_quote" size={16} className="text-primary" />
          <span className="text-label-md font-medium text-on-surface">
            인용 근거 {citations.length}건
          </span>
        </span>
        <Icon
          name="expand_more"
          size={18}
          className={`text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul className="flex flex-col gap-2.5">
          {citations.map((c, i) => {
            const key = String(c.id ?? i);
            const category = c.category ?? '자료';
            const badge = BADGE_TONE[category] ?? 'bg-surface-container-high text-on-surface-variant';
            const heading = c.title?.trim() || c.source || '출처 미상';
            const copied = copiedId === key;

            return (
              <li
                key={key}
                className="flex flex-col gap-1 rounded-xl bg-surface-container-low p-3 transition-colors hover:bg-surface-container"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-caption font-semibold ${badge}`}
                  >
                    {category}
                    {typeof c.similarity === 'number' && (
                      <span className="font-normal tabular-nums opacity-80">
                        {c.similarity.toFixed(3)}
                      </span>
                    )}
                  </span>

                  <button
                    type="button"
                    onClick={() => copyOne(key, `${heading}\n${c.excerpt ?? ''}`.trim())}
                    title="자료 복사"
                    className={`p-1 transition-colors ${
                      copied ? 'text-primary' : 'text-on-surface-variant hover:text-primary'
                    }`}
                  >
                    <Icon name={copied ? 'check' : 'content_copy'} size={16} />
                  </button>
                </div>

                <p className="break-keep-ko mt-0.5 text-body-md font-medium text-on-surface">
                  {heading}
                </p>

                {c.excerpt && (
                  <p className="break-keep-ko text-body-sm leading-relaxed text-on-surface-variant">
                    {c.excerpt}
                  </p>
                )}

                {c.caseLink && (
                  <a
                    href={c.caseLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 inline-flex w-fit items-center gap-1 text-caption font-medium text-primary hover:underline"
                  >
                    원문 보기
                    <Icon name="open_in_new" size={13} />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
