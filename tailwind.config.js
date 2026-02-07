/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        win98: {
          teal: '#008080',
          gray: '#c0c0c0',
          'gray-dark': '#808080',
          'gray-light': '#dfdfdf',
          blue: '#000080',
          'blue-light': '#1084d0',
          text: '#0a0a0a',
        },
        terminal: {
          black: '#0c0c0c',
          green: '#00ff00',
        }
      },
      fontFamily: {
        retro: ['"VT323"', 'monospace'],
        sans: ['"Segoe UI"', 'Tahoma', 'sans-serif'],
      },
      boxShadow: {
        'out': 'inset -1px -1px #0a0a0a, inset 1px 1px #dfdfdf, inset -2px -2px #808080, inset 2px 2px #ffffff',
        'in': 'inset -1px -1px #ffffff, inset 1px 1px #0a0a0a, inset -2px -2px #dfdfdf, inset 2px 2px #808080',
        'modern': '0 20px 50px rgba(0,0,0,0.5)',
      }
    },
  },
  plugins: [],
}