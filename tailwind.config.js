/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./styles/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
      },
      colors: {
        'player-bg': 'rgba(29, 31, 36, .8)',
        'form-text': 'rgba(0, 0, 0, 0.59)'
      },
      backgroundImage: {
        'main': "url('/img/colored_body_top2.png')"
      }
    },
  },
  plugins: [],
}