/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sidebar: {
          DEFAULT: '#1c1f26',
          foreground: '#f5f5f7',
          muted: '#8e9299',
          hover: '#2a2e38',
          active: '#2f3542',
        },
        brand: {
          navy: '#1c2430',
          charcoal: '#222831',
        },
        surface: {
          DEFAULT: '#f4f5f7',
          card: 'rgba(255,255,255,0.78)',
        },
      },
      fontFamily: {
        sans: [
          'var(--font-geist-sans)',
          'SF Pro Display',
          'Segoe UI',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        glass: '0 8px 30px rgba(15, 23, 42, 0.06)',
        soft: '0 4px 20px rgba(15, 23, 42, 0.05)',
        toast: '0 10px 40px rgba(15, 23, 42, 0.12)',
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
      },
      keyframes: {
        'welcome-in': {
          '0%': { opacity: '0', transform: 'translateY(-12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'welcome-out': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'welcome-in': 'welcome-in 0.35s ease-out forwards',
        'welcome-out': 'welcome-out 0.3s ease-in forwards',
      },
    },
  },
  plugins: [],
};
