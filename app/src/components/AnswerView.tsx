import { assemble, verifyAssembled } from '@/lib/answer/assemble';
import { DISCLAIMER_BOTTOM, DISCLAIMER_TOP } from '@/lib/answer/disclaimer';
import { sectionIcon, splitSections } from '@/lib/answer/sections';
import { Icon } from './Icon';
import { BrandMark } from './BrandMark';
import { RichText } from './RichText';
import { CitationList, type Citation } from './CitationList';
import { AnswerActions } from './AnswerActions';

// PRD §5: messages.content 에는 면책 문구를 제외한 본문만 저장한다.
// 따라서 면책 문구는 저장이 아니라 이 렌더링 지점에서 코드가 조립한다(§7.2).
// assemble() 을 거치지 않고 답변을 그리는 경로를 만들지 않는다.

const CATEGORY_TONE: Record<string, string> = {
  판례: 'bg-primary-fixed text-on-primary-fixed',
  행정해석: 'bg-secondary-fixed text-on-secondary-fixed',
  행정심판: 'bg-tertiary-fixed text-on-tertiary-fixed',
  '산재심사 재결례': 'bg-surface-container-high text-on-surface-variant',
  지침: 'bg-surface-container-high text-on-surface-variant',
};

export function AnswerView({
  body,
  citations,
  createdAt,
}: {
  body: string;
  citations?: unknown;
  createdAt?: string;
}) {
  const assembled = assemble(body);
  const check = verifyAssembled(assembled);

  // 조립이 깨지는 경우는 없어야 한다. 그래도 깨졌다면 본문을 내보내지 않는다.
  if (!check.ok) {
    return (
      <div className="rounded-xl border border-error/30 bg-error-container px-4 py-3 text-body-sm text-on-error-container">
        답변을 표시할 수 없습니다. 다시 질문해 주세요.
      </div>
    );
  }

  const inner = assembled
    .slice(DISCLAIMER_TOP.length, assembled.length - DISCLAIMER_BOTTOM.length)
    .trim();

  const sections = splitSections(inner);
  const list = normalizeCitations(citations);
  const plainText = `${DISCLAIMER_TOP}\n\n${inner}\n\n${DISCLAIMER_BOTTOM}`;

  return (
    <div className="group flex w-full max-w-[94%] items-start gap-space-sm">
      <BrandMark size={32} className="mt-6 shadow-sm" />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="ml-1 flex items-center gap-1.5">
          <span className="text-label-sm font-semibold text-on-surface">노무 어시스턴트</span>
          {createdAt && (
            <span className="text-caption text-on-surface-variant">{formatTime(createdAt)}</span>
          )}
        </div>

        <article className="flex flex-col gap-3 rounded-xl rounded-tl-DEFAULT bg-surface-container-lowest p-4 shadow-md">
          {/* 상단 면책 — 코드가 삽입한다. LLM 이 만들지 않는다(§7.2). */}
          <div className="flex items-start gap-1.5 rounded-lg bg-surface-container-low px-3 py-2">
            <Icon name="info" size={16} className="mt-px shrink-0 text-primary" />
            <p className="break-keep-ko text-caption leading-relaxed text-on-surface-variant">
              아래 답변은 제공된 판례·행정해석·상담사례 자료를 검색해 정리한{' '}
              <strong className="font-semibold text-on-surface">정보 제공용 안내</strong>이며, 법률
              자문이나 노무 상담이 아닙니다.
            </p>
          </div>

          {sections.map((section, i) => (
            <section key={i} className="flex flex-col gap-1.5">
              {section.heading && (
                <div className="flex items-center gap-1.5">
                  <Icon name={sectionIcon(section.heading)} size={18} className="text-primary" />
                  <h3 className="text-label-md font-semibold text-on-surface">{section.heading}</h3>
                </div>
              )}
              <RichText
                text={section.body}
                className="text-body-md leading-relaxed text-on-surface"
              />
            </section>
          ))}

          {list.length > 0 && <CitationList citations={list} tone={CATEGORY_TONE} />}

          {/* 하단 면책 — 코드가 삽입한다. goodhr.kr 은 고정 텍스트다(§7.3). */}
          <p className="break-keep-ko rounded-lg bg-surface-container-low px-3 py-2 text-caption leading-relaxed text-on-surface-variant">
            {DISCLAIMER_BOTTOM}
          </p>
        </article>

        <AnswerActions text={plainText} />
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function normalizeCitations(value: unknown): Citation[] {
  if (!Array.isArray(value)) return [];
  return value.filter((c): c is Citation => typeof c === 'object' && c !== null);
}
