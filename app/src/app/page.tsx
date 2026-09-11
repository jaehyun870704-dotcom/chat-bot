import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <div className="space-y-4">
        <p className="text-sm font-medium text-brand-accent">좋은인재연구소</p>
        <h1 className="text-3xl font-bold leading-snug">
          노동법·인사 실무 질문에
          <br />
          판례와 행정해석 근거를 붙여 답합니다.
        </h1>
        <p className="text-base leading-relaxed text-neutral-600">
          판례·행정해석·지침·산재심사 재결례·상담사례 <strong>29만 8천여 건</strong>의 자료를 검색해
          근거와 함께 정리해 드립니다. 범용 AI가 지어낸 답이 아니라, 실제 자료에 근거한 답입니다.
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm leading-relaxed text-neutral-600">
        이 서비스는 자료를 검색해 정리한 <strong>정보 제공용 안내</strong>를 제공하며, 법률 자문이나
        노무 상담이 아닙니다.
      </div>

      <div className="flex gap-3">
        {user ? (
          <Link
            href="/chat"
            className="rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
          >
            대화 이어가기
          </Link>
        ) : (
          <>
            <Link
              href="/signup"
              className="rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
            >
              무료로 3번 질문하기
            </Link>
            <Link
              href="/login"
              className="rounded-md border border-neutral-300 px-5 py-2.5 text-sm font-medium hover:bg-neutral-50"
            >
              로그인
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
