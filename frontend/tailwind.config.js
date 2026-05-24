/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy:    '#070614',
        coral: {
          DEFAULT: '#C8603A',
          dark:    '#A84E2C',
          light:   '#f5ede9',
        },
        brand: {
          black:     '#000000',
          navy:      '#070614',
          charcoal:  '#464545',
          coral:     '#C8603A',
          'coral-dark': '#A84E2C',
          white:     '#ffffff',
          'off-white': '#f8f7f5',
          border:    '#e8e5e0',
          body:      '#2c2c2c',
          muted:     '#888580',
        },
      },
      fontFamily: {
        head: ['Poppins', 'sans-serif'],
        body: ['Montserrat', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 24px rgba(0,0,0,0.08)',
        'card-lg': '0 8px 40px rgba(0,0,0,0.12)',
      },
      borderRadius: {
        brand: '16px',
      },
    },
  },
  plugins: [],
}
