/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0a0e14',
          900: '#0f1419',
          850: '#131820',
          800: '#1a2029',
          750: '#222a35',
          700: '#2b3441',
          600: '#3a4555',
          500: '#4a5668',
          400: '#6b7689',
          300: '#8b95a7',
          200: '#aab2c0',
          100: '#c8ced8',
          50: '#e5e9ef',
        },
        teal: {
          DEFAULT: '#2dd4bf',
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        bull: {
          DEFAULT: '#22c55e',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        bear: {
          DEFAULT: '#ef4444',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
        warn: {
          DEFAULT: '#f59e0b',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Menlo', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
    },
  },
  plugins: [],
};
