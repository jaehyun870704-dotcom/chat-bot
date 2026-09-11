// 서버 전용 값과 공개 값을 한 곳에서 검증한다.
// PRD §4 금지: 클라이언트 번들에 Anthropic·service role 키가 들어가면 안 된다.
//
// 값은 모듈을 불러올 때가 아니라 실제로 쓸 때 검증한다.
// 최상위에서 throw 하면 환경변수가 없는 빌드 환경(예: Vercel 첫 배포)에서
// 정적 페이지 생성 단계가 통째로 깨지고, 진짜 원인이 스택트레이스에 묻힌다.

export function requiredEnv(name: string, value: string | undefined): string {
  if (!value || !value.trim()) {
    throw new Error(
      `환경변수 ${name} 가 설정되지 않았습니다. 로컬은 app/.env.local, 배포는 Vercel 프로젝트 설정을 확인하세요.`
    );
  }
  return value.trim();
}

// 공개 값 — 클라이언트 번들에 포함된다.
// process.env.NEXT_PUBLIC_* 는 빌드 시 인라인되므로 반드시 전체 이름을 그대로 써야 한다.
export function supabaseUrl(): string {
  return requiredEnv('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function supabaseAnonKey(): string {
  return requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

// 이메일 인증 링크가 돌아올 주소.
// Vercel 은 배포 도메인을 VERCEL_URL 로 주지만 프리뷰마다 바뀌므로,
// 운영 도메인을 NEXT_PUBLIC_SITE_URL 로 명시하는 쪽을 우선한다.
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');

  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;

  return 'http://localhost:3000';
}
