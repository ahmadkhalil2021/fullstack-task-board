// __tests__/add-task.test.jsx — Tests for the "Add new task" flow on BoardPage

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import BoardPage from '../pages/BoardPage'
import { useBoardStore } from '../store/useBoardStore'
import * as api from '../lib/api.js'

vi.mock('../lib/api.js', () => ({
  fetchBoard: vi.fn(),
  createBoard: vi.fn(),
  updateBoard: vi.fn(),
  updateTask: vi.fn(),
  updateTaskOrder: vi.fn(),
  deleteTask: vi.fn(),
  createTask: vi.fn(),
}))

const BOARD_ID = 'board-123'

const makeBoard = (overrides = {}) => ({
  _id: BOARD_ID,
  name: 'Test Board',
  description: '',
  statuses: ['Backlog', 'Ready', 'In progress'],
  tasks: [
    { _id: 't1', name: 'Task 1', description: '', icon: '⏰', status: 'Backlog', order: 0 },
    { _id: 't2', name: 'Task 2', description: '', icon: '🚀', status: 'Backlog', order: 1 },
    { _id: 't3', name: 'Task 3', description: '', icon: '⭐', status: 'Ready', order: 0 },
  ],
  ...overrides,
})

const createdTask = {
  _id: 'new-task',
  name: 'New Task',
  description: '',
  icon: '⏰',
  status: 'Backlog',
  order: -1,
}

const renderBoard = () =>
  render(
    <MemoryRouter initialEntries={[`/board/${BOARD_ID}`]}>
      <Routes>
        <Route path="/board/:boardId" element={<BoardPage />} />
      </Routes>
    </MemoryRouter>
  )

beforeEach(() => {
  vi.clearAllMocks()
  useBoardStore.setState({ board: null, isLoading: false, error: null })
})

describe('Add new task', () => {
  it('renders the button in the first column', () => {
    useBoardStore.setState({ board: makeBoard(), isLoading: false, error: null })
    renderBoard()
    expect(screen.getByRole('button', { name: '+ Add new task' })).toBeInTheDocument()
  })

  it('does not render the button in other columns', () => {
    useBoardStore.setState({ board: makeBoard(), isLoading: false, error: null })
    renderBoard()
    expect(screen.getAllByText('+ Add new task')).toHaveLength(1)
  })

  it('creates a task with parentBoardId and the first column status', async () => {
    const user = userEvent.setup()
    api.createTask.mockResolvedValue(createdTask)
    useBoardStore.setState({ board: makeBoard(), isLoading: false, error: null })
    renderBoard()

    await user.click(screen.getByRole('button', { name: '+ Add new task' }))

    await waitFor(() => {
      expect(api.createTask).toHaveBeenCalledWith(
        expect.objectContaining({ parentBoardId: BOARD_ID, status: 'Backlog' })
      )
    })
  })

  it('places the new task at the top with order = min(existing) - 1', async () => {
    const user = userEvent.setup()
    api.createTask.mockResolvedValue(createdTask)
    useBoardStore.setState({ board: makeBoard(), isLoading: false, error: null })
    renderBoard()

    await user.click(screen.getByRole('button', { name: '+ Add new task' }))

    await waitFor(() => {
      expect(api.createTask).toHaveBeenCalledWith(expect.objectContaining({ order: -1 }))
    })
    const board = useBoardStore.getState().board
    const backlog = board.tasks
      .filter((t) => t.status === 'Backlog')
      .sort((a, b) => a.order - b.order)
    expect(backlog[0]._id).toBe('new-task')
  })

  it('defaults the order to 0 when the column is empty', async () => {
    const user = userEvent.setup()
    api.createTask.mockResolvedValue({ ...createdTask, order: 0 })
    useBoardStore.setState({ board: makeBoard({ tasks: [] }), isLoading: false, error: null })
    renderBoard()

    await user.click(screen.getByRole('button', { name: '+ Add new task' }))

    await waitFor(() => {
      expect(api.createTask).toHaveBeenCalledWith(expect.objectContaining({ order: 0 }))
    })
  })

  it('opens the TaskForm modal with the name input focused', async () => {
    const user = userEvent.setup()
    api.createTask.mockResolvedValue(createdTask)
    useBoardStore.setState({ board: makeBoard(), isLoading: false, error: null })
    renderBoard()

    await user.click(screen.getByRole('button', { name: '+ Add new task' }))

    await waitFor(() => {
      expect(screen.getByDisplayValue('New Task')).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByDisplayValue('New Task'))
    })
  })

  it('rolls back the store and does not open the modal on API error', async () => {
    const user = userEvent.setup()
    api.createTask.mockRejectedValue(new Error('Create failed'))
    useBoardStore.setState({ board: makeBoard(), isLoading: false, error: null })
    renderBoard()

    await user.click(screen.getByRole('button', { name: '+ Add new task' }))

    await waitFor(() => {
      expect(useBoardStore.getState().board.tasks).toHaveLength(3)
    })
    expect(useBoardStore.getState().error).toBe('Create failed')
    expect(screen.queryByDisplayValue('New Task')).not.toBeInTheDocument()
  })

  it('guards against double-clicks — createTask is called once', () => {
    // Never resolve so `hasStarted` stays true across both synchronous clicks.
    api.createTask.mockImplementation(() => new Promise(() => {}))
    useBoardStore.setState({ board: makeBoard(), isLoading: false, error: null })
    renderBoard()

    const button = screen.getByRole('button', { name: '+ Add new task' })
    fireEvent.click(button)
    fireEvent.click(button)

    expect(api.createTask).toHaveBeenCalledTimes(1)
  })

  it('throws when no board is loaded', async () => {
    useBoardStore.setState({ board: null, isLoading: false, error: null })
    await expect(useBoardStore.getState().addTask('Backlog')).rejects.toThrow('No board loaded')
  })
})
