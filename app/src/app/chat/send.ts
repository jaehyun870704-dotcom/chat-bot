'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export type SendState = { error: string | null };

const MAX_QUESTION_LENGTH = 2000;

// Phase 2 단계의 더미 응답. Phase 3 에서 검색 + Claude 생성으로 교체한다.
// 저장하는 문자열에는 면책 문구가 없다 - PRD §5 대로 본문만 저장하고,
// 면책 문구는 렌더링 시 AnswerView 가 코드로 조립한다.
const DUMMY_BODY = `## 핵심 답변
아직 답변 생성이 연결되지 않았습니다. Phase 3 에서 검색 결과를 근거로 실제 답변을 생성합니다.

## 근거 자료 상세
제공된 자료 내에서는 해당 내용을 확인할 수 없습니다.

## 실무적 적용
제공된 자료 내에서는 해당 내용을 확인할 수 없습니다.

## 연관 내용
제공된 자료 내에서는 해당 내용을 확인할 수 없습니다.

## 관련 판례
제공된 자료 내에서 관련 판례를 확인할 수 없습니다.`;

export async function sendMessage(_prev: SendState, formData: FormData): Promise<SendState> {
  const conversationId = String(formData.get('conversationId') ?? '');
  const question = String(formData.get('question') ?? '').trim();

  if (!conversationId || !question) {
    return { error: '질문을 입력해 주세요.' };
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return { error: `질문은 ${MAX_QUESTION_LENGTH}자 이내로 입력해 주세요.` };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '로그인이 필요합니다.' };

  // 소유권 확인. RLS 가 걸러내므로 결과가 없으면 남의 대화이거나 삭제된 대화다.
  const { data: conversation } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!conversation) return { error: '대화를 찾을 수 없습니다.' };

  // 메시지 쓰기는 서버만 가능하다(authenticated 에 INSERT 권한을 주지 않았다).
  // 소유권을 위에서 확인한 뒤에만 admin 클라이언트를 쓴다.
  const admin = createAdminClient();

  const { error: insertError } = await admin.from('messages').insert([
    { conversation_id: conversationId, role: 'user', content: question },
    { conversation_id: conversationId, role: 'assistant', content: DUMMY_BODY },
  ]);

  if (insertError) {
    return { error: '메시지를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.' };
  }

  await touchConversation(admin, conversationId, question);

  revalidatePath(`/chat/${conversationId}`);
  revalidatePath('/chat', 'layout');
  return { error: null };
}

/**
 * 목록 정렬이 최근 수정순이므로 대화를 갱신해 맨 위로 올린다.
 * 아직 이름을 붙이지 않은 방이면 첫 질문에서 제목을 만든다.
 * PRD F-02 는 Haiku 로 12자 이내 제목을 생성하라고 하므로 Phase 3 에서 교체한다.
 */
async function touchConversation(
  admin: ReturnType<typeof createAdminClient>,
  conversationId: string,
  question: string
) {
  const patch: Record<string, string> = { updated_at: new Date().toISOString() };

  const { data: current } = await admin
    .from('conversations')
    .select('title')
    .eq('id', conversationId)
    .maybeSingle();

  if (current?.title === '새 대화') {
    patch.title = question.replace(/\s+/g, ' ').trim().slice(0, 30);
  }

  await admin.from('conversations').update(patch).eq('id', conversationId);
}
