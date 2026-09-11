import { createConversation } from './actions';

export default function ChatIndexPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">무엇을 도와드릴까요?</h1>
        <p className="text-sm text-neutral-600">
          근로시간, 임금, 징계, 해고, 산재, 인사제도 등 노동법·인사 실무 질문을 남겨 주세요.
        </p>
      </div>

      <form action={createConversation}>
        <button
          type="submit"
          className="rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
        >
          새 대화 시작하기
        </button>
      </form>
    </div>
  );
}
