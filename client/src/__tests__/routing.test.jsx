// __tests__/routing.test.jsx — Smoke tests for the React Router setup
// We render the App at known URLs and check that the right page shows.

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import HomePage from '../pages/HomePage.jsx'
import BoardPage from '../pages/BoardPage.jsx'
import NotFoundPage from '../pages/NotFoundPage.jsx'

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
  it('renders HomePage at /', () => {
    renderAt('/')
    expect(screen.getByText(/loading board/i)).toBeInTheDocument()
  })

  it('renders BoardPage at /board/:boardId and reads the id from params', () => {
    renderAt('/board/abc-123')
    expect(screen.getByText('Board')).toBeInTheDocument()
    expect(screen.getByText('ID: abc-123')).toBeInTheDocument()
  })

  it('renders NotFoundPage for unknown paths', () => {
    renderAt('/some/random/path')
    expect(screen.getByText('404')).toBeInTheDocument()
    expect(screen.getByText(/page not found/i)).toBeInTheDocument()
  })
})

describe('Zustand store skeleton', () => {
  it('starts with empty state', async () => {
    const { useBoardStore } = await import('../store/useBoardStore.js')
    const state = useBoardStore.getState()
    expect(state.board).toBeNull()
    expect(state.isLoading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('exposes the expected actions', async () => {
    const { useBoardStore } = await import('../store/useBoardStore.js')
    const state = useBoardStore.getState()
    expect(typeof state.fetchBoard).toBe('function')
    expect(typeof state.createBoard).toBe('function')
    expect(typeof state.updateBoard).toBe('function')
    expect(typeof state.updateTask).toBe('function')
    expect(typeof state.deleteTask).toBe('function')
    expect(typeof state.addTask).toBe('function')
  })
})
