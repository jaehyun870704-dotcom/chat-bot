'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Icon } from './Icon';

// 목업의 답변 하단 액션 툴바: 복사 · 다시 생성 · 좋아요/아쉬워요.
//
// 복사는 면책 문구를 포함한 전문을 복사한다 — 답변을 옮겨 붙일 때
// 면책이 떨어져 나가면 §7 이 요구하는 보호가 사라진다.

export function AnswerActions({
  text,
  messageId,
  conversationId,
  question,
}: {
  text: string;
  messageId?: string;
  conversationId?: string;
  question?: string;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canRegenerate = Boolean(messageId && conversationId && question);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // 클립보드 접근이 막힌 환경에서는 조용히 넘어간다.
    }
  }

  async function regenerate() {
    if (!canRegenerate || regenerating) return;

    setRegenerating(true);
    setError(null);

    try {
      // 기존 답변을 지우고 같은 질문을 다시 실행한다.
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, question, replaceMessageId: messageId }),
      });

      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? '다시 생성하지 못했습니다.');
        return;
      }

      // 스트림은 끝까지 읽어야 서버가 저장을 마친다. 화면은 완료 후 갱신한다.
      const reader = response.body.getReader();
      for (;;) {
        const { done } = await reader.read();
        if (done) break;
      }

      router.refresh();
    } catch {
      setError('연결이 끊겼습니다. 다시 시도해 주세요.');
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="ml-1 flex flex-col gap-1">
      <div className="flex items-center gap-1 text-on-surface-variant">
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
            {copied ? '복사됨!' : '복사'}
          </span>
        </button>

        {canRegenerate && (
          <button
            type="button"
            onClick={regenerate}
            disabled={regenerating}
            className="flex items-center gap-1 rounded-lg px-2 py-1 transition-colors hover:bg-surface-container-high active:scale-95 disabled:opacity-60"
          >
            <Icon name="refresh" size={16} className={regenerating ? 'animate-spin' : ''} />
            <span className="text-caption">{regenerating ? '생성 중…' : '다시 생성'}</span>
          </button>
        )}

        <div className="mx-0.5 h-3 w-px bg-surface-container-highest" />

        <button
          type="button"
          onClick={() => setFeedback((v) => (v === 'like' ? null : 'like'))}
          title="좋아요"
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

      {error && (
        <p role="alert" className="px-2 text-caption text-error">
          {error}
        </p>
      )}
    </div>
  );
}
