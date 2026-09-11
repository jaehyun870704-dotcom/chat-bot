import Link from 'next/link';
import { AuthForm } from '@/components/AuthForm';
import { signIn } from '@/app/(auth)/actions';

export default function LoginPage() {
  return (
    <AuthForm
      title="로그인"
      submitLabel="로그인"
      action={signIn}
      footer={
        <div className="space-y-1">
          <p>
            계정이 없으신가요?{' '}
            <Link href="/signup" className="font-medium text-brand-accent hover:underline">
              가입하기
            </Link>
          </p>
          <p>
            <Link href="/reset-password" className="text-neutral-500 hover:underline">
              비밀번호를 잊으셨나요?
            </Link>
          </p>
        </div>
      }
    />
  );
}
