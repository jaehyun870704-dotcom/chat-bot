import type { Metadata } from 'next';
import './globals.css';

// D-04(서비스명·도메인) 미결. 확정 전까지 제공 주체명을 그대로 쓴다.
export const metadata: Metadata = {
  title: '좋은인재연구소 노동법·HR 상담',
  description:
    '노동법·인사 실무 질문에 판례·행정해석·상담사례 근거를 붙여 답하는 정보 제공 도구입니다.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
