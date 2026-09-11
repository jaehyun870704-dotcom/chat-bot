import Link from 'next/link';
import { tryGetUser } from '@/lib/supabase/server';
import { BrandLockup } from '@/components/BrandMark';
import { Icon } from '@/components/Icon';

// 보유 자료 규모. 강점이 곧 숫자이므로 앞에 내세운다. (2026-09-11 실측)
const CORPUS = [
  { icon: 'gavel', label: '판례', value: '23.6만' },
  { icon: 'description', label: '행정해석', value: '4.1만' },
  { icon: 'balance', label: '행정심판', value: '1.1만' },
  { icon: 'health_and_safety', label: '산재 재결례', value: '7,116' },
];

// 일반 검색과 무엇이 다른지. 추상적인 형용사 대신 대비로 보여 준다.
const COMPARISON = [
  {
    icon: 'travel_explore',
    common: '검색하면 출처 불명 블로그가 먼저 나온다',
    ours: '실제 판례·행정해석 원문에서 찾습니다',
  },
  {
    icon: 'psychology_alt',
    common: 'AI가 그럴듯한 사건번호를 지어낸다',
    ours: '자료에 없으면 없다고 씁니다',
  },
  {
    icon: 'fact_check',
    common: '근거를 확인하려면 다시 찾아봐야 한다',
    ours: '출처와 원문 발췌를 함께 보여 줍니다',
  },
];

export default async function LandingPage() {
  // 공개 진입점이므로 설정이 비어 있어도 500 을 내지 않는다. 로그아웃 상태로 그린다.
  const user = await tryGetUser();

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <header className="pt-safe sticky top-0 z-40 bg-surface/85 shadow-header backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-margin">
          <BrandLockup size={30} />
          <Link
            href={user ? '/chat' : '/login'}
            className="rounded-full px-3.5 py-2 text-label-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container"
          >
            {user ? '대화로 이동' : '로그인'}
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-space-xl px-margin py-space-xl">
        {/* 히어로 */}
        <section className="flex flex-col gap-space-lg pt-space-lg">
          <span className="flex w-fit items-center gap-1.5 rounded-full bg-surface-container-high px-3 py-1.5 text-caption font-medium text-on-primary-fixed">
            <Icon name="database" size={13} />
            실제 자료 29만 8천 건
          </span>

          <h1 className="break-keep-ko text-display-sm text-on-surface">
            물어볼 사람이 없을 때,
            <br />
            <span className="text-primary">근거까지 찾아</span> 드립니다.
          </h1>

          <p className="break-keep-ko text-body-lg leading-relaxed text-on-surface-variant">
            인사 실무에서 막히는 순간은 대부분 &ldquo;이게 맞나?&rdquo;를 확인할 곳이 없을 때입니다.
            보유한 자료에서 직접 찾아, 무엇을 근거로 그렇게 말하는지까지 함께 보여 드립니다.
          </p>

          <div className="flex flex-wrap gap-2">
            {user ? (
              <Link
                href="/chat"
                className="flex items-center gap-1.5 rounded-full bg-primary px-space-xl py-3 text-label-md font-medium text-on-primary shadow-md transition-all hover:opacity-95 active:scale-[0.98]"
              >
                대화 이어가기
                <Icon name="arrow_forward" size={18} />
              </Link>
            ) : (
              <>
                <Link
                  href="/signup"
                  className="flex items-center gap-1.5 rounded-full bg-primary px-space-xl py-3 text-label-md font-medium text-on-primary shadow-md transition-all hover:opacity-95 active:scale-[0.98]"
                >
                  무료로 시작하기
                  <Icon name="arrow_forward" size={18} />
                </Link>
                <Link
                  href="/login"
                  className="rounded-full border border-outline-variant px-space-xl py-3 text-label-md font-medium text-on-surface transition-colors hover:bg-surface-container"
                >
                  로그인
                </Link>
              </>
            )}
          </div>
        </section>

        {/* 자료 규모 — 강점의 근거 */}
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-label-sm font-semibold text-on-surface-variant">
            무엇을 근거로 답하나요
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CORPUS.map((c) => (
              <div
                key={c.label}
                className="flex flex-col items-start gap-1 rounded-xl bg-surface-container-lowest p-space-md shadow-sm"
              >
                <Icon name={c.icon} size={18} className="text-primary" />
                <span className="text-headline-sm tabular-nums text-on-surface">{c.value}</span>
                <span className="text-caption text-on-surface-variant">{c.label}</span>
              </div>
            ))}
          </div>
          <p className="px-1 text-caption leading-relaxed text-on-surface-variant">
            여기에 지침·상담사례까지 더해 모두 29만 8천여 건입니다. 답변마다 어떤 자료를
            근거로 삼았는지 펼쳐 볼 수 있습니다.
          </p>
        </section>

        {/* 대비 — 일반 검색과 무엇이 다른가 */}
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-label-sm font-semibold text-on-surface-variant">
            이런 점이 다릅니다
          </h2>
          <div className="flex flex-col gap-2">
            {COMPARISON.map((c) => (
              <div
                key={c.ours}
                className="flex items-start gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-on-primary-fixed">
                  <Icon name={c.icon} size={18} />
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="break-keep-ko flex items-start gap-1.5 text-body-sm leading-relaxed text-outline line-through decoration-outline-variant">
                    {c.common}
                  </p>
                  <p className="break-keep-ko flex items-start gap-1.5 text-body-md font-medium leading-relaxed text-on-surface">
                    <Icon name="check" size={16} className="mt-1 shrink-0 text-primary" />
                    {c.ours}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* PRD §7: 서비스 성격을 '상담'이 아닌 '자료 검색·정보 제공'으로 표기한다(D-06). */}
        <section className="flex items-start gap-1.5 rounded-xl bg-surface-container-low p-space-lg">
          <Icon name="info" size={16} className="mt-0.5 shrink-0 text-on-surface-variant" />
          <p className="break-keep-ko text-body-sm leading-relaxed text-on-surface-variant">
            이 서비스는 보유 자료를 검색해 정리한{' '}
            <strong className="font-semibold text-on-surface">정보 제공용 안내</strong>를
            제공하며, 법률 자문이나 노무 상담이 아닙니다. 실제 사건 적용 시에는 반드시 전문가의
            검토가 필요합니다.
          </p>
        </section>
      </main>

      <footer className="border-t border-outline-variant/40 px-margin py-space-lg">
        <p className="mx-auto max-w-3xl text-caption text-on-surface-variant">
          좋은인재연구소(GTI) · goodhr.kr
        </p>
      </footer>
    </div>
  );
}
