import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#071820',
          soft: '#0f2a36',
          muted: '#3d5a66',
        },
        foam: {
          DEFAULT: '#eef5f7',
          deep: '#d4e4ea',
        },
        signal: {
          DEFAULT: '#0e9aa7',
          bright: '#14c4d4',
          deep: '#0a6f79',
        },
        ember: {
          DEFAULT: '#e8a54b',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'ui-sans-serif', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        'rail-pulse': {
          '0%, 100%': { opacity: '0.35', transform: 'scaleX(0.92)' },
          '50%': { opacity: '1', transform: 'scaleX(1)' },
        },
        'node-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(14, 154, 167, 0.0)' },
          '50%': { boxShadow: '0 0 0 8px rgba(14, 154, 167, 0.12)' },
        },
        'drift': {
          '0%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
          '100%': { transform: 'translateY(0px)' },
        },
      },
      animation: {
        'rail-pulse': 'rail-pulse 3.2s ease-in-out infinite',
        'node-glow': 'node-glow 2.4s ease-in-out infinite',
        drift: 'drift 7s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
