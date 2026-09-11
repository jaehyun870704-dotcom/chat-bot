'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { siteUrl } from '@/lib/env';

export type AuthState = { error: string | null; notice: string | null };

// Supabase 오류를 사용자가 무엇을 해야 하는지 알 수 있는 문장으로 바꾼다.
//
// 원문을 그대로 노출하지 않는 이유는 계정 존재 여부가 드러나지 않게 하기 위함이다.
// 다만 전부 "문제가 발생했습니다"로 뭉뚱그리면 사용자도 운영자도 원인을 알 수 없다.
// 실제로 막히는 경우들을 구분해 안내하고, 원인 코드는 서버 로그에만 남긴다.
function friendlyError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code ?? '')
    : '';
  const m = raw.toLowerCase();

  // 원인은 서버 로그로만 남긴다. 사용자 화면에는 내보내지 않는다(PRD §9.2).
  console.error('[auth]', code || '(no code)', raw);

  // 설정 누락은 사용자 잘못이 아니다.
  if (m.includes('환경변수')) {
    return '서버 설정이 완료되지 않았습니다. 잠시 후 다시 시도해 주세요. (관리자: /api/health 확인)';
  }

  // 이메일 발송 한도. Supabase 기본 메일 서비스는 시간당 몇 통으로 제한된다.
  // 운영에서는 커스텀 SMTP 를 붙여야 한다.
  if (code === 'over_email_send_rate_limit' || m.includes('email rate limit')) {
    return '인증 메일 발송 한도에 걸렸습니다. 잠시 후 다시 시도해 주세요. 계속 반복되면 관리자에게 알려 주세요.';
  }
  if (m.includes('error sending') || m.includes('smtp')) {
    return '인증 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.';
  }

  // 메일 서버가 받아주지 않는 주소. 오타이거나 실제로 없는 도메인이다.
  if (code === 'email_address_invalid' || m.includes('is invalid')) {
    return '사용할 수 없는 이메일 주소입니다. 실제로 메일을 받을 수 있는 주소인지 확인해 주세요.';
  }

  if (code === 'user_already_exists' || m.includes('already registered')) {
    return '이미 가입된 이메일입니다. 로그인해 주세요.';
  }
  if (m.includes('invalid login credentials')) return '이메일 또는 비밀번호가 올바르지 않습니다.';
  if (m.includes('email not confirmed')) return '이메일 인증을 먼저 완료해 주세요.';
  if (code === 'weak_password' || m.includes('password')) {
    return '비밀번호는 8자 이상이어야 합니다.';
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.';
  }

  return '처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.';
}

function readCredentials(formData: FormData): { email: string; password: string } | null {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return null;
  return { email, password };
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const creds = readCredentials(formData);
  if (!creds) return { error: '이메일과 비밀번호를 모두 입력해 주세요.', notice: null };
  if (creds.password.length < 8) {
    return { error: '비밀번호는 8자 이상이어야 합니다.', notice: null };
  }

  let signedIn = false;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: creds.email,
      password: creds.password,
      options: { emailRedirectTo: `${siteUrl()}/auth/callback` },
    });

    if (error) return { error: friendlyError(error), notice: null };

    // Supabase 의 '이메일 확인'이 꺼져 있으면 가입과 동시에 세션이 발급된다.
    // 이때는 인증 메일을 기다리게 하지 않고 바로 들여보낸다.
    signedIn = Boolean(data.session);
  } catch (err) {
    return { error: friendlyError(err), notice: null };
  }

  if (signedIn) {
    // redirect() 는 내부적으로 예외를 던지므로 try 밖에서 호출한다.
    revalidatePath('/', 'layout');
    redirect('/chat');
  }

  return {
    error: null,
    notice: '인증 메일을 보냈습니다. 메일의 링크를 눌러 가입을 완료해 주세요.',
  };
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const creds = readCredentials(formData);
  if (!creds) return { error: '이메일과 비밀번호를 모두 입력해 주세요.', notice: null };

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(creds);
    if (error) return { error: friendlyError(error), notice: null };
  } catch (err) {
    return { error: friendlyError(err), notice: null };
  }

  // redirect() 는 내부적으로 예외를 던지므로 try 밖에 둔다.
  revalidatePath('/', 'layout');
  redirect('/chat');
}

export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) return { error: '이메일을 입력해 주세요.', notice: null };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/callback?next=/account`,
  });

  // 계정 존재 여부가 드러나지 않도록 결과와 무관하게 같은 안내를 보낸다.
  return {
    error: null,
    notice: '해당 이메일로 가입된 계정이 있다면 재설정 메일을 보냈습니다.',
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}
