import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MessageComposer } from '@/components/MessageComposer';
import { AnswerView } from '@/components/AnswerView';

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

  return (
    <>
      <header className="border-b border-neutral-200 px-6 py-3">
        <h1 className="truncate text-sm font-semibold">{conversation.title}</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {(messages ?? []).length === 0 && (
            <p className="text-sm text-neutral-500">
              질문을 입력하면 판례·행정해석 자료를 검색해 근거와 함께 정리해 드립니다.
            </p>
          )}

          {(messages ?? []).map((m) =>
            m.role === 'user' ? (
              <div key={m.id} className="flex justify-end">
                <p className="max-w-[80%] whitespace-pre-wrap rounded-lg bg-neutral-100 px-4 py-2.5 text-sm">
                  {m.content}
                </p>
              </div>
            ) : (
              <AnswerView key={m.id} body={m.content} citations={m.citations} />
            )
          )}
        </div>
      </div>

      <MessageComposer conversationId={id} />
    </>
  );
}
