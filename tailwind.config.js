/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0a0a0a',
          900: '#121212',
          800: '#1f1f1f',
        },
        accent: {
          DEFAULT: '#FFC107',
          foreground: '#0a0a0a',
          strong: '#FF3300',
        },
        sand: {
          50: '#f7f6f4',
          100: '#eeece8',
        },
      },
      fontFamily: {
        display: ['"Fraunces"', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
