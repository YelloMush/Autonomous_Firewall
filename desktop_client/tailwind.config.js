/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'serif'],
        sans:  ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono:  ['JetBrains Mono', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        sage: {
          DEFAULT: '#6A9479',
          light:   'rgba(106,148,121,0.12)',
          border:  'rgba(106,148,121,0.30)',
          dim:     '#4a6b56',
        },
        ember: {
          DEFAULT: '#B36A55',
          light:   'rgba(179,106,85,0.12)',
          border:  'rgba(179,106,85,0.30)',
          dim:     '#8a4f3e',
        },
        amber: {
          DEFAULT: '#b45309',
          light:   'rgba(180,83,9,0.12)',
          border:  'rgba(180,83,9,0.30)',
          dim:     '#7c3a08',
        },
      },
      borderRadius: {
        sm:      '2px',
        DEFAULT: '4px',
        md:      '6px',
      },
      transitionTimingFunction: {
        snap:   'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        gauge:  'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        shieldDraw:     { from: { strokeDashoffset: '280', opacity: '0' }, to: { strokeDashoffset: '0', opacity: '1' } },
        splashOut:      { from: { opacity: '1' }, to: { opacity: '0' } },
        termLine:       { from: { opacity: '0', transform: 'translateY(2px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        blink:          { '0%,100%': { opacity: '1' }, '50%': { opacity: '0' } },
        liveGlow:       { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.25' } },
        thresholdPulse: { '0%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.4)' }, '100%': { transform: 'scale(1)' } },
        tabIn:          { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        latticeRotate:  { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
        shimmer:        { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(200%)' } },
        fadeIn:         { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      animation: {
        'shield-draw':     'shieldDraw 1.2s ease-in-out both',
        'splash-out':      'splashOut 0.4s ease-out both',
        'term-line':       'termLine 120ms ease-out both',
        'blink':           'blink 1.1s step-end infinite',
        'live-glow':       'liveGlow 2s ease-in-out infinite',
        'threshold-pulse': 'thresholdPulse 0.3s ease-out',
        'tab-in':          'tabIn 200ms ease-snap both',
        'lattice':         'latticeRotate 8s linear infinite',
        'shimmer':         'shimmer 1.5s ease-in-out infinite',
        'fade-in':         'fadeIn 200ms ease-out both',
      },
    },
  },
  plugins: [],
};
