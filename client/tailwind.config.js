/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dark navy table — matches the reference screenshots
        felt: '#162030',
        'felt-dark': '#0f1923',
        'felt-center': '#1a2840',
      },
      keyframes: {
        'turn-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 3px #3b82f6, 0 0 16px 4px rgba(59,130,246,0.5)' },
          '50%':       { boxShadow: '0 0 0 3px #60a5fa, 0 0 24px 8px rgba(96,165,250,0.7)' },
        },
        'shuffle-deck': {
          '0%,100%': { transform: 'rotate(0deg) translateX(0px)' },
          '25%':     { transform: 'rotate(-4deg) translateX(-6px)' },
          '75%':     { transform: 'rotate(4deg) translateX(6px)' },
        },
      },
      animation: {
        'turn-pulse':    'turn-pulse 1.5s ease-in-out infinite',
        'shuffle-deck':  'shuffle-deck 0.4s ease-in-out 1',
      },
    },
  },
  plugins: [],
};
