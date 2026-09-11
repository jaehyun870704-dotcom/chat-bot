import Link from 'next/link';
import { AuthForm } from '@/components/AuthForm';
import { signUp } from '@/app/(auth)/actions';

export default function SignupPage() {
  return (
    <AuthForm
      title="가입하기"
      subtitle="이메일만 있으면 바로 시작할 수 있습니다."
      submitLabel="가입하고 질문 시작하기"
      action={signUp}
      autoComplete="new-password"
      passwordHint="8자 이상"
      footer={
        <p>
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            로그인
          </Link>
        </p>
      }
    />
  );
}
