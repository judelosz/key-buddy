import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Parlor Pastel — warm, genre-grounded (see CLAUDE.md / plan)
        paper: '#FBF7F0', // app background (warm ivory)
        sand: '#F2EBDE', // inset tiles, progress tracks, subtle panels
        surface: '#FFFFFF', // cards
        ink: {
          DEFAULT: '#2B2620', // primary text (warm brown-black)
          soft: '#6E6456', // secondary / muted text
        },
        line: '#E9E0D2', // hairline borders

        // Accents: soft (bg tint) · DEFAULT (fill) · deep (text/icon on light)
        rose: { soft: '#FBE3E8', DEFAULT: '#F4A9B8', deep: '#C77489' }, // gospel blush — primary
        amber: { soft: '#FCEFD2', DEFAULT: '#F6D08A', deep: '#C79445' }, // Rhodes/Wurli — hero
        mint: { soft: '#E2F2EA', DEFAULT: '#A9DBC4', deep: '#5AA284' }, // sage
        peri: { soft: '#E7E9FB', DEFAULT: '#B7C0F0', deep: '#7681CE' }, // blues

        // Functional grade colors (scoring) — deepened for legibility on ivory.
        grade: {
          perfect: '#34B378',
          great: '#7FD0A6',
          good: '#E3A72E',
          early: '#EC7A3B',
          late: '#9A72D6',
          miss: '#E5646B',
        },
      },
      fontFamily: {
        display: ['Fredoka', 'system-ui', 'sans-serif'],
        sans: ['Nunito', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(43,38,32,0.04), 0 6px 20px rgba(43,38,32,0.06)',
        lift: '0 12px 32px rgba(43,38,32,0.12)',
      },
      keyframes: {
        pop: {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '60%': { transform: 'scale(1.04)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'fade-up': {
          '0%': { transform: 'translateY(6px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(220%)' },
        },
        confetti: {
          '0%': { transform: 'translateY(-4vh) rotate(0deg)', opacity: '1' },
          '85%': { opacity: '1' },
          '100%': { transform: 'translateY(108vh) rotate(540deg)', opacity: '0' },
        },
      },
      animation: {
        pop: 'pop 0.42s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-up': 'fade-up 0.4s ease-out both',
        shimmer: 'shimmer 1.6s ease-in-out infinite',
        confetti: 'confetti 2s ease-in both',
      },
    },
  },
  plugins: [],
} satisfies Config;
