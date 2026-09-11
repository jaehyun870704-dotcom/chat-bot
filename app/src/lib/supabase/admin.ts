import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, requiredEnv } from '@/lib/env';

// service_role 키는 이 모듈에서만 읽는다. 'server-only' 가 클라이언트 import 를 막는다.
function serviceRoleKey(): string {
  return requiredEnv('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// RLS 를 우회하는 서버 전용 클라이언트.
// 사용자 입력으로 대상 행을 고르지 말고, 항상 인증된 user.id 로 범위를 좁혀서 쓴다.
export function createAdminClient() {
  return createSupabaseClient(SUPABASE_URL, serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
