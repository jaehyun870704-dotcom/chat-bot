import type { Config } from 'tailwindcss';

// PRD §9.4: 기본 톤은 흑백 + 포인트 컬러 1색.
// 로고 파일 수령 후 brand 값을 실제 브랜드 컬러로 교체한다.
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1a1a1a',
          accent: '#2f6f4e',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
