'use client';

// 목업의 추천 프롬프트 칩. Phase 1 벤치마크에서 검색 품질이 확인된 주제로 채웠다.
// 눌러 보면 실제로 근거가 잘 붙는 질문들이라 첫인상이 빈손으로 끝나지 않는다.

export const SUGGESTIONS = [
  {
    emoji: '🗓️',
    label: '1년 미만 연차 산정',
    question: '입사 1년 미만 근로자의 연차휴가는 어떻게 산정하나요?',
  },
  {
    emoji: '📋',
    label: '수습기간 해고',
    question: '수습기간 중인 직원을 해고할 때도 정당한 이유가 필요한가요?',
  },
  {
    emoji: '💰',
    label: '통상임금 범위',
    question: '정기상여금이 통상임금에 포함되는 기준은 무엇인가요?',
  },
  {
    emoji: '📄',
    label: '취업규칙 불이익변경',
    question: '취업규칙을 근로자에게 불리하게 변경하려면 어떤 동의가 필요한가요?',
  },
  {
    emoji: '⚠️',
    label: '해고 서면통지',
    question: '해고를 서면으로 통지하지 않으면 어떤 효력이 생기나요?',
  },
  {
    emoji: '🏥',
    label: '산재 신청 절차',
    question: '업무상 재해로 산재 신청을 하려면 어떤 절차를 거쳐야 하나요?',
  },
] as const;

export function SuggestedQuestions() {
  function fill(question: string) {
    const field = document.querySelector<HTMLTextAreaElement>('textarea[name="question"]');
    if (!field) return;
    field.value = question;
    field.style.height = 'auto';
    field.style.height = `${Math.min(field.scrollHeight, 120)}px`;
    field.focus();
  }

  return (
    <div className="no-scrollbar -mx-margin flex flex-col gap-2 overflow-x-auto px-margin py-1">
      <div className="flex w-max items-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => fill(s.question)}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-surface-container px-3.5 py-2 text-on-surface shadow-sm transition-all hover:bg-surface-container-high active:scale-95"
          >
            <span className="text-sm">{s.emoji}</span>
            <span className="text-label-sm font-medium">{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
