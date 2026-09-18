// __tests__/command-bar.test.jsx — Keyboard, debounce, URL sync and filtering (Issue #25).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import {
  MemoryRouter,
  createMemoryRouter,
  RouterProvider,
  useLocation,
} from 'react-router-dom'
import CommandBar from '../components/CommandBar.jsx'
import BoardPage from '../pages/BoardPage.jsx'
import { useBoardStore } from '../store/useBoardStore.js'

const baseBoard = {
  _id: 'b1',
  name: 'Test Board',
  description: '',
  statuses: ['In Progress', 'Completed', "Won't do"],
  tasks: [
    { _id: 't1', name: 'Fix login bug', description: 'Auth flow breaks', status: 'In Progress', order: 0 },
    { _id: 't2', name: 'Write docs', description: 'Document the login flow', status: 'Completed', order: 0 },
    { _id: 't3', name: 'Refactor routes', description: 'Cleanup', status: "Won't do", order: 0 },
  ],
}

const LocationProbe = () => {
  const location = useLocation()
  return <span data-testid="location-search">{location.search}</span>
}

const renderBar = (initialEntry = '/board/b1', board = baseBoard) => {
  useBoardStore.setState({
    board,
    isLoading: false,
    error: null,
    query: '',
    filterStatus: null,
  })
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <CommandBar />
      <LocationProbe />
    </MemoryRouter>
  )
}

const openBar = () => {
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
  return screen.getByRole('textbox', { name: 'Search tasks' })
}

const typeQuery = (input, value, advance = 150) => {
  fireEvent.change(input, { target: { value } })
  act(() => {
    vi.advanceTimersByTime(advance)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('CommandBar — opening and closing', () => {
  it('renders an accessible search trigger', () => {
    renderBar()
    expect(screen.getByRole('button', { name: 'Search tasks' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens on Ctrl+K and focuses the input', () => {
    renderBar()
    const input = openBar()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(input).toHaveFocus()
  })

  it('opens on Meta+K as well', () => {
    renderBar()
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('closes on Escape and restores focus to the trigger', () => {
    renderBar()
    const input = openBar()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Search tasks' })).toHaveFocus()
  })

  it('closes on backdrop click but not on panel click', () => {
    renderBar()
    openBar()
    fireEvent.click(screen.getByRole('heading', { name: 'Board search' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('dialog'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps Tab focus inside the dialog', () => {
    renderBar()
    const input = openBar()
    fireEvent.keyDown(input, { key: 'Tab', shiftKey: true })
    const dialog = screen.getByRole('dialog')
    expect(dialog.contains(document.activeElement)).toBe(true)
    expect(document.activeElement).not.toBe(input)
  })
})

describe('CommandBar — search and debounce', () => {
  it('filters by name case-insensitively only after 150 ms', () => {
    renderBar()
    const input = openBar()
    fireEvent.change(input, { target: { value: 'LOGIN' } })

    act(() => {
      vi.advanceTimersByTime(149)
    })
    expect(useBoardStore.getState().query).toBe('')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(useBoardStore.getState().query).toBe('LOGIN')
    expect(useBoardStore.getState().getFilteredTasks().map((t) => t._id)).toEqual(['t1', 't2'])
    expect(screen.getByTestId('location-search')).toHaveTextContent('q=LOGIN')
  })

  it('matches descriptions and cancels prior debounce timers on rapid typing', () => {
    renderBar()
    const input = openBar()

    fireEvent.change(input, { target: { value: 'a' } })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    fireEvent.change(input, { target: { value: 'auth' } })
    act(() => {
      vi.advanceTimersByTime(149)
    })
    expect(useBoardStore.getState().query).toBe('')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(useBoardStore.getState().query).toBe('auth')
    expect(useBoardStore.getState().getFilteredTasks().map((t) => t._id)).toEqual(['t1'])
  })

  it('derives status pills from arbitrary board statuses with live counts', () => {
    const board = {
      ...baseBoard,
      statuses: ['Triage', 'Doing', 'Done'],
      tasks: [
        { _id: 'x1', name: 'Triage me', description: '', status: 'Triage', order: 0 },
        { _id: 'x2', name: 'Do A', description: '', status: 'Doing', order: 0 },
        { _id: 'x3', name: 'Do B', description: '', status: 'Doing', order: 1 },
      ],
    }
    renderBar('/board/b1', board)
    openBar()

    expect(screen.getByRole('button', { name: /^Triage/ })).toHaveTextContent('1')
    expect(screen.getByRole('button', { name: /^Doing/ })).toHaveTextContent('2')
    expect(screen.getByRole('button', { name: /^Done/ })).toHaveTextContent('0')
    expect(screen.getByRole('button', { name: /^All/ })).toHaveTextContent('3')
  })
})

describe('CommandBar — status filter and URL sync', () => {
  it('filters by status and writes the canonical key to the URL', () => {
    renderBar()
    openBar()

    fireEvent.click(screen.getByRole('button', { name: /^Completed/ }))
    expect(useBoardStore.getState().filterStatus).toBe('Completed')
    expect(useBoardStore.getState().getFilteredTasks().map((t) => t._id)).toEqual(['t2'])
    expect(screen.getByTestId('location-search')).toHaveTextContent('f=completed')
  })

  it('clears the status filter when All is selected', () => {
    renderBar()
    openBar()

    fireEvent.click(screen.getByRole('button', { name: /^Completed/ }))
    fireEvent.click(screen.getByRole('button', { name: /^All/ }))
    expect(useBoardStore.getState().filterStatus).toBeNull()
    expect(screen.getByTestId('location-search').textContent).not.toContain('f=')
  })

  it('Clear filters resets query, status and URL', () => {
    renderBar()
    const input = openBar()
    typeQuery(input, 'login')
    fireEvent.click(screen.getByRole('button', { name: /^Completed/ }))

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(useBoardStore.getState().query).toBe('')
    expect(useBoardStore.getState().filterStatus).toBeNull()

    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(screen.getByTestId('location-search').textContent).toBe('')
  })

  it('hydrates query and status from a deep link', () => {
    renderBar('/board/b1?q=docs&f=completed')

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(useBoardStore.getState().query).toBe('docs')
    expect(useBoardStore.getState().filterStatus).toBe('Completed')
    expect(useBoardStore.getState().getFilteredTasks().map((t) => t._id)).toEqual(['t2'])
    expect(screen.getByTestId('location-search')).toHaveTextContent('?q=docs&f=completed')
  })

  it('canonicalizes alias status keys from the URL', () => {
    renderBar('/board/b1?f=progress')
    expect(useBoardStore.getState().filterStatus).toBe('In Progress')
    expect(screen.getByTestId('location-search').textContent).toBe('?f=in-progress')
  })

  it('drops unknown status keys without filtering', () => {
    renderBar('/board/b1?f=nonsense')
    expect(useBoardStore.getState().filterStatus).toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByTestId('location-search').textContent).toBe('')
  })

  it('shows the no-results state with a working clear action', () => {
    renderBar()
    const input = openBar()
    typeQuery(input, 'zzz')

    expect(screen.getByText('0 tasks match')).toBeInTheDocument()
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(screen.getByText('No tasks match')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(useBoardStore.getState().query).toBe('')
    expect(screen.queryByText('No tasks match')).not.toBeInTheDocument()
  })
})

describe('CommandBar — BoardPage integration', () => {
  it('renders only matched tasks and shrinks column counts', () => {
    useBoardStore.setState({
      board: baseBoard,
      isLoading: false,
      error: null,
      query: '',
      filterStatus: null,
    })
    const router = createMemoryRouter(
      [{ path: '/board/:boardId', element: <BoardPage /> }],
      { initialEntries: ['/board/b1'] }
    )
    render(<RouterProvider router={router} />)

    expect(screen.getByText('Fix login bug')).toBeInTheDocument()

    act(() => {
      useBoardStore.getState().setSearchQuery('docs')
    })
    expect(screen.queryByText('Fix login bug')).not.toBeInTheDocument()
    expect(screen.getByText('Write docs')).toBeInTheDocument()

    act(() => {
      useBoardStore.getState().setFilterStatus('Completed')
    })
    expect(screen.getByText('Write docs')).toBeInTheDocument()
  })
})
