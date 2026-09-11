import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

// 보호 경로. 미인증 사용자는 로그인으로 보낸다.
const PROTECTED_PREFIXES = ['/chat', '/account'];
const AUTH_PAGES = ['/login', '/signup'];

export async function middleware(request: NextRequest) {
  // 미들웨어는 모든 요청을 지나므로 여기서 던지면 사이트 전체가 500 이 된다.
  // 설정이 비어 있으면 세션 갱신만 건너뛰고 요청은 통과시킨다.
  // 보호는 페이지·RLS 단에서 다시 이루어지므로 데이터가 새지 않는다.
  // 무엇이 비었는지는 /api/health 가 알려 준다.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    console.error(
      '[middleware] Supabase 환경변수가 없어 세션 갱신을 건너뜁니다. /api/health 를 확인하세요.'
    );
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // getUser() 는 토큰을 서버에서 검증한다. getSession() 은 쿠키를 그대로 믿으므로 쓰지 않는다.
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (err) {
    // Supabase 에 닿지 못해도 사이트 전체를 500 으로 만들지 않는다.
    console.error('[middleware] 세션 확인 실패', err);
    return response;
  }

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p));

  if (isProtected && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (isAuthPage && user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/chat';
    redirectUrl.search = '';
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // 정적 자산과 진단 경로(/api/health)는 미들웨어를 타지 않는다.
    // 설정이 깨졌을 때 진단 경로만은 반드시 살아 있어야 한다.
    '/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
