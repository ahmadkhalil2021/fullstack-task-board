// __tests__/home-page.test.jsx — Tests for the auto-create board flow on HomePage

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import HomePage from '../pages/HomePage.jsx'
import { useBoardStore } from '../store/useBoardStore.js'

// Spy on useNavigate so we can assert the redirect target and `replace: true`.
const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }))
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('../lib/api.js', () => ({
  fetchBoard: vi.fn(),
  createBoard: vi.fn(),
  updateBoard: vi.fn(),
  updateTask: vi.fn(),
  updateTaskOrder: vi.fn(),
  deleteTask: vi.fn(),
  createTask: vi.fn(),
}))

const renderHome = (strict = false) => {
  const router = createMemoryRouter(
    [{ path: '/', element: <HomePage /> }],
    { initialEntries: ['/'] }
  )
  const tree = <RouterProvider router={router} />
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree)
}

beforeEach(() => {
  vi.clearAllMocks()
  useBoardStore.setState({ board: null, isLoading: false, error: null })
})

describe('HomePage', () => {
  it('shows the loading state while the board is being created', async () => {
    const { createBoard } = await import('../lib/api.js')
    createBoard.mockReturnValue(new Promise(() => {}))
    renderHome()
    expect(screen.getByText(/creating your board/i)).toBeInTheDocument()
  })

  it('redirects to the new board on success', async () => {
    const { createBoard } = await import('../lib/api.js')
    createBoard.mockResolvedValue({ _id: 'board-123', name: 'New Board', statuses: [], tasks: [] })
    renderHome()
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/board/board-123', { replace: true })
    })
  })

  it('shows the error message and a Try again button on failure', async () => {
    const { createBoard } = await import('../lib/api.js')
    createBoard.mockRejectedValue(new Error('Board creation failed'))
    renderHome()
    expect(await screen.findByText('Board creation failed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('retries when Try again is clicked', async () => {
    const user = userEvent.setup()
    const { createBoard } = await import('../lib/api.js')
    createBoard
      .mockRejectedValueOnce(new Error('Board creation failed'))
      .mockResolvedValueOnce({ _id: 'board-456', name: 'Retry Board', statuses: [], tasks: [] })
    renderHome()
    await user.click(await screen.findByRole('button', { name: 'Try again' }))
    await waitFor(() => {
      expect(createBoard).toHaveBeenCalledTimes(2)
      expect(navigateMock).toHaveBeenCalledWith('/board/board-456', { replace: true })
    })
  })

  it('creates the board exactly once under StrictMode', async () => {
    const { createBoard } = await import('../lib/api.js')
    createBoard.mockResolvedValue({ _id: 'board-789', name: 'Strict Board', statuses: [], tasks: [] })
    renderHome(true)
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/board/board-789', { replace: true })
    })
    expect(createBoard).toHaveBeenCalledTimes(1)
  })
})
