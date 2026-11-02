/** @type {import('tailwindcss').Config} */
// As cores vêm de variáveis CSS (src/index.css) para o app ter modo claro e escuro.
const v = (n) => `rgb(var(--${n}) / <alpha-value>)`
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: v('primary'), container: v('primary-container'), fixed: v('primary-fixed'), light: v('primary-light') },
        secondary: { DEFAULT: v('secondary'), container: v('secondary-container'), fixed: v('secondary-fixed'), coral: '#FF4D6D' },
        tertiary: { DEFAULT: v('tertiary'), container: v('tertiary-container'), fixed: v('tertiary-fixed'), green: '#10B981' },
        surface: { DEFAULT: v('surface'), low: v('surface-low'), mid: v('surface-mid'), high: v('surface-high'), highest: v('surface-highest') },
        ink: { DEFAULT: v('ink'), soft: v('ink-soft'), mute: v('ink-mute'), line: v('ink-line') },
        card: v('card'),
        night: '#131b2e',
        mint: '#6ffbbe',
        amber: { DEFAULT: '#F59E0B', ink: v('amber-ink') },
        violet: { DEFAULT: '#8B5CF6' },
      },
      fontFamily: { display: ['Outfit', 'sans-serif'], sans: ['"Plus Jakarta Sans"', 'sans-serif'] },
      borderRadius: { xl: '1rem', '2xl': '1.5rem' },
    },
  },
  plugins: [],
}
