import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// 이메일 인증·비밀번호 재설정 링크가 돌아오는 지점.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');

  // 오픈 리다이렉트 방지: 같은 출처의 절대 경로만 허용한다.
  const requested = searchParams.get('next') ?? '/chat';
  const next = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/chat';

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
