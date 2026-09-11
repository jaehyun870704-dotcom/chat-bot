'use client';

import { useActionState } from 'react';
import { sendMessage, type SendState } from '@/app/chat/send';

const INITIAL: SendState = { error: null };

export function MessageComposer({ conversationId }: { conversationId: string }) {
  const [state, formAction, pending] = useActionState(sendMessage, INITIAL);

  return (
    <div className="border-t border-neutral-200 px-6 py-4">
      <form action={formAction} className="mx-auto flex max-w-3xl gap-2">
        <input type="hidden" name="conversationId" value={conversationId} />
        <textarea
          name="question"
          required
          rows={2}
          placeholder="노동법·인사 실무 질문을 입력하세요"
          className="min-w-0 flex-1 resize-none rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-accent"
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
          {pending ? '검색 중…' : '보내기'}
        </button>
      </form>

      {state.error && (
        <p role="alert" className="mx-auto mt-2 max-w-3xl text-sm text-red-700">
          {state.error}
        </p>
      )}

      <p className="mx-auto mt-2 max-w-3xl text-xs text-neutral-500">
        Phase 2 단계입니다. 답변 생성은 아직 연결되지 않았고 더미 응답이 저장됩니다.
      </p>
    </div>
  );
}
