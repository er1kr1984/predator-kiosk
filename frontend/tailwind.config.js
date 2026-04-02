/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // E2E / Axis brand palette
        brand: {
          light:   '#FDE68A', // tints — backgrounds, highlights
          DEFAULT: '#F5B700', // primary Axis yellow
          dark:    '#D4A000', // hover states
          darker:  '#A37A00', // active / focus rings
        },
      },
      fontFamily: {
        sans: ['Open Sans', 'system-ui', '-apple-system', 'sans-serif'],
        lubalin: ['Lubalin Graph', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
