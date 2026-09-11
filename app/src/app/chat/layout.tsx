import { redirect } from 'next/navigation';
import { createClient, tryGetUser } from '@/lib/supabase/server';
import { createConversation } from './actions';
import { signOut } from '@/app/(auth)/actions';
import { isBillingEnabled } from '@/lib/billing/gate';
import { isConfigured } from '@/lib/llm/client';
import { ChatShell } from '@/components/ChatShell';

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  // 미들웨어가 설정 문제로 통과시켰을 수 있으므로 여기서 다시 확인한다.
  const user = await tryGetUser();
  if (!user) redirect('/login');

  const supabase = await createClient();

  // 목록은 최근 수정순. deleted_at 이 있는 방은 제외한다(F-02).
  const { data: conversations } = await supabase
    .from('conversations')
    .select('id, title, updated_at')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  const { data: profile } = await supabase
    .from('profiles')
    .select('free_questions_used')
    .maybeSingle();

  const used = profile?.free_questions_used ?? 0;

  return (
    <ChatShell
      conversations={conversations ?? []}
      email={user?.email ?? ''}
      usageLabel={
        isBillingEnabled() ? `무료 질문 ${used} / 3회 사용` : `질문 ${used}회 · 무료 이용 기간`
      }
      // 목업의 모델 배지 자리. 지금 어떤 모드로 답하는지 그대로 보여 준다.
      modeLabel={isConfigured() ? 'Sonnet 5' : '검색 전용'}
      createConversation={createConversation}
      signOut={signOut}
    >
      {children}
    </ChatShell>
  );
}
