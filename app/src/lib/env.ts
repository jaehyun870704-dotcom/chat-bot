// 서버 전용 값과 공개 값을 한 곳에서 검증한다.
// PRD §4 금지: 클라이언트 번들에 Anthropic·service role 키가 들어가면 안 된다.

function required(name: string, value: string | undefined): string {
  if (!value || !value.trim()) {
    throw new Error(`환경변수 ${name} 가 설정되지 않았습니다. app/.env.local 을 확인하세요.`);
  }
  return value.trim();
}

// 공개 값 — 클라이언트 번들에 포함된다.
export const SUPABASE_URL = required(
  'NEXT_PUBLIC_SUPABASE_URL',
  process.env.NEXT_PUBLIC_SUPABASE_URL
);
export const SUPABASE_ANON_KEY = required(
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'http://localhost:3000';

// 서버 전용 값은 이 파일에 두지 않는다.
// 이 모듈은 'use client' 컴포넌트도 import 하므로, 여기에 두면 번들 경계가 느슨해진다.
// SUPABASE_SERVICE_ROLE_KEY 와 ANTHROPIC_API_KEY 는 'server-only' 를 선언한 모듈에서만 읽는다.
export { required as requiredEnv };
