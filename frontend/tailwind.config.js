/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
      },
      colors: {
        background: '#121212', // Deep charcoal black
        'primary-red': '#E63946',
        'primary-green': '#06D6A0',
        'primary-gold': '#FFD166',
        roulette: { // Keep old colors for compatibility, can be phased out
          red: '#DC143C',
          black: '#1a1a1a',
          green: '#228B22',
          gold: '#FFD700',
        }
      },
      animation: {
        'spin-wheel': 'spin 2s linear infinite',
        'spin-slow': 'spin 3s linear infinite',
        'bounce-chip': 'bounce 0.5s ease-in-out',
      }
    },
  },
  plugins: [],
}
