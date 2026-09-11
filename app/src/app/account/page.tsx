import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/(auth)/actions';

// PRD F-07 마이페이지. 결제·해지는 Phase 4(D-01 확정 후)에 붙인다.
// 지금은 RLS 로 읽히는 현재 상태만 보여준다.
export default async function AccountPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, free_questions_used, created_at')
    .maybeSingle();
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, status, current_period_end')
    .eq('status', 'active')
    .maybeSingle();
  const { data: balance } = await supabase
    .from('token_balances')
    .select('granted_tokens, topup_tokens, used_tokens, period_end')
    .maybeSingle();

  const remaining = balance
    ? Number(balance.granted_tokens) + Number(balance.topup_tokens) - Number(balance.used_tokens)
    : 0;

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">마이페이지</h1>
        <Link href="/chat" className="text-sm text-neutral-500 hover:underline">
          대화로 돌아가기
        </Link>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-neutral-500">계정</h2>
        <dl className="divide-y divide-neutral-200 rounded-md border border-neutral-200 text-sm">
          <Row label="이메일" value={profile?.email ?? user?.email ?? '—'} />
          <Row label="무료 질문 사용" value={`${profile?.free_questions_used ?? 0} / 3회`} />
        </dl>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-neutral-500">구독</h2>
        <dl className="divide-y divide-neutral-200 rounded-md border border-neutral-200 text-sm">
          <Row label="상태" value={subscription ? `${subscription.plan} (${subscription.status})` : '구독 없음'} />
          <Row
            label="다음 결제일"
            value={
              subscription?.current_period_end
                ? new Date(subscription.current_period_end).toLocaleDateString('ko-KR')
                : '—'
            }
          />
          <Row label="잔여 토큰" value={remaining > 0 ? remaining.toLocaleString('ko-KR') : '—'} />
        </dl>
        <p className="text-xs text-neutral-500">
          결제·충전·해지는 결제 사업자(D-01) 확정 후 Phase 4 에서 연결됩니다.
        </p>
      </section>

      <form action={signOut}>
        <button
          type="submit"
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
        >
          로그아웃
        </button>
      </form>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between px-3 py-2">
      <dt className="text-neutral-600">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
