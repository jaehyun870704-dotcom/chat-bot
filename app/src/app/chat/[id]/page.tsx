import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MessageComposer } from '@/components/MessageComposer';
import { AnswerView } from '@/components/AnswerView';
import { SuggestedQuestions } from '@/components/SuggestedQuestions';
import { BrandAvatar } from '@/components/BrandMark';
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
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-surface-container-high px-2.5 py-1 text-caption font-medium text-on-primary-fixed">
          <Icon name="database" size={13} />
          보유 자료 29.8만건
        </span>
      </header>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-space-lg px-margin pb-space-lg pt-space-md">
          {list.length === 0 ? (
            <EmptyThread />
          ) : (
            <>
              <DateDivider />
              {list.map((m, i) =>
                m.role === 'user' ? (
                  <UserBubble
                    key={m.id}
                    content={m.content}
                    createdAt={m.created_at}
                    // 답변이 뒤따르면 처리가 끝난 것이다.
                    answered={list[i + 1]?.role === 'assistant'}
                  />
                ) : (
                  <AnswerView
                    key={m.id}
                    body={m.content}
                    citations={m.citations}
                    createdAt={m.created_at}
                    messageId={m.id}
                    conversationId={id}
                    // 다시 생성할 때 쓸 원래 질문. 바로 앞 사용자 메시지다.
                    question={list[i - 1]?.role === 'user' ? list[i - 1].content : undefined}
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
    <div className="my-space-xs flex items-center justify-center">
      <div className="flex items-center gap-1.5 rounded-full bg-surface-container-high/70 px-3 py-1 shadow-sm backdrop-blur-md">
        <Icon name="calendar_today" size={14} className="text-on-surface-variant" />
        <span className="text-caption text-on-surface-variant">오늘</span>
      </div>
    </div>
  );
}

function UserBubble({
  content,
  createdAt,
  answered,
}: {
  content: string;
  createdAt: string;
  answered: boolean;
}) {
  return (
    <div className="flex max-w-[82%] flex-col items-end gap-1 self-end">
      <div className="rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-on-primary shadow-sm">
        <p className="break-keep-ko whitespace-pre-wrap text-body-md leading-relaxed">{content}</p>
      </div>
      <div className="mr-1 flex items-center gap-1">
        <span className="text-caption text-on-surface-variant">
          {new Date(createdAt).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })}
        </span>
        {answered && (
          <>
            <span className="text-caption text-on-surface-variant">•</span>
            <span className="text-caption font-medium text-primary">답변됨</span>
          </>
        )}
      </div>
    </div>
  );
}

function EmptyThread() {
  return (
    <div className="flex flex-col gap-space-lg">
      <DateDivider />

      <div className="group flex max-w-[88%] items-start gap-space-sm">
        <BrandAvatar size={32} className="mt-6 shadow-sm" />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="ml-1 text-label-sm font-semibold text-on-surface">노무 어시스턴트</span>
          <div className="rounded-2xl rounded-tl-sm bg-surface-container-lowest p-space-md shadow-sm">
            <p className="break-keep-ko text-body-md leading-relaxed text-on-surface">
              인사 실무에서 막히는 점을 물어보세요. 보유 자료{' '}
              <strong className="font-semibold">29만 8천여 건</strong>에서 찾아, 무엇을 근거로
              그렇게 말하는지까지 함께 보여 드립니다.
            </p>
          </div>
        </div>
      </div>

      <SuggestedQuestions />
    </div>
  );
}
