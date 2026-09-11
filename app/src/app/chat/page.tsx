import { createConversation } from './actions';
import { BrandMark } from '@/components/BrandMark';
import { Icon } from '@/components/Icon';

const HIGHLIGHTS = [
  { icon: 'gavel', label: '판례', value: '23.6만' },
  { icon: 'description', label: '행정해석', value: '4.1만' },
  { icon: 'health_and_safety', label: '산재재결례', value: '7,116' },
  { icon: 'menu_book', label: '지침·상담사례', value: '3,876' },
];

export default function ChatIndexPage() {
  return (
    <div className="no-scrollbar flex flex-1 flex-col items-center justify-center overflow-y-auto px-margin py-space-xl">
      <div className="flex w-full max-w-md flex-col items-center gap-space-xl text-center">
        <span className="flex h-24 w-24 items-center justify-center rounded-full bg-accent"><BrandMark size={58} className="text-on-accent" title="좋은인재연구소" /></span>

        <div className="flex flex-col gap-2">
          <h1 className="text-headline-md text-on-surface">무엇을 도와드릴까요?</h1>
          <p className="break-keep-ko text-body-md leading-relaxed text-on-surface-variant">
            근로시간, 임금, 징계, 해고, 산재, 인사제도 등 인사 실무에서 막히는 점을
            물어보세요. 보유 자료에서 찾아 근거와 함께 정리해 드립니다.
          </p>
        </div>

        <div className="grid w-full grid-cols-2 gap-2">
          {HIGHLIGHTS.map((h) => (
            <div
              key={h.label}
              className="flex flex-col items-start gap-1 rounded-xl bg-surface-container-low p-space-md text-left"
            >
              <Icon name={h.icon} size={18} className="text-on-surface-variant" />
              <span className="text-headline-sm tabular-nums text-on-surface">{h.value}</span>
              <span className="text-caption text-on-surface-variant">{h.label}</span>
            </div>
          ))}
        </div>

        <form action={createConversation} className="w-full">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-1.5 rounded-full bg-primary px-space-xl py-3 text-label-md font-medium text-on-primary shadow-md transition-all hover:opacity-95 active:scale-[0.98]"
          >
            <Icon name="add_comment" size={18} />
            새 대화 시작하기
          </button>
        </form>
      </div>
    </div>
  );
}
