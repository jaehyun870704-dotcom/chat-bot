import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { BrandMark } from '@/components/BrandMark';
import { Icon } from '@/components/Icon';

const FEATURES = [
  {
    icon: 'search',
    title: '실제 자료에서 찾습니다',
    body: '판례·행정해석·지침·산재재결례·상담사례 29만 8천여 건을 검색해 질문과 가장 가까운 근거를 제시합니다.',
  },
  {
    icon: 'verified',
    title: '없는 것은 없다고 씁니다',
    body: '자료에서 확인되지 않는 법조문이나 사건번호를 지어내지 않습니다. 확인할 수 없으면 그렇게 밝힙니다.',
  },
  {
    icon: 'format_quote',
    title: '근거를 함께 보여 줍니다',
    body: '답변마다 인용한 자료의 출처·원문 발췌·유사도를 펼쳐 볼 수 있습니다.',
  },
];

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <header className="pt-safe sticky top-0 z-40 border-b border-outline-variant/40 bg-surface/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-margin">
          <div className="flex items-center gap-space-sm">
            <BrandMark size={32} />
            <span className="text-label-md font-semibold text-on-surface">좋은인재연구소</span>
          </div>
          <Link
            href={user ? '/chat' : '/login'}
            className="rounded-full px-3.5 py-2 text-label-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container"
          >
            {user ? '대화로 이동' : '로그인'}
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-space-xl px-margin py-space-xl">
        <section className="flex flex-col gap-space-lg pt-space-lg">
          <span className="flex w-fit items-center gap-1.5 rounded-full bg-surface-container-high px-3 py-1.5 text-caption font-medium text-on-primary-fixed">
            <Icon name="bolt" size={13} />
            노동법·인사 실무 특화
          </span>

          <h1 className="break-keep-ko text-display-sm text-on-surface">
            노무 질문에
            <br />
            <span className="text-primary">판례와 행정해석</span>을 붙여
            <br />
            답해 드립니다.
          </h1>

          <p className="break-keep-ko text-body-lg leading-relaxed text-on-surface-variant">
            검색하면 출처 불명 블로그가 나오고, 노무사 상담은 건당 비용과 시간이 듭니다. 실제
            자료에 근거해 정리된 답을 바로 확인하세요.
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

        <section className="flex flex-col gap-2">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="flex items-start gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-on-primary-fixed">
                <Icon name={f.icon} size={18} />
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <h2 className="text-label-md font-semibold text-on-surface">{f.title}</h2>
                <p className="break-keep-ko text-body-sm leading-relaxed text-on-surface-variant">
                  {f.body}
                </p>
              </div>
            </div>
          ))}
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
