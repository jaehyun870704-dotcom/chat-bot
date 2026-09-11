import 'server-only';

import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { supabaseAnonKey, supabaseUrl } from '@/lib/env';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * 로그인 여부만 알면 되는 곳에서 쓴다.
 *
 * 환경변수가 비었거나 Supabase 에 닿지 못하면 null 을 돌려준다.
 * 공개 페이지가 설정 문제로 500 이 되면 사용자는 원인을 알 수 없고,
 * 운영자도 로그를 봐야 안다. 무엇이 비었는지는 /api/health 가 알려 준다.
 */
export async function tryGetUser() {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data.user;
  } catch (err) {
    // Next.js 는 제어 흐름을 예외로 전달한다(동적 렌더 표시, redirect, notFound).
    // 이걸 삼키면 동적이어야 할 페이지가 로그아웃 상태로 정적 캐시되는 등
    // 조용히 잘못 동작한다. 우리 오류가 아니면 그대로 다시 던진다.
    if (isFrameworkControlFlow(err)) throw err;

    console.error('[supabase] 세션 확인 실패 — /api/health 를 확인하세요.', err);
    return null;
  }
}

/** Next.js 내부 제어 예외는 digest 문자열을 갖는다(DYNAMIC_SERVER_USAGE, NEXT_REDIRECT 등). */
function isFrameworkControlFlow(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'digest' in err &&
    typeof (err as { digest?: unknown }).digest === 'string'
  );
}

// 사용자 세션으로 동작하는 클라이언트. RLS 가 그대로 적용된다.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // 서버 컴포넌트에서는 쿠키를 쓸 수 없다. middleware 가 세션 갱신을 담당하므로 무시해도 된다.
        }
      },
    },
  });
}
