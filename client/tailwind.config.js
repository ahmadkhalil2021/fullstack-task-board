/** @type {import('tailwindcss').Config} */
// Tailwind config — `content` tells Tailwind which files to scan for class names
// We use `darkMode: 'class'` so the dark theme is controlled by toggling a `dark` class on <html>
// This is preferred over `darkMode: 'media'` because it lets us respect user choice + localStorage
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
      transitionDuration: {
        DEFAULT: '150ms',
      },
      boxShadow: {
        'glass-sm': 'inset 0 1px 0 rgba(255,255,255,0.35), 0 4px 16px -4px rgba(0,0,0,0.12)',
        glass: 'inset 0 1px 0 rgba(255,255,255,0.5), 0 8px 32px -8px rgba(0,0,0,0.18)',
        'glass-dark': 'inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 32px -8px rgba(0,0,0,0.5)',
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
}
