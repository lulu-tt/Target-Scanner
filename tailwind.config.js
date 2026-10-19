/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        target: {
          dark: '#12161A',
          card: '#1A2128',
          border: '#2A3642',
          accent: '#FF334B',
          ring: '#E8ECF0',
          bullseye: '#0D0F12',
          ten: '#FFD700'
        }
      }
    },
  },
  plugins: [],
}
