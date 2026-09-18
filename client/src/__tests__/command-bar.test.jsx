// __tests__/command-bar.test.jsx — Odoo-style search bar behavior (Issue #25).

import { describe, it, expect, beforeEach } from 'vitest'
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

const resetStore = (board = baseBoard) => {
  useBoardStore.setState({
    board,
    isLoading: false,
    error: null,
    query: '',
    filterStatus: null,
  })
}

const getInput = () => screen.getByRole('combobox', { name: 'Search tasks' })

const openBar = () => {
  const input = getInput()
  if (document.activeElement === input) fireEvent.click(input)
  else act(() => input.focus())
  return input
}

const renderBar = (initialEntry = '/board/b1', board = baseBoard) => {
  resetStore(board)
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <CommandBar />
      <LocationProbe />
    </MemoryRouter>
  )
}

const renderBoardPage = () => {
  resetStore()
  const router = createMemoryRouter(
    [{ path: '/board/:boardId', element: <BoardPage /> }],
    { initialEntries: ['/board/b1'] }
  )
  return render(<RouterProvider router={router} />)
}

beforeEach(() => {
  resetStore()
})

describe('CommandBar — opening and closing', () => {
  it('renders an always-visible combobox without a dropdown', () => {
    renderBar()
    expect(getInput()).toHaveAttribute('placeholder', 'Search...')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('opens the filter dropdown on focus', () => {
    renderBar()
    openBar()
    expect(screen.getByRole('listbox', { name: 'Search suggestions' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /^Completed/ })).toBeInTheDocument()
  })

  it('opens and focuses the input on Ctrl+K', () => {
    renderBar()
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(getInput()).toHaveFocus()
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('opens and focuses the input on Meta+K', () => {
    renderBar()
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    expect(getInput()).toHaveFocus()
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('closes the dropdown on an outside click', () => {
    renderBar()
    openBar()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('Escape closes the dropdown, a second Escape clears the draft', () => {
    renderBar()
    const input = openBar()
    fireEvent.change(input, { target: { value: 'login' } })

    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(input).toHaveValue('login')

    fireEvent.keyDown(input, { key: 'Escape' })
    expect(input).toHaveValue('')
  })
})

describe('CommandBar — Odoo-style filter application', () => {
  it('applies the quick-search option as a chip on Enter', () => {
    renderBar()
    const input = openBar()
    fireEvent.change(input, { target: { value: 'login' } })

    expect(
      screen.getByRole('option', { name: /Name or description contains/i })
    ).toBeInTheDocument()

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(useBoardStore.getState().query).toBe('login')
    expect(input).toHaveValue('')
    expect(screen.getByText('Search: login')).toBeInTheDocument()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(useBoardStore.getState().getFilteredTasks().map((t) => t._id)).toEqual(['t1', 't2'])
    expect(screen.getByTestId('location-search')).toHaveTextContent('q=login')
  })

  it('applies the quick-search option on click', () => {
    renderBar()
    const input = openBar()
    fireEvent.change(input, { target: { value: 'docs' } })

    fireEvent.mouseDown(screen.getByRole('option', { name: /Name or description contains/i }))
    expect(useBoardStore.getState().query).toBe('docs')
    expect(screen.getByText('Search: docs')).toBeInTheDocument()
  })

  it('announces the matching task count to screen readers', () => {
    renderBar()
    const input = openBar()
    fireEvent.change(input, { target: { value: 'login' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(screen.getByRole('status')).toHaveTextContent('2 tasks match')
  })

  it('moves the active option with arrow keys and applies it on Enter', () => {
    renderBar()
    const input = openBar()

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(useBoardStore.getState().filterStatus).toBe('Completed')
  })

  it('toggles a status filter from the dropdown', () => {
    renderBar()
    openBar()

    fireEvent.mouseDown(screen.getByRole('option', { name: /^Completed/ }))
    expect(useBoardStore.getState().filterStatus).toBe('Completed')
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByTestId('location-search')).toHaveTextContent('f=completed')

    openBar()
    fireEvent.mouseDown(screen.getByRole('option', { name: /^Completed/ }))
    expect(useBoardStore.getState().filterStatus).toBeNull()
    expect(screen.queryByText('Completed')).not.toBeInTheDocument()
  })

  it('removes a facet chip with its remove button', () => {
    renderBar()
    openBar()
    fireEvent.mouseDown(screen.getByRole('option', { name: /^Completed/ }))

    fireEvent.click(screen.getByRole('button', { name: 'Remove filter: Completed' }))
    expect(useBoardStore.getState().filterStatus).toBeNull()
    expect(screen.getByTestId('location-search').textContent).not.toContain('f=')
  })

  it('Backspace on an empty input removes the last facet first', () => {
    renderBar()
    const input = openBar()
    fireEvent.change(input, { target: { value: 'login' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    openBar()
    fireEvent.mouseDown(screen.getByRole('option', { name: /^Completed/ }))

    fireEvent.keyDown(input, { key: 'Backspace' })
    expect(useBoardStore.getState().filterStatus).toBeNull()
    expect(useBoardStore.getState().query).toBe('login')

    fireEvent.keyDown(input, { key: 'Backspace' })
    expect(useBoardStore.getState().query).toBe('')
  })

  it('derives filter options from arbitrary board statuses with counts', () => {
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

    expect(screen.getByRole('option', { name: /^Triage/ })).toHaveTextContent('1')
    expect(screen.getByRole('option', { name: /^Doing/ })).toHaveTextContent('2')
    expect(screen.getByRole('option', { name: /^Done/ })).toHaveTextContent('0')
  })
})

describe('CommandBar — URL sync', () => {
  it('hydrates chips from a deep link without opening the dropdown', () => {
    renderBar('/board/b1?q=docs&f=completed')

    expect(useBoardStore.getState().query).toBe('docs')
    expect(useBoardStore.getState().filterStatus).toBe('Completed')
    expect(screen.getByText('Search: docs')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
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
    expect(screen.getByTestId('location-search').textContent).toBe('')
  })
})

describe('CommandBar — BoardPage integration', () => {
  it('filters tasks and shows the no-results state with a working clear action', () => {
    renderBoardPage()

    expect(screen.getByText('Fix login bug')).toBeInTheDocument()

    act(() => {
      useBoardStore.getState().setSearchQuery('docs')
    })
    expect(screen.queryByText('Fix login bug')).not.toBeInTheDocument()
    expect(screen.getByText('Write docs')).toBeInTheDocument()

    act(() => {
      useBoardStore.getState().setSearchQuery('zzz')
    })
    expect(screen.getByText('No tasks match')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(useBoardStore.getState().query).toBe('')
    expect(screen.queryByText('No tasks match')).not.toBeInTheDocument()
    expect(screen.getByText('Fix login bug')).toBeInTheDocument()
  })
})
