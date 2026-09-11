'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { siteUrl } from '@/lib/env';

export type AuthState = { error: string | null; notice: string | null };

// Supabase 가 돌려주는 오류 메시지를 그대로 노출하지 않는다.
// 계정 존재 여부가 드러나지 않도록 일반화한다.
function friendlyError(message: string): string {
  const m = message.toLowerCase();
  // 설정 누락은 사용자 잘못이 아니다. 운영자가 볼 수 있게 구분해 안내한다.
  if (m.includes('환경변수')) {
    return '서버 설정이 완료되지 않았습니다. 잠시 후 다시 시도해 주세요. (관리자: /api/health 확인)';
  }
  if (m.includes('invalid login credentials')) return '이메일 또는 비밀번호가 올바르지 않습니다.';
  if (m.includes('email not confirmed')) return '이메일 인증을 먼저 완료해 주세요.';
  if (m.includes('password')) return '비밀번호는 8자 이상이어야 합니다.';
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

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signUp({
      email: creds.email,
      password: creds.password,
      options: { emailRedirectTo: `${siteUrl()}/auth/callback` },
    });

    if (error) return { error: friendlyError(error.message), notice: null };
  } catch (err) {
    return { error: friendlyError((err as Error).message), notice: null };
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
    if (error) return { error: friendlyError(error.message), notice: null };
  } catch (err) {
    return { error: friendlyError((err as Error).message), notice: null };
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
