import type { Config } from 'tailwindcss';

// 디자인 토큰 — Material 3 계열 팔레트에 인디고 포인트 1색.
// PRD §9.4(흑백 + 포인트 컬러 1색)와 같은 방향이다. 중립 서피스 위에 primary 하나만 쓴다.
// 로고 파일을 받으면 primary 계열 값만 교체하면 된다.

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#4648d4',
        'on-primary': '#ffffff',
        'primary-container': '#6063ee',
        'on-primary-container': '#fffbff',
        'primary-fixed': '#e1e0ff',
        'primary-fixed-dim': '#c0c1ff',
        'on-primary-fixed': '#07006c',
        'on-primary-fixed-variant': '#2f2ebe',
        'inverse-primary': '#c0c1ff',

        secondary: '#4b41e1',
        'on-secondary': '#ffffff',
        'secondary-container': '#645efb',
        'on-secondary-container': '#fffbff',
        'secondary-fixed': '#e2dfff',
        'secondary-fixed-dim': '#c3c0ff',
        'on-secondary-fixed': '#0f0069',
        'on-secondary-fixed-variant': '#3323cc',

        tertiary: '#4651b9',
        'on-tertiary': '#ffffff',
        'tertiary-container': '#606ad4',
        'on-tertiary-container': '#fffbff',
        'tertiary-fixed': '#e0e0ff',
        'tertiary-fixed-dim': '#bdc2ff',
        'on-tertiary-fixed': '#000767',
        'on-tertiary-fixed-variant': '#2f3aa3',

        error: '#ba1a1a',
        'on-error': '#ffffff',
        'error-container': '#ffdad6',
        'on-error-container': '#93000a',

        background: '#faf8ff',
        'on-background': '#131b2e',
        surface: '#faf8ff',
        'on-surface': '#131b2e',
        'surface-variant': '#dae2fd',
        'on-surface-variant': '#464554',
        'surface-bright': '#faf8ff',
        'surface-dim': '#d2d9f4',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#f2f3ff',
        'surface-container': '#eaedff',
        'surface-container-high': '#e2e7ff',
        'surface-container-highest': '#dae2fd',
        'inverse-surface': '#283044',
        'inverse-on-surface': '#eef0ff',
        'surface-tint': '#494bd6',

        outline: '#767586',
        'outline-variant': '#c7c4d7',
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
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        caption: ['11px', { lineHeight: '14px', letterSpacing: '0.02em', fontWeight: '500' }],
        'label-sm': ['12px', { lineHeight: '16px', letterSpacing: '0.01em', fontWeight: '500' }],
        'label-md': ['14px', { lineHeight: '20px', letterSpacing: '0em', fontWeight: '500' }],
        'body-sm': ['13px', { lineHeight: '18px', letterSpacing: '0.005em', fontWeight: '400' }],
        'body-md': ['15px', { lineHeight: '22px', letterSpacing: '0em', fontWeight: '400' }],
        'body-lg': ['16px', { lineHeight: '24px', letterSpacing: '-0.005em', fontWeight: '400' }],
        'headline-sm': ['18px', { lineHeight: '24px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'headline-md': ['20px', { lineHeight: '28px', letterSpacing: '-0.015em', fontWeight: '600' }],
        'headline-lg': ['24px', { lineHeight: '32px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-sm': ['30px', { lineHeight: '38px', letterSpacing: '-0.025em', fontWeight: '700' }],
      },
      boxShadow: {
        header: '0 1px 8px rgba(0,0,0,0.04)',
        dock: '0 -4px 20px rgba(19,27,46,0.04)',
      },
    },
  },
  plugins: [],
} satisfies Config;
