// __tests__/error-banner.test.jsx — Tests for the global error banner on BoardPage
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BoardPage from '../pages/BoardPage.jsx'
import { useBoardStore } from '../store/useBoardStore.js'

vi.mock('react-router-dom', () => ({
  useParams: () => ({ boardId: 'board-1' }),
}))

vi.mock('../lib/api.js', () => ({
  fetchBoard: vi.fn(),
  createBoard: vi.fn(),
  updateBoard: vi.fn(),
  updateTask: vi.fn(),
  updateTaskOrder: vi.fn(),
  deleteTask: vi.fn(),
  createTask: vi.fn(),
}))

// _id matches the mocked useParams so BoardPage skips the initial fetchBoard,
// which would otherwise clear the error we want to assert on.
const board = { _id: 'board-1', name: 'Test Board', description: '', statuses: [], tasks: [] }

beforeEach(() => {
  vi.clearAllMocks()
  useBoardStore.setState({ board, isLoading: false, error: 'Something went wrong' })
})

describe('BoardPage error banner', () => {
  it('renders the banner when the store has an error', () => {
    render(<BoardPage />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('dismissing the banner clears the error', async () => {
    const user = userEvent.setup()
    render(<BoardPage />)

    await user.click(screen.getByRole('button', { name: 'Dismiss error' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
