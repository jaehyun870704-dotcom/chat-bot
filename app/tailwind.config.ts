import type { Config } from 'tailwindcss';

// 디자인 토큰 — 카카오 계열 팔레트.
//
// 바깥 캔버스는 노랑, 콘텐츠는 흰 면, 글자와 버튼은 먹색이다.
// 좋은인재연구소 로고가 검정 라인아트라 노랑·검정 조합이 로고와도 맞는다.
//
// 컴포넌트는 모두 의미 토큰(bg-surface, text-on-surface …)만 쓰므로
// 색을 바꾸려면 이 파일만 고치면 된다.

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 브랜드 노랑. 강조·아바타·사용자 말풍선에만 쓴다.
        accent: '#FEE500',
        'on-accent': '#191919',
        'accent-soft': '#FFF7CC',

        // 주 색은 먹색. 카카오 계열 UI 의 CTA 가 검정 계열이다.
        primary: '#191919',
        'on-primary': '#FFFFFF',
        'primary-container': '#333333',
        'on-primary-container': '#FFFFFF',
        'primary-fixed': '#FEE500',
        'primary-fixed-dim': '#F5DC00',
        'on-primary-fixed': '#191919',
        'on-primary-fixed-variant': '#5C5300',
        'inverse-primary': '#FEE500',

        secondary: '#3C4043',
        'on-secondary': '#FFFFFF',
        'secondary-container': '#5F6368',
        'on-secondary-container': '#FFFFFF',
        'secondary-fixed': '#FFF3B0',
        'secondary-fixed-dim': '#FFE97A',
        'on-secondary-fixed': '#4A3C00',
        'on-secondary-fixed-variant': '#6B5700',

        tertiary: '#4B5563',
        'on-tertiary': '#FFFFFF',
        'tertiary-container': '#6B7280',
        'on-tertiary-container': '#FFFFFF',
        'tertiary-fixed': '#E9EDF2',
        'tertiary-fixed-dim': '#D8DEE4',
        'on-tertiary-fixed': '#333D4B',
        'on-tertiary-fixed-variant': '#4B5563',

        error: '#D93025',
        'on-error': '#FFFFFF',
        'error-container': '#FCE8E6',
        'on-error-container': '#A50E0E',

        // 바깥 캔버스(노랑)와 콘텐츠 면(흰색)을 분리한다.
        background: '#FEE500',
        'on-background': '#191919',
        surface: '#FFFFFF',
        'on-surface': '#191919',
        'surface-variant': '#EFF3F6',
        'on-surface-variant': '#707070',
        'surface-bright': '#FFFFFF',
        'surface-dim': '#E9EDF2',
        'surface-container-lowest': '#FFFFFF',
        'surface-container-low': '#F7F8F9',
        'surface-container': '#EFF3F6',
        'surface-container-high': '#E4E9EE',
        'surface-container-highest': '#D8DEE4',
        'inverse-surface': '#191919',
        'inverse-on-surface': '#FFFFFF',
        'surface-tint': '#191919',

        outline: '#8B95A1',
        'outline-variant': '#E2E5E8',
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '9999px',
      },
      spacing: {
        'space-xs': '0.25rem',
        'space-sm': '0.5rem',
        'space-md': '0.75rem',
        'space-lg': '1rem',
        'space-xl': '1.5rem',
        margin: '1rem',
        gutter: '0.75rem',
      },
      fontFamily: {
        sans: [
          'var(--font-inter)',
          '-apple-system',
          'BlinkMacSystemFont',
          'Apple SD Gothic Neo',
          'Pretendard',
          'Malgun Gothic',
          'sans-serif',
        ],
      },
      fontSize: {
        caption: ['11px', { lineHeight: '14px', letterSpacing: '0.02em', fontWeight: '500' }],
        'label-sm': ['12px', { lineHeight: '16px', letterSpacing: '0.01em', fontWeight: '500' }],
        'label-md': ['14px', { lineHeight: '20px', letterSpacing: '0em', fontWeight: '500' }],
        'body-sm': ['13px', { lineHeight: '18px', letterSpacing: '0.005em', fontWeight: '400' }],
        'body-md': ['15px', { lineHeight: '22px', letterSpacing: '0em', fontWeight: '400' }],
        'body-lg': ['16px', { lineHeight: '24px', letterSpacing: '-0.005em', fontWeight: '400' }],
        'headline-sm': ['18px', { lineHeight: '24px', letterSpacing: '-0.01em', fontWeight: '700' }],
        'headline-md': ['21px', { lineHeight: '28px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-lg': ['25px', { lineHeight: '32px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-sm': ['31px', { lineHeight: '40px', letterSpacing: '-0.03em', fontWeight: '700' }],
      },
      boxShadow: {
        header: '0 1px 8px rgba(0,0,0,0.04)',
        dock: '0 -4px 20px rgba(25,25,25,0.05)',
        // 노란 캔버스 위에 뜨는 흰 콘텐츠 프레임
        frame: '0 8px 40px rgba(25,25,25,0.12)',
      },
    },
  },
  plugins: [],
} satisfies Config;
