import 'server-only';

import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

// 사용자 세션으로 동작하는 클라이언트. RLS 가 그대로 적용된다.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
