import { NextResponse } from 'next/server';

// 설정 진단용. 어떤 환경변수가 비어 있는지 알려 준다.
//
// 값은 절대 돌려주지 않는다. 설정 여부와 접두사 몇 글자만 보여 준다.
// 배포가 500 으로만 끝나면 원인을 알 수 없어서, 그 상태를 대신 말해 주는 창구가 필요하다.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function describe(name: string, value: string | undefined, publicVar: boolean) {
  const trimmed = value?.trim();
  return {
    name,
    set: Boolean(trimmed),
    // 공개 변수만 앞 8자를 보여 준다. 서버 전용 키는 길이만.
    hint: trimmed ? (publicVar ? `${trimmed.slice(0, 8)}…` : `${trimmed.length}자`) : null,
  };
}

export async function GET() {
  // NEXT_PUBLIC_* 는 빌드 시점에 인라인되므로 반드시 전체 이름을 그대로 써야 한다.
  const required = [
    describe('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL, true),
    describe('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, true),
    describe('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY, false),
  ];

  const optional = [
    describe('NEXT_PUBLIC_SITE_URL', process.env.NEXT_PUBLIC_SITE_URL, true),
    describe('ANTHROPIC_API_KEY', process.env.ANTHROPIC_API_KEY, false),
    describe('BILLING_ENABLED', process.env.BILLING_ENABLED, true),
  ];

  const missing = required.filter((v) => !v.set).map((v) => v.name);

  return NextResponse.json(
    {
      ok: missing.length === 0,
      missing,
      required,
      optional,
      mode: process.env.ANTHROPIC_API_KEY?.trim() ? '생성 모드' : '검색 전용 모드',
      billing: process.env.BILLING_ENABLED?.trim().toLowerCase() === 'true' ? '켜짐' : '꺼짐',
      hint:
        missing.length > 0
          ? 'Vercel → Settings → Environment Variables 에 등록한 뒤 반드시 재배포하세요. NEXT_PUBLIC_* 은 빌드 시점에 값이 박히므로 변수를 추가만 하고 재배포하지 않으면 반영되지 않습니다.'
          : null,
    },
    { status: missing.length === 0 ? 200 : 503 }
  );
}
