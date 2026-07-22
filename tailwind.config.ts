import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Grade feedback palette (doc 03 §3.2)
        grade: {
          perfect: '#22c55e',
          great: '#86efac',
          good: '#eab308',
          early: '#f97316',
          late: '#a855f7',
          miss: '#ef4444',
        },
        ink: {
          DEFAULT: '#0f1115',
          soft: '#1a1d24',
          line: '#272b34',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
