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
