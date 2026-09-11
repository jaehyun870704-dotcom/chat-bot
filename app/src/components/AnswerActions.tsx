'use client';

import { useState } from 'react';
import { Icon } from './Icon';

// 목업의 답변 하단 액션 툴바.
// 복사는 면책 문구를 포함한 전문을 복사한다 — 답변을 옮겨 붙일 때
// 면책이 떨어져 나가면 §7 이 요구하는 보호가 사라진다.

export function AnswerActions({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // 클립보드 접근이 막힌 환경에서는 조용히 넘어간다.
    }
  }

  return (
    <div className="ml-1 flex items-center gap-1 text-on-surface-variant opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 md:opacity-0">
      <button
        type="button"
        onClick={copy}
        className="flex items-center gap-1 rounded-lg px-2 py-1 transition-colors hover:bg-surface-container-high active:scale-95"
      >
        <Icon
          name={copied ? 'check' : 'content_copy'}
          size={16}
          className={copied ? 'text-primary' : ''}
        />
        <span className={`text-caption ${copied ? 'text-primary' : ''}`}>
          {copied ? '복사됨' : '복사'}
        </span>
      </button>

      <div className="mx-0.5 h-3 w-px bg-surface-container-highest" />

      <button
        type="button"
        onClick={() => setFeedback((v) => (v === 'like' ? null : 'like'))}
        title="도움이 됐어요"
        aria-pressed={feedback === 'like'}
        className={`rounded-lg p-1 transition-colors hover:bg-surface-container-high active:scale-95 ${
          feedback === 'like' ? 'text-primary' : ''
        }`}
      >
        <Icon name="thumb_up" size={16} filled={feedback === 'like'} />
      </button>

      <button
        type="button"
        onClick={() => setFeedback((v) => (v === 'dislike' ? null : 'dislike'))}
        title="아쉬워요"
        aria-pressed={feedback === 'dislike'}
        className={`rounded-lg p-1 transition-colors hover:bg-surface-container-high active:scale-95 ${
          feedback === 'dislike' ? 'text-primary' : ''
        }`}
      >
        <Icon name="thumb_down" size={16} filled={feedback === 'dislike'} />
      </button>
    </div>
  );
}
