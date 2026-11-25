/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        raised: 'rgb(var(--raised) / <alpha-value>)',
        overlay: 'rgb(var(--overlay) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        'line-strong': 'rgb(var(--line-strong) / <alpha-value>)',
        text: 'rgb(var(--text) / <alpha-value>)',
        'text-2': 'rgb(var(--text-2) / <alpha-value>)',
        'text-3': 'rgb(var(--text-3) / <alpha-value>)',
        brand: 'rgb(var(--brand) / <alpha-value>)',
        'brand-deep': 'rgb(var(--brand-deep) / <alpha-value>)',
        'brand-soft': 'rgb(var(--brand-soft) / <alpha-value>)',
        rift: 'rgb(var(--rift) / <alpha-value>)',
        'rift-fg': 'rgb(var(--rift-fg) / <alpha-value>)',
        'rift-soft': 'rgb(var(--rift-soft) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        info: 'rgb(var(--info) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['"Manrope Variable"', 'Manrope', 'ui-sans-serif', 'system-ui', '"Segoe UI"', 'sans-serif'],
        display: ['"Space Grotesk Variable"', '"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.625rem',
        '4xl': '2rem',
      },
      boxShadow: {
        card: '0 1px 0 0 rgb(255 255 255 / 0.03) inset, 0 20px 50px -30px rgb(0 0 0 / 0.8)',
        hero: '0 30px 80px -40px rgb(var(--brand) / 0.45)',
        rift: '0 30px 80px -40px rgb(var(--rift) / 0.55)',
        dock: '0 -10px 40px -20px rgb(0 0 0 / 0.9)',
      },
      keyframes: {
        rise: {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(.94)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'sheet-up': {
          from: { opacity: '0', transform: 'translateY(28px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(12px) scale(.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 0 0 rgb(var(--brand) / .5)' },
          '50%': { opacity: '.7', boxShadow: '0 0 0 5px rgb(var(--brand) / 0)' },
        },
        drift: {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%': { transform: 'translate3d(2%, -3%, 0) scale(1.08)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
      animation: {
        rise: 'rise .55s cubic-bezier(.22,1,.36,1) both',
        pop: 'pop-in .45s cubic-bezier(.34,1.4,.44,1) both',
        'sheet-up': 'sheet-up .32s cubic-bezier(.22,1,.36,1) both',
        fade: 'fade-in .3s ease both',
        'toast-in': 'toast-in .35s cubic-bezier(.22,1,.36,1) both',
        'pulse-dot': 'pulse-dot 2.4s ease-in-out infinite',
        drift: 'drift 18s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
