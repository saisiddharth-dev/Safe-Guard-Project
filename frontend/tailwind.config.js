/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#eef2f8',
          900: '#ffffff',
          850: '#ffffff',
          800: '#f4f7fb',
          700: '#e3e9f2',
          600: '#d6dfea',
        },
        navy: {
          950: '#070b14',
          900: '#0a1120',
          850: '#0e1628',
          800: '#131d33',
          700: '#1b2947',
          600: '#24365c',
        },
        brand: {
          DEFAULT: '#2f7cf6',
          dark: '#1f5fd0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};