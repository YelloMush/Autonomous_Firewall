/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      colors: {
        sage: { DEFAULT: '#6A9479', light: 'rgba(106,148,121,0.12)', border: 'rgba(106,148,121,0.35)' },
        ember: { DEFAULT: '#B36A55', light: 'rgba(179,106,85,0.12)' },
        amber: { DEFAULT: '#92400e', bar: '#b45309' },
      },
      animation: {
        'pulse-slow': 'pulse 2.5s cubic-bezier(0.4,0,0.6,1) infinite',
        'blink': 'blink 1.4s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-out both',
      },
      keyframes: {
        blink: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.2' } },
        fadeIn: { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};
