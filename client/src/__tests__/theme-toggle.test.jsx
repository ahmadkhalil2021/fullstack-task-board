// __tests__/theme-toggle.test.jsx — Tests for the theme toggle button
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ThemeToggle from '../components/ThemeToggle.jsx'
import { useBoardStore } from '../store/useBoardStore.js'

vi.mock('../lib/api.js', () => ({
  fetchBoard: vi.fn(),
  createBoard: vi.fn(),
  updateBoard: vi.fn(),
  updateTask: vi.fn(),
  updateTaskOrder: vi.fn(),
  deleteTask: vi.fn(),
  createTask: vi.fn(),
}))

// jsdom has no matchMedia, so we fake it and track change listeners
let prefersDark = false
let changeListeners = []

const makeMql = () => ({
  matches: prefersDark,
  media: '(prefers-color-scheme: dark)',
  addEventListener: (event, cb) => {
    if (event === 'change') changeListeners.push(cb)
  },
  removeEventListener: (event, cb) => {
    changeListeners = changeListeners.filter((l) => l !== cb)
  },
})

beforeEach(() => {
  vi.clearAllMocks()
  prefersDark = false
  changeListeners = []
  window.matchMedia = vi.fn(() => makeMql())
  localStorage.clear()
  useBoardStore.setState({ theme: 'light', board: null, isLoading: false, error: null })
  document.documentElement.classList.remove('dark')
})

const getButton = () => screen.getByRole('button', { name: /^Theme:/ })

describe('ThemeToggle', () => {
  it('renders the current theme icon', () => {
    render(<ThemeToggle />)
    expect(getButton()).toHaveTextContent('☀')
  })

  it('cycles light → dark → system → light on click', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)
    const button = getButton()

    await user.click(button)
    expect(button).toHaveTextContent('🌙')

    await user.click(button)
    expect(button).toHaveTextContent('💻')

    await user.click(button)
    expect(button).toHaveTextContent('☀')
  })

  it('persists the theme to localStorage on click', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)
    const button = getButton()

    await user.click(button)
    expect(localStorage.getItem('theme')).toBe('dark')

    await user.click(button)
    expect(localStorage.getItem('theme')).toBe('system')
  })

  it('updates the dark class on <html> when the theme changes', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)
    const button = getButton()

    await user.click(button)
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    await user.click(button)
    await user.click(button)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it("applies the system preference when the theme is 'system' and it changes", () => {
    useBoardStore.setState({ theme: 'system' })
    useBoardStore.getState().initTheme()
    expect(changeListeners.length).toBe(1)

    // OS switches to dark while the user is on 'system'
    prefersDark = true
    changeListeners.forEach((cb) => cb({ matches: true }))
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    // OS switches back to light
    prefersDark = false
    changeListeners.forEach((cb) => cb({ matches: false }))
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
