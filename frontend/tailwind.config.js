/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fef7ee',
          100: '#fdecd7',
          200: '#fad5ae',
          300: '#f6b77a',
          400: '#f19144',
          500: '#ed7420',
          600: '#de5a16',
          700: '#b84414',
          800: '#933718',
          900: '#772f16',
        }
      }
    },
  },
  plugins: [],
}
