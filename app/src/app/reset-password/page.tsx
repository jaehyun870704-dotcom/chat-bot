import Link from 'next/link';
import { AuthForm } from '@/components/AuthForm';
import { requestPasswordReset } from '@/app/(auth)/actions';

export default function ResetPasswordPage() {
  return (
    <AuthForm
      title="비밀번호 재설정"
      subtitle="가입하신 이메일로 재설정 링크를 보내 드립니다."
      submitLabel="재설정 메일 받기"
      action={requestPasswordReset}
      withPassword={false}
      footer={
        <p>
          <Link href="/login" className="text-on-surface-variant hover:underline">
            로그인으로 돌아가기
          </Link>
        </p>
      }
    />
  );
}
