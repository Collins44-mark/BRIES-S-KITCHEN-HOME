/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sidebar: {
          DEFAULT: 'rgba(255,255,255,0.78)',
          foreground: '#0f172a',
          muted: '#64748b',
          hover: 'rgba(255,255,255,0.7)',
          active: '#0f172a',
        },
        brand: {
          navy: '#0f172a',
          charcoal: '#1e293b',
        },
        surface: {
          DEFAULT: '#f5f7fa',
          card: 'rgba(255,255,255,0.62)',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Display',
          'SF Pro Text',
          'Inter',
          'system-ui',
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
