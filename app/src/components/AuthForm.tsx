'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import type { AuthState } from '@/app/(auth)/actions';

const INITIAL: AuthState = { error: null, notice: null };

type Props = {
  title: string;
  submitLabel: string;
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
  footer: React.ReactNode;
  withPassword?: boolean;
  passwordHint?: string;
};

export function AuthForm({
  title,
  submitLabel,
  action,
  footer,
  withPassword = true,
  passwordHint,
}: Props) {
  const [state, formAction, pending] = useActionState(action, INITIAL);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-16">
      <Link href="/" className="text-sm text-neutral-500 hover:text-brand">
        ← 좋은인재연구소
      </Link>
      <h1 className="text-2xl font-bold">{title}</h1>

      <form action={formAction} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">이메일</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-accent"
          />
        </label>

        {withPassword && (
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">비밀번호</span>
            <input
              type="password"
              name="password"
              required
              minLength={8}
              autoComplete={submitLabel === '로그인' ? 'current-password' : 'new-password'}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-accent"
            />
            {passwordHint && <span className="text-xs text-neutral-500">{passwordHint}</span>}
          </label>
        )}

        {state.error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}
        {state.notice && (
          <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
            {state.notice}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {pending ? '처리 중…' : submitLabel}
        </button>
      </form>

      <div className="text-sm text-neutral-600">{footer}</div>
    </main>
  );
}
