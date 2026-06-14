/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './App.tsx',
    './{components,pages,data,utils}/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
        lcd: ['VT323', 'ui-monospace', 'monospace'],
        sans: ['VT323', 'ui-monospace', 'monospace'],
      },
      colors: {
        chassis: { 900: '#0e0d0b', 800: '#15130f', 700: '#1d1a15', 600: '#272219' },
        metal: { 300: '#5d5749', 400: '#4a463d', 500: '#322e27', 600: '#272420', 700: '#1d1b17' },
        silver: { 300: '#c4c8cc', 400: '#9aa0a4', 500: '#6c7075', 600: '#44474a' },
        amber: { 300: '#ffd27a', 400: '#ffb22e', 500: '#ff9500', 600: '#d97a00' },
        lime: { 400: '#5dff9e', 500: '#2bff88', 600: '#13c463' },
        onair: { 400: '#ff6a6a', 500: '#ff2d2d', 600: '#d61f1f' },
        info: { 400: '#5cc8ff', 500: '#35b6ff' },
      },
      animation: {
        'fade-in': 'fadeIn .35s ease-out',
        blink: 'blink 1.1s steps(1) infinite',
        marquee: 'marquee 14s linear infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        blink: { '0%,49%': { opacity: '1' }, '50%,100%': { opacity: '.25' } },
        marquee: { '0%': { transform: 'translateX(100%)' }, '100%': { transform: 'translateX(-100%)' } },
      },
    },
  },
  plugins: [],
};
