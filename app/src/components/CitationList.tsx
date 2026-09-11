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

export function CitationList({
  citations,
  tone,
}: {
  citations: Citation[];
  tone: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center justify-between rounded-lg bg-surface-container-low px-3 py-2 text-left transition-colors hover:bg-surface-container"
      >
        <span className="flex items-center gap-1.5">
          <Icon name="format_quote" size={16} className="text-primary" />
          <span className="text-label-sm font-medium text-on-surface">
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
        <ul className="flex flex-col gap-2">
          {citations.map((c, i) => {
            const category = c.category ?? '자료';
            const badge = tone[category] ?? 'bg-surface-container-high text-on-surface-variant';

            return (
              <li
                key={c.id ?? i}
                className="flex flex-col gap-1.5 rounded-xl bg-surface-container-low p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-caption font-semibold ${badge}`}
                  >
                    {category}
                  </span>
                  {typeof c.similarity === 'number' && (
                    <span className="text-caption tabular-nums text-on-surface-variant">
                      유사도 {c.similarity.toFixed(3)}
                    </span>
                  )}
                </div>

                <p className="break-keep-ko text-label-sm font-medium text-on-surface">
                  {c.title?.trim() || c.source || '출처 미상'}
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
                    className="inline-flex w-fit items-center gap-1 text-caption font-medium text-primary hover:underline"
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
