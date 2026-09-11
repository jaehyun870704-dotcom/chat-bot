import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, tryGetUser } from '@/lib/supabase/server';
import { signOut } from '@/app/(auth)/actions';
import { isBillingEnabled } from '@/lib/billing/gate';
import { Icon } from '@/components/Icon';
import { BrandMark } from '@/components/BrandMark';

// PRD F-07 마이페이지. 결제·해지는 Phase 4(D-01 확정 후)에 붙인다.
export default async function AccountPage() {
  const user = await tryGetUser();
  if (!user) redirect('/login');

  const supabase = await createClient();

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
    .select('granted_tokens, topup_tokens, used_tokens')
    .maybeSingle();

  const billing = isBillingEnabled();
  const used = profile?.free_questions_used ?? 0;
  const remaining = balance
    ? Number(balance.granted_tokens) + Number(balance.topup_tokens) - Number(balance.used_tokens)
    : 0;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-surface">
      <header className="pt-safe sticky top-0 z-40 border-b border-outline-variant bg-surface">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-space-sm px-space-sm">
          <Link
            href="/chat"
            aria-label="대화로 돌아가기"
            className="flex h-11 w-11 items-center justify-center rounded-full text-on-surface transition-colors hover:bg-surface-container"
          >
            <Icon name="arrow_back" />
          </Link>
          <h1 className="text-headline-sm text-on-surface">마이페이지</h1>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-space-xl px-margin py-space-xl">
        <section className="flex items-center gap-space-md rounded-xl bg-surface-container-low p-space-lg">
          <BrandMark size={40} className="text-on-surface" title="좋은인재연구소" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-label-md font-semibold text-on-surface">
              {profile?.email ?? user?.email ?? '—'}
            </span>
            <span className="text-caption text-on-surface-variant">
              {billing ? `무료 질문 ${used} / 3회 사용` : `질문 ${used}회 이용`}
            </span>
          </div>
        </section>

        {!billing && (
          <section className="flex items-start gap-1.5 rounded-xl bg-accent p-space-lg">
            <Icon name="celebration" size={18} className="mt-px shrink-0 text-on-accent" />
            <div className="flex flex-col gap-0.5">
              <p className="text-label-md font-semibold text-on-accent">무료 이용 기간</p>
              <p className="break-keep-ko text-body-sm leading-relaxed text-on-accent/80">
                질문 횟수에 제한이 없습니다. 결제는 준비되는 대로 안내드립니다.
              </p>
            </div>
          </section>
        )}

        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-label-sm font-semibold text-on-surface-variant">구독</h2>
          <dl className="overflow-hidden rounded-xl border border-outline-variant bg-surface">
            <Row
              label="상태"
              value={
                subscription
                  ? `${subscription.plan} (${subscription.status})`
                  : billing
                    ? '구독 없음'
                    : '무료 이용 기간'
              }
            />
            <Row
              label="다음 결제일"
              value={
                subscription?.current_period_end
                  ? new Date(subscription.current_period_end).toLocaleDateString('ko-KR')
                  : '—'
              }
            />
            <Row
              label="잔여 토큰"
              value={remaining > 0 ? remaining.toLocaleString('ko-KR') : '—'}
              last
            />
          </dl>
          <p className="px-1 text-caption leading-relaxed text-on-surface-variant">
            결제·충전·해지는 결제 사업자 확정 후 연결됩니다.
          </p>
        </section>

        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-1.5 rounded-full border border-outline-variant px-space-lg py-3 text-label-md font-medium text-on-surface transition-colors hover:bg-surface-container"
          >
            <Icon name="logout" size={18} />
            로그아웃
          </button>
        </form>
      </main>
    </div>
  );
}

function Row({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between gap-space-md px-space-lg py-space-md ${
        last ? '' : 'border-b border-outline-variant/30'
      }`}
    >
      <dt className="text-body-sm text-on-surface-variant">{label}</dt>
      <dd className="text-label-md font-medium text-on-surface">{value}</dd>
    </div>
  );
}
