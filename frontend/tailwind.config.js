/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        wood: {
          900: '#1F1008',
          800: '#3D2B1F',
          700: '#5C3D2E',
          600: '#7A5040',
          500: '#C8964C',
          400: '#D4AA72',
          300: '#E2C89A',
          200: '#EDD9B8',
          100: '#FAF6F2',
          50:  '#FDF9F6',
        },
      },
    },
  },
  plugins: [],
}
