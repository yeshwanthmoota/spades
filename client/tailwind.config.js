/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        felt: '#0a5e2a',
        'felt-dark': '#07421d',
      },
    },
  },
  plugins: [],
};
