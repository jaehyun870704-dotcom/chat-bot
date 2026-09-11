import Link from 'next/link';
import { AuthForm } from '@/components/AuthForm';
import { signUp } from '@/app/(auth)/actions';

export default function SignupPage() {
  return (
    <AuthForm
      title="가입하기"
      submitLabel="가입하고 무료로 3번 질문하기"
      action={signUp}
      passwordHint="8자 이상"
      footer={
        <p>
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="font-medium text-brand-accent hover:underline">
            로그인
          </Link>
        </p>
      }
    />
  );
}
