import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createConversation } from './actions';
import { signOut } from '@/app/(auth)/actions';
import { ConversationList } from '@/components/ConversationList';

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  // 목록은 최근 수정순. deleted_at 이 있는 방은 제외한다(F-02).
  const { data: conversations } = await supabase
    .from('conversations')
    .select('id, title, updated_at')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('free_questions_used')
    .maybeSingle();

  return (
    <div className="flex h-screen">
      <aside className="flex w-64 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50">
        <div className="border-b border-neutral-200 p-3">
          <Link href="/" className="text-sm font-semibold">
            좋은인재연구소
          </Link>
        </div>

        <form action={createConversation} className="p-3">
          <button
            type="submit"
            className="w-full rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            + 새 대화
          </button>
        </form>

        <ConversationList conversations={conversations ?? []} />

        <div className="space-y-2 border-t border-neutral-200 p-3 text-xs text-neutral-500">
          <p className="truncate">{user?.email}</p>
          <p>무료 질문 {profile?.free_questions_used ?? 0} / 3회 사용</p>
          <div className="flex gap-2">
            <Link href="/account" className="hover:underline">
              마이페이지
            </Link>
            <form action={signOut}>
              <button type="submit" className="hover:underline">
                로그아웃
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
