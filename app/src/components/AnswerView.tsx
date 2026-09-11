import { assemble, verifyAssembled } from '@/lib/answer/assemble';
import { DISCLAIMER_BOTTOM, DISCLAIMER_TOP } from '@/lib/answer/disclaimer';

// PRD §5: messages.content 에는 면책 문구를 제외한 본문만 저장한다.
// 따라서 면책 문구는 저장이 아니라 이 렌더링 지점에서 코드가 조립한다(§7.2).
// assemble() 을 거치지 않고 답변을 그리는 경로를 만들지 않는다.

type Citation = {
  id?: number;
  source?: string;
  title?: string;
  similarity?: number;
  excerpt?: string;
};

export function AnswerView({ body, citations }: { body: string; citations?: unknown }) {
  const assembled = assemble(body);
  const check = verifyAssembled(assembled);

  // 조립이 깨지는 경우는 없어야 한다. 그래도 깨졌다면 본문을 내보내지 않는다.
  if (!check.ok) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        답변을 표시할 수 없습니다. 다시 질문해 주세요.
      </div>
    );
  }

  const inner = assembled
    .slice(DISCLAIMER_TOP.length, assembled.length - DISCLAIMER_BOTTOM.length)
    .trim();

  const list = normalizeCitations(citations);

  return (
    <article className="space-y-3">
      <p className="rounded-md border-l-2 border-neutral-300 bg-neutral-50 px-3 py-2 text-xs leading-relaxed text-neutral-600">
        아래 답변은 제공된 판례·행정해석·상담사례 자료를 검색해 정리한{' '}
        <strong>정보 제공용 안내</strong>이며, 법률 자문이나 노무 상담이 아닙니다.
      </p>

      <div className="whitespace-pre-wrap text-sm leading-relaxed">{inner}</div>

      {list.length > 0 && (
        <details className="rounded-md border border-neutral-200">
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-neutral-700">
            인용 근거 {list.length}건
          </summary>
          <ul className="space-y-2 border-t border-neutral-200 px-3 py-2">
            {list.map((c, i) => (
              <li key={c.id ?? i} className="text-xs text-neutral-600">
                <p className="font-medium text-neutral-800">
                  {c.title || c.source}
                  {typeof c.similarity === 'number' && (
                    <span className="ml-2 font-normal text-neutral-500">
                      유사도 {c.similarity.toFixed(3)}
                    </span>
                  )}
                </p>
                {c.excerpt && <p className="mt-0.5 leading-relaxed">{c.excerpt}</p>}
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="rounded-md border-l-2 border-neutral-300 bg-neutral-50 px-3 py-2 text-xs leading-relaxed text-neutral-600">
        {DISCLAIMER_BOTTOM}
      </p>
    </article>
  );
}

function normalizeCitations(value: unknown): Citation[] {
  if (!Array.isArray(value)) return [];
  return value.filter((c): c is Citation => typeof c === 'object' && c !== null);
}
