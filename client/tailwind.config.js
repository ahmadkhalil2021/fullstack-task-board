/** @type {import('tailwindcss').Config} */
// Design tokens for colors, surface shades, radii, shadows, and motion.
// Color tokens use CSS variables defined in `src/index.css` so the same
// utility (e.g. `bg-surface-muted`) resolves to gray-100 in light mode
// and gray-900 in dark mode — no per-component `dark:` boilerplate needed.
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        surface: {
          subtle: 'rgb(var(--surface-subtle) / <alpha-value>)',
          muted: 'rgb(var(--surface-muted) / <alpha-value>)',
          raised: 'rgb(var(--surface-raised) / <alpha-value>)',
          overlay: 'rgb(var(--surface-overlay) / <alpha-value>)',
          text: 'rgb(var(--surface-text) / <alpha-value>)',
          'text-muted': 'rgb(var(--surface-text-muted) / <alpha-value>)',
          'text-subtle': 'rgb(var(--surface-text-subtle) / <alpha-value>)',
          border: 'rgb(var(--surface-border) / <alpha-value>)',
          'border-strong': 'rgb(var(--surface-border-strong) / <alpha-value>)',
        },
        status: {
          todo: 'rgb(100 116 139 / <alpha-value>)',
          inprogress: 'rgb(59 130 246 / <alpha-value>)',
          done: 'rgb(16 185 129 / <alpha-value>)',
          wontdo: 'rgb(244 63 94 / <alpha-value>)',
          blocked: 'rgb(245 158 11 / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
          hover: 'rgb(var(--primary-hover) / <alpha-value>)',
          muted: 'rgb(var(--primary-muted) / <alpha-value>)',
          'muted-text': 'rgb(var(--primary-muted-text) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'rgb(var(--danger) / <alpha-value>)',
          hover: 'rgb(var(--danger-hover) / <alpha-value>)',
          text: 'rgb(var(--danger-text) / <alpha-value>)',
          muted: 'rgb(var(--danger-muted) / <alpha-value>)',
          'muted-strong': 'rgb(var(--danger-muted-strong) / <alpha-value>)',
        },
      },
      borderRadius: {
        card: '0.75rem',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'card-hover': '0 4px 12px -2px rgb(0 0 0 / 0.08)',
        'card-drag': '0 12px 24px -6px rgb(0 0 0 / 0.18)',
      },
      transitionDuration: {
        DEFAULT: '200ms',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
      },
    },
  },
  plugins: [],
  // Status colors are picked dynamically from `lib/statusColor.js`;
  // Tailwind's JIT can't statically detect dynamic class names, so we
  // safelist the variants we use as backgrounds, borders, and dots.
  // `border-t-` and `border-l-` variants must be listed separately —
  // Tailwind generates `border-{color}` and `border-t-{color}` as distinct classes.
  safelist: [
    'bg-status-todo',
    'bg-status-inprogress',
    'bg-status-done',
    'bg-status-wontdo',
    'bg-status-blocked',
    'border-status-todo',
    'border-status-inprogress',
    'border-status-done',
    'border-status-wontdo',
    'border-status-blocked',
    'border-t-status-todo',
    'border-t-status-inprogress',
    'border-t-status-done',
    'border-t-status-wontdo',
    'border-t-status-blocked',
    'border-l-status-todo',
    'border-l-status-inprogress',
    'border-l-status-done',
    'border-l-status-wontdo',
    'border-l-status-blocked',
    'text-status-todo',
    'text-status-inprogress',
    'text-status-done',
    'text-status-wontdo',
    'text-status-blocked',
  ],
}