/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#006194', container: '#007bb9', fixed: '#cce5ff', light: '#0284C7' },
        secondary: { DEFAULT: '#b60e3d', container: '#da3054', fixed: '#ffdadb', coral: '#FF4D6D' },
        tertiary: { DEFAULT: '#006947', container: '#00855b', fixed: '#6ffbbe', green: '#10B981' },
        surface: { DEFAULT: '#faf8ff', low: '#f2f3ff', mid: '#eaedff', high: '#e2e7ff', highest: '#dae2fd' },
        ink: { DEFAULT: '#131b2e', soft: '#3f4850', mute: '#707881', line: '#bfc7d2' },
        amber: { DEFAULT: '#F59E0B' }, violet: { DEFAULT: '#8B5CF6' },
      },
      fontFamily: { display: ['Outfit', 'sans-serif'], sans: ['"Plus Jakarta Sans"', 'sans-serif'] },
      borderRadius: { xl: '1rem', '2xl': '1.5rem' },
    },
  },
  plugins: [],
}
