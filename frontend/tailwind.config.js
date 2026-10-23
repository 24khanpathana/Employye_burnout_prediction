/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
        navy: '#020817',
        panel: '#0f172a',
        accent: '#1d4ed8',
        low: '#22c55e',
        medium: '#f59e0b',
        high: '#ef4444'
      },
      boxShadow: {
        soft: '0 10px 30px rgba(15, 23, 42, 0.35)'
      }
    }
  },
  plugins: []
};
