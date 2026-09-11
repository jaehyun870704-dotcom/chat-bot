'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { DISCLAIMER_BOTTOM } from '@/lib/answer/disclaimer';

// PRD F-03: 스트리밍 출력. 검색 중·생성 중 상태를 UI에 표시한다.

type Citation = {
  id: number;
  source: string | null;
  title: string | null;
  similarity: number;
  excerpt: string;
};

type Stage = 'scope' | 'rewrite' | 'search' | 'generate';

const STAGE_LABEL: Record<Stage, string> = {
  scope: '질문 범위를 확인하는 중…',
  rewrite: '검색어를 정리하는 중…',
  search: '판례·행정해석 자료를 검색하는 중… (최대 30초)',
  generate: '근거를 바탕으로 답변을 작성하는 중…',
};

const BLOCKED_MESSAGE: Record<string, string> = {
  need_subscription:
    '무료 질문 3회를 모두 사용하셨습니다. 계속 이용하시려면 구독이 필요합니다.',
  need_topup: '이번 주기의 토큰을 모두 사용하셨습니다. 충전 후 계속 이용하실 수 있습니다.',
  no_profile: '계정 정보를 불러오지 못했습니다. 다시 로그인해 주세요.',
};

export function MessageComposer({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const [pending, setPending] = useState(false);
  const [stage, setStage] = useState<Stage | null>(null);
  const [draft, setDraft] = useState('');
  const [citations, setCitations] = useState<Citation[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 실패하면 사용자가 쓴 질문을 되돌려 준다. 다시 타이핑하게 만들지 않는다.
  function restoreQuestion(question: string) {
    const field = formRef.current?.elements.namedItem('question');
    if (field instanceof HTMLTextAreaElement) field.value = question;
  }

  async function handleSubmit(formData: FormData) {
    const question = String(formData.get('question') ?? '').trim();
    if (!question || pending) return;

    setPending(true);
    setStage(null);
    setDraft('');
    setCitations([]);
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
            case 'citations':
              setCitations(event.citations as Citation[]);
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
    }
  }

  return (
    <div className="border-t border-neutral-200">
      {(draft || stage || notice || error) && (
        <div className="mx-auto max-w-3xl space-y-2 px-6 pt-4">
          {stage && !draft && (
            <p className="text-sm text-neutral-500">{STAGE_LABEL[stage]}</p>
          )}

          {draft && (
            <div className="space-y-2">
              <p className="rounded-md border-l-2 border-neutral-300 bg-neutral-50 px-3 py-2 text-xs leading-relaxed text-neutral-600">
                아래 답변은 제공된 판례·행정해석·상담사례 자료를 검색해 정리한{' '}
                <strong>정보 제공용 안내</strong>이며, 법률 자문이나 노무 상담이 아닙니다.
              </p>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{draft}</div>
              {citations.length > 0 && (
                <p className="text-xs text-neutral-500">인용 근거 {citations.length}건</p>
              )}
              {!pending && (
                <p className="rounded-md border-l-2 border-neutral-300 bg-neutral-50 px-3 py-2 text-xs leading-relaxed text-neutral-600">
                  {DISCLAIMER_BOTTOM}
                </p>
              )}
            </div>
          )}

          {notice && (
            <p role="status" className="rounded-md bg-neutral-100 px-3 py-2 text-sm">
              {notice}
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>
      )}

      <div className="px-6 py-4">
        <form ref={formRef} action={handleSubmit} className="mx-auto flex max-w-3xl gap-2">
          <textarea
            name="question"
            required
            rows={2}
            disabled={pending}
            placeholder="노동법·인사 실무 질문을 입력하세요"
            className="min-w-0 flex-1 resize-none rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-accent disabled:bg-neutral-50"
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
            className="shrink-0 self-end rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {pending ? '답변 중…' : '보내기'}
          </button>
        </form>
      </div>
    </div>
  );
}
