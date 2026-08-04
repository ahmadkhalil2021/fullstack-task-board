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
    extend: {},
  },
  plugins: [],
}
