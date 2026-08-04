// __tests__/routing.test.jsx — Smoke tests for the React Router setup
// We render the App at known URLs and check that the right page shows.

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import HomePage from '../pages/HomePage.jsx'
import BoardPage from '../pages/BoardPage.jsx'
import NotFoundPage from '../pages/NotFoundPage.jsx'
import { useBoardStore } from '../store/useBoardStore.js'

// Reset the store before each test so no state leaks between tests
beforeEach(() => {
  useBoardStore.setState({
    board: null,
    isLoading: false,
    error: null,
  })
})

// Helper: build a memory router at a given initial path
const renderAt = (path) => {
  const router = createMemoryRouter(
    [
      { path: '/', element: <HomePage /> },
      { path: '/board/:boardId', element: <BoardPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
    { initialEntries: [path] }
  )
  return render(<RouterProvider router={router} />)
}

describe('routing', () => {
  it('renders HomePage at /', async () => {
    renderAt('/')
    expect(await screen.findByText(/loading board/i)).toBeInTheDocument()
  })

  it('renders BoardPage at /board/:boardId when board is loaded', () => {
    // Pre-populate the store so BoardPage doesn't try to fetch
    useBoardStore.setState({
      board: {
        _id: 'abc-123',
        name: 'Test Board',
        description: '',
        statuses: ['A', 'B'],
        tasks: [
          { _id: 't1', name: 'T1', description: '', icon: '⏰', status: 'A' },
        ],
      },
    })
    renderAt('/board/abc-123')
    expect(screen.getByDisplayValue('Test Board')).toBeInTheDocument()
  })

  it('renders NotFoundPage for unknown paths', () => {
    renderAt('/some/random/path')
    expect(screen.getByText('404')).toBeInTheDocument()
    expect(screen.getByText(/page not found/i)).toBeInTheDocument()
  })
})

describe('Zustand store skeleton', () => {
  it('starts with empty state', () => {
    const state = useBoardStore.getState()
    expect(state.board).toBeNull()
    expect(state.isLoading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('exposes the expected actions', () => {
    const state = useBoardStore.getState()
    expect(typeof state.fetchBoard).toBe('function')
    expect(typeof state.createBoard).toBe('function')
    expect(typeof state.updateBoard).toBe('function')
    expect(typeof state.updateTask).toBe('function')
    expect(typeof state.deleteTask).toBe('function')
    expect(typeof state.addTask).toBe('function')
  })
})
