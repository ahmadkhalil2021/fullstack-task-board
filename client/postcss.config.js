// PostCSS config — required for Tailwind to process CSS through Vite
// Order matters: `tailwindcss` runs first, then `autoprefixer` adds vendor prefixes
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
