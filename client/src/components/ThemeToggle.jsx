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
      className="text-xl leading-none p-2 min-h-[40px] min-w-[40px] flex items-center justify-center rounded text-surface-text-muted hover:bg-surface-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle transition-colors duration-200"
    >
      {ICONS[theme]}
    </button>
  )
}

export default ThemeToggle