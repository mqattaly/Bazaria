import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Vazirmatn',
          'IRANSans',
          'Tahoma',
          'system-ui',
          'sans-serif',
        ],
      },
      colors: {
        brand: {
          50: '#eef6f4',
          100: '#d6ebe5',
          200: '#aed7cc',
          300: '#7ebcac',
          400: '#4f9f8b',
          500: '#348371',
          600: '#27695b',
          700: '#21554a',
          800: '#1d453d',
          900: '#193a33',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
