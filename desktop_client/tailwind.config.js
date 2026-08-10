/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'serif'],
        sans:  ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono:  ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      colors: {
        sage:  { DEFAULT: '#6A9479' },
        ember: { DEFAULT: '#B36A55' },
      },
    },
  },
  plugins: [],
};
