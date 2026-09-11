'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import type { AuthState } from '@/app/(auth)/actions';
import { BrandMark } from './BrandMark';
import { Icon } from './Icon';

const INITIAL: AuthState = { error: null, notice: null };

type Props = {
  title: string;
  subtitle: string;
  submitLabel: string;
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
  footer: React.ReactNode;
  withPassword?: boolean;
  passwordHint?: string;
  autoComplete?: 'current-password' | 'new-password';
};

export function AuthForm({
  title,
  subtitle,
  submitLabel,
  action,
  footer,
  withPassword = true,
  passwordHint,
  autoComplete = 'current-password',
}: Props) {
  const [state, formAction, pending] = useActionState(action, INITIAL);

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-margin py-space-xl">
      <div className="flex w-full max-w-sm flex-col gap-space-xl">
        <Link
          href="/"
          className="flex w-fit items-center gap-1.5 text-caption text-on-surface-variant transition-colors hover:text-on-surface"
        >
          <Icon name="arrow_back" size={16} />
          좋은인재연구소
        </Link>

        <div className="flex flex-col items-center gap-space-md text-center">
          <BrandMark size={48} className="shadow-md" />
          <div className="flex flex-col gap-1">
            <h1 className="text-headline-md text-on-surface">{title}</h1>
            <p className="break-keep-ko text-body-sm text-on-surface-variant">{subtitle}</p>
          </div>
        </div>

        <form
          action={formAction}
          className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-md"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-label-sm font-medium text-on-surface">이메일</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="name@company.com"
              className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-body-md text-on-surface outline-none transition-colors placeholder:text-outline/60 focus:border-primary"
            />
          </label>

          {withPassword && (
            <label className="flex flex-col gap-1.5">
              <span className="text-label-sm font-medium text-on-surface">비밀번호</span>
              <input
                type="password"
                name="password"
                required
                minLength={8}
                autoComplete={autoComplete}
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-body-md text-on-surface outline-none transition-colors focus:border-primary"
              />
              {passwordHint && (
                <span className="text-caption text-on-surface-variant">{passwordHint}</span>
              )}
            </label>
          )}

          {state.error && (
            <p
              role="alert"
              className="flex items-start gap-1.5 rounded-lg bg-error-container px-3 py-2 text-body-sm text-on-error-container"
            >
              <Icon name="error" size={16} className="mt-px shrink-0" />
              {state.error}
            </p>
          )}

          {state.notice && (
            <p
              role="status"
              className="flex items-start gap-1.5 rounded-lg bg-surface-container px-3 py-2 text-body-sm text-on-surface"
            >
              <Icon name="mark_email_read" size={16} className="mt-px shrink-0 text-primary" />
              {state.notice}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-1 w-full rounded-full bg-primary px-space-lg py-3 text-label-md font-medium text-on-primary shadow-sm transition-all hover:opacity-95 active:scale-[0.98] disabled:opacity-50"
          >
            {pending ? '처리 중…' : submitLabel}
          </button>
        </form>

        <div className="text-center text-body-sm text-on-surface-variant">{footer}</div>
      </div>
    </main>
  );
}
