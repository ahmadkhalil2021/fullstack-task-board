// ThemeToggle.jsx — Single button that cycles light → dark → system → light
import { useBoardStore } from '../store/useBoardStore.js'

const THEMES = ['light', 'dark', 'system']
const ICONS = {
  light: '☀',
  dark: '🌙',
  system: '💻',
}

const ThemeToggle = () => {
  const theme = useBoardStore((s) => s.theme)
  const setTheme = useBoardStore((s) => s.setTheme)

  const next = () => {
    const index = THEMES.indexOf(theme)
    setTheme(THEMES[(index + 1) % THEMES.length])
  }

  return (
    <button
      type="button"
      onClick={next}
      aria-label={`Theme: ${theme}`}
      className="text-xl leading-none p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {ICONS[theme]}
    </button>
  )
}

export default ThemeToggle
