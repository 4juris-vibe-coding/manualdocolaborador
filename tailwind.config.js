/** @type {import('tailwindcss').Config} */
// Cores definidas como variáveis CSS (src/index.css) para suportar tema claro e escuro.
const v = (nome) => `rgb(var(--c-${nome}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Paleta oficial 4JURIS (Rebranding)
        brand: {
          DEFAULT: v('brand'),
          50: v('brand-50'), 100: v('brand-100'), 200: v('brand-200'), 300: v('brand-300'), 400: v('brand-400'),
          500: v('brand'), 600: v('brand-600'), 700: v('brand-700'), 800: v('brand-800'), 900: v('brand-900'),
        },
        ink: { DEFAULT: v('ink'), soft: v('ink-soft'), 2: v('ink-2') },
        // Fundo escuro institucional (Midnight Blue) — fixo nos dois temas.
        midnight: { DEFAULT: '#122029', soft: '#1c2f3a' },
        winter: v('winter'),
        platinum: v('platinum'),
        surface: { DEFAULT: v('surface'), 2: v('surface-2'), 3: v('surface-3') },
        line: { DEFAULT: v('line'), strong: v('line-strong') },
        muted: { DEFAULT: v('muted'), 2: v('muted-2') },
        success: { DEFAULT: v('success'), soft: v('success-soft'), line: v('success-line'), ink: v('success-ink') },
        warning: { DEFAULT: v('warning'), soft: v('warning-soft'), line: v('warning-line'), ink: v('warning-ink') },
        danger: { DEFAULT: v('danger'), soft: v('danger-soft'), line: v('danger-line'), ink: v('danger-ink'), hover: v('danger-hover') },
        gold: { DEFAULT: v('warning'), soft: v('warning-soft') },
      },
      fontFamily: {
        sans: ['Sora', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '14px',
        '2xl': '18px',
        '3xl': '24px',
      },
      boxShadow: {
        xs: '0 1px 2px rgb(var(--c-shadow) / .05)',
        sm: '0 1px 2px rgb(var(--c-shadow) / .05), 0 4px 12px rgb(var(--c-shadow) / .05)',
        md: '0 2px 6px rgb(var(--c-shadow) / .06), 0 14px 34px rgb(var(--c-shadow) / .09)',
        lg: '0 10px 30px rgb(var(--c-shadow) / .10), 0 30px 60px rgb(var(--c-shadow) / .14)',
        brand: '0 1px 2px rgb(var(--c-shadow) / .18)',
        glow: '0 1px 2px rgb(var(--c-shadow) / .18)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(14px)' }, to: { opacity: '1', transform: 'none' } },
        'scale-in': { from: { opacity: '0', transform: 'scale(.97)' }, to: { opacity: '1', transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        pop: { '0%': { transform: 'scale(.8)', opacity: '0' }, '60%': { transform: 'scale(1.05)' }, '100%': { transform: 'scale(1)', opacity: '1' } },
      },
      animation: {
        'fade-in': 'fade-in .3s ease',
        'slide-up': 'slide-up .35s cubic-bezier(.2,.8,.3,1)',
        'scale-in': 'scale-in .22s cubic-bezier(.2,.8,.3,1)',
        pop: 'pop .4s cubic-bezier(.2,.8,.3,1)',
      },
    },
  },
  plugins: [],
}
