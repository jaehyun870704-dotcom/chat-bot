'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Icon } from './Icon';
import { BrandMark } from './BrandMark';
import { RichText } from './RichText';
import { DISCLAIMER_BOTTOM } from '@/lib/answer/disclaimer';

// PRD F-03: 스트리밍 출력. 검색 중·생성 중 상태를 UI에 표시한다.

type Stage = 'scope' | 'rewrite' | 'search' | 'generate';

const STAGE_LABEL: Record<Stage, string> = {
  scope: '질문 범위를 확인하는 중',
  rewrite: '검색어를 정리하는 중',
  search: '판례·행정해석 자료를 검색하는 중',
  generate: '근거를 정리해 답변을 작성하는 중',
};

const STAGE_HINT: Partial<Record<Stage, string>> = {
  // 벡터 인덱스가 없어 실측 평균 17.7초다. 기다림을 숨기지 않고 미리 알린다.
  search: '자료가 29만 건이라 20초 정도 걸립니다',
};

const BLOCKED_MESSAGE: Record<string, string> = {
  need_subscription: '무료 질문 3회를 모두 사용하셨습니다. 계속 이용하시려면 구독이 필요합니다.',
  need_topup: '이번 주기의 토큰을 모두 사용하셨습니다. 충전 후 계속 이용하실 수 있습니다.',
  no_profile: '계정 정보를 불러오지 못했습니다. 다시 로그인해 주세요.',
};

export function MessageComposer({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [pending, setPending] = useState(false);
  const [stage, setStage] = useState<Stage | null>(null);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 실패하면 사용자가 쓴 질문을 되돌려 준다. 다시 타이핑하게 만들지 않는다.
  function restoreQuestion(question: string) {
    if (inputRef.current) inputRef.current.value = question;
  }

  async function handleSubmit(formData: FormData) {
    const question = String(formData.get('question') ?? '').trim();
    if (!question || pending) return;

    setPending(true);
    setStage(null);
    setDraft('');
    setNotice(null);
    setError(null);
    formRef.current?.reset();

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, question }),
      });

      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? '답변을 생성하지 못했습니다.');
        restoreQuestion(question);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          let event: Record<string, unknown>;
          try {
            event = JSON.parse(line);
          } catch {
            continue;
          }

          switch (event.type) {
            case 'status':
              setStage(event.stage as Stage);
              break;
            case 'text':
              setDraft((prev) => prev + String(event.text));
              break;
            case 'rejected':
              setNotice(String(event.message));
              break;
            case 'blocked':
              setError(BLOCKED_MESSAGE[String(event.reason)] ?? '이용할 수 없습니다.');
              restoreQuestion(question);
              break;
            case 'error':
              setError(String(event.message));
              restoreQuestion(question);
              break;
            case 'done':
              // 저장된 메시지를 서버에서 다시 읽어 정본으로 교체한다.
              router.refresh();
              break;
          }
        }
      }
    } catch {
      setError('연결이 끊겼습니다. 다시 시도해 주세요.');
      restoreQuestion(question);
    } finally {
      setPending(false);
      setStage(null);
      setDraft('');
    }
  }

  const showOverlay = Boolean(stage || draft || notice || error);

  return (
    <div className="pb-safe shrink-0 border-t border-outline-variant/40 bg-surface/85 backdrop-blur-xl shadow-dock">
      {showOverlay && (
        <div className="mx-auto w-full max-w-3xl px-margin pt-space-md">
          {/* 진행 중 표시 — 목업의 타이핑 인디케이터 패턴 */}
          {stage && !draft && (
            <div className="flex items-start gap-space-sm">
              <BrandMark size={28} className="shadow-sm" />
              <div className="flex flex-col gap-1 rounded-xl rounded-tl-DEFAULT bg-surface-container-lowest px-3.5 py-2.5 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1">
                    <span className="typing-dot h-1.5 w-1.5 rounded-full bg-primary" />
                    <span className="typing-dot h-1.5 w-1.5 rounded-full bg-primary" />
                    <span className="typing-dot h-1.5 w-1.5 rounded-full bg-primary" />
                  </span>
                  <span className="text-label-sm text-on-surface">{STAGE_LABEL[stage]}</span>
                </div>
                {STAGE_HINT[stage] && (
                  <span className="text-caption text-on-surface-variant">{STAGE_HINT[stage]}</span>
                )}
              </div>
            </div>
          )}

          {/* 스트리밍 중인 초안. 완료되면 서버가 저장한 정본으로 교체된다. */}
          {draft && (
            <div className="flex items-start gap-space-sm">
              <BrandMark size={28} className="shadow-sm" />
              <div className="no-scrollbar max-h-56 min-w-0 flex-1 overflow-y-auto rounded-xl rounded-tl-DEFAULT bg-surface-container-lowest p-3.5 shadow-sm">
                <RichText
                  text={draft}
                  className="text-body-sm leading-relaxed text-on-surface-variant"
                />
              </div>
            </div>
          )}

          {notice && (
            <p
              role="status"
              className="break-keep-ko rounded-xl bg-surface-container px-3.5 py-2.5 text-body-sm text-on-surface"
            >
              {notice}
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="break-keep-ko flex items-start gap-1.5 rounded-xl bg-error-container px-3.5 py-2.5 text-body-sm text-on-error-container"
            >
              <Icon name="error" size={16} className="mt-px shrink-0" />
              {error}
            </p>
          )}
        </div>
      )}

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-1.5 px-margin py-space-md">
        <form
          ref={formRef}
          action={handleSubmit}
          className="flex items-end gap-1.5 rounded-xl bg-surface-container-lowest p-1.5 shadow-md"
        >
          <textarea
            ref={inputRef}
            name="question"
            required
            rows={1}
            maxLength={2000}
            disabled={pending}
            placeholder="노동법·인사 실무 질문을 입력하세요"
            className="no-scrollbar max-h-32 min-w-0 flex-1 resize-none bg-transparent px-3 py-2.5 text-body-md text-on-surface outline-none placeholder:text-outline/70 disabled:opacity-60"
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button
            type="submit"
            disabled={pending}
            aria-label="질문 보내기"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary shadow-sm transition-all hover:opacity-95 active:scale-90 disabled:opacity-50"
          >
            <Icon name={pending ? 'more_horiz' : 'arrow_upward'} size={20} />
          </button>
        </form>

        <p className="px-2 text-center text-caption leading-tight text-outline">
          {DISCLAIMER_BOTTOM}
        </p>
      </div>
    </div>
  );
}
