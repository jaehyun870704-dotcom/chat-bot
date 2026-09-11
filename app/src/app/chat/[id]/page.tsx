import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MessageComposer } from '@/components/MessageComposer';
import { AnswerView } from '@/components/AnswerView';
import { SuggestedQuestions } from '@/components/SuggestedQuestions';
import { BrandMark } from '@/components/BrandMark';
import { Icon } from '@/components/Icon';

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // RLS 가 남의 대화를 걸러내므로, 결과가 없으면 없는 것으로 취급한다.
  const { data: conversation } = await supabase
    .from('conversations')
    .select('id, title, deleted_at')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!conversation) notFound();

  const { data: messages } = await supabase
    .from('messages')
    .select('id, role, content, citations, created_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true });

  const list = messages ?? [];

  return (
    <>
      <header className="hidden shrink-0 items-center gap-space-sm border-b border-outline-variant/40 px-space-xl py-space-md md:flex">
        <h1 className="min-w-0 flex-1 truncate text-headline-sm text-on-surface">
          {conversation.title}
        </h1>
        <span className="flex items-center gap-1 rounded-full bg-surface-container-high px-2.5 py-1 text-caption font-medium text-on-primary-fixed">
          <Icon name="database" size={13} />
          판례·행정해석 29.8만건
        </span>
      </header>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-space-xl px-margin py-space-xl">
          {list.length === 0 ? (
            <EmptyThread />
          ) : (
            <>
              <DateDivider />
              {list.map((m) =>
                m.role === 'user' ? (
                  <UserBubble key={m.id} content={m.content} createdAt={m.created_at} />
                ) : (
                  <AnswerView
                    key={m.id}
                    body={m.content}
                    citations={m.citations}
                    createdAt={m.created_at}
                  />
                )
              )}
            </>
          )}
        </div>
      </div>

      <MessageComposer conversationId={id} />
    </>
  );
}

function DateDivider() {
  return (
    <div className="flex items-center justify-center">
      <div className="flex items-center gap-1.5 rounded-full bg-surface-container-high/70 px-3 py-1 shadow-sm backdrop-blur-md">
        <Icon name="calendar_today" size={14} className="text-on-surface-variant" />
        <span className="text-caption text-on-surface-variant">오늘</span>
      </div>
    </div>
  );
}

function UserBubble({ content, createdAt }: { content: string; createdAt: string }) {
  return (
    <div className="flex max-w-[82%] flex-col items-end gap-1 self-end">
      <div className="rounded-xl rounded-br-DEFAULT bg-primary px-4 py-3 text-on-primary shadow-sm">
        <p className="break-keep-ko whitespace-pre-wrap text-body-md leading-relaxed">{content}</p>
      </div>
      <span className="mr-1 text-caption text-on-surface-variant">
        {new Date(createdAt).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })}
      </span>
    </div>
  );
}

function EmptyThread() {
  return (
    <div className="flex flex-col gap-space-lg">
      <div className="flex items-start gap-space-sm">
        <BrandMark size={32} className="mt-6 shadow-sm" />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="ml-1 text-label-sm font-semibold text-on-surface">노무 어시스턴트</span>
          <div className="rounded-xl rounded-tl-DEFAULT bg-surface-container-lowest p-space-md shadow-sm">
            <p className="break-keep-ko text-body-md leading-relaxed text-on-surface">
              노동법·인사 실무 질문을 남겨 주세요. 판례·행정해석·지침·산재재결례·상담사례{' '}
              <strong className="font-semibold">29만 8천여 건</strong>을 검색해 근거와 함께
              정리해 드립니다.
            </p>
          </div>
        </div>
      </div>

      <SuggestedQuestions />
    </div>
  );
}
