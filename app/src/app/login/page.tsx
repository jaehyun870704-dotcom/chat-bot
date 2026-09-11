import Link from 'next/link';
import { AuthForm } from '@/components/AuthForm';
import { signIn } from '@/app/(auth)/actions';

export default function LoginPage() {
  return (
    <AuthForm
      title="다시 오셨네요"
      subtitle="찾아두신 근거를 이어서 확인하세요."
      submitLabel="로그인"
      action={signIn}
      autoComplete="current-password"
      footer={
        <div className="flex flex-col gap-1.5">
          <p>
            계정이 없으신가요?{' '}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              가입하기
            </Link>
          </p>
          <p>
            <Link href="/reset-password" className="text-on-surface-variant hover:underline">
              비밀번호를 잊으셨나요?
            </Link>
          </p>
        </div>
      }
    />
  );
}
