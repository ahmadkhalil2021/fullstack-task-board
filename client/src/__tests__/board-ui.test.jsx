// __tests__/board-ui.test.jsx — Tests for the new UI components

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useBoardStore } from '../store/useBoardStore.js'
import BoardHeader from '../components/BoardHeader.jsx'
import Column from '../components/Column.jsx'
import TaskCard from '../components/TaskCard.jsx'
import TaskForm from '../components/TaskForm.jsx'
import EmptyBoard from '../components/EmptyBoard.jsx'

// Mock the api module so optimistic update tests don't hit the real network
vi.mock('../lib/api.js', () => ({
  fetchBoard: vi.fn(),
  createBoard: vi.fn(),
  updateBoard: vi.fn(),
  updateTask: vi.fn().mockResolvedValue({ _id: 'mock', name: 'updated' }),
  deleteTask: vi.fn().mockResolvedValue({ message: 'deleted' }),
  createTask: vi.fn().mockResolvedValue({ _id: 'mock' }),
}))

// Reset the store and clear mocks before each test
beforeEach(() => {
  vi.clearAllMocks()
  useBoardStore.setState({
    board: null,
    isLoading: false,
    error: null,
  })
})

describe('TaskCard', () => {
  it('renders task icon, name, and description', () => {
    const task = { _id: '1', name: 'Test task', description: 'A test', icon: '🚀', status: 'A' }
    render(<TaskCard task={task} onClick={() => {}} />)
    expect(screen.getByText('Test task')).toBeInTheDocument()
    expect(screen.getByText('A test')).toBeInTheDocument()
    expect(screen.getByText('🚀')).toBeInTheDocument()
  })

  it('omits description paragraph when empty', () => {
    const task = { _id: '1', name: 'No desc', description: '', icon: '⏰', status: 'A' }
    render(<TaskCard task={task} onClick={() => {}} />)
    expect(screen.getByText('No desc')).toBeInTheDocument()
    expect(screen.queryByText(/A test/)).not.toBeInTheDocument()
  })

  it('calls onClick with the task when clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    const task = { _id: 't1', name: 'Clickable', description: '', icon: '⏰', status: 'A' }
    render(<TaskCard task={task} onClick={onClick} />)
    await user.click(screen.getByText('Clickable'))
    expect(onClick).toHaveBeenCalledWith(task)
  })
})

describe('TaskForm', () => {
  const baseTask = { _id: 't1', name: 'Edit me', description: 'Desc', icon: '🚀', status: 'A' }

  beforeEach(() => {
    useBoardStore.setState({
      board: { _id: 'b1', statuses: ['A', 'B', 'C'], tasks: [baseTask] },
    })
  })

  it('renders the task fields', () => {
    render(<TaskForm task={baseTask} onClose={vi.fn()} />)
    expect(screen.getByDisplayValue('Edit me')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Desc')).toBeInTheDocument()
    expect(screen.getByDisplayValue('A')).toBeInTheDocument()
  })

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<TaskForm task={baseTask} onClose={onClose} />)
    await user.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when the backdrop is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<TaskForm task={baseTask} onClose={onClose} />)
    // The backdrop is the outer fixed div
    const backdrop = document.querySelector('.fixed.inset-0')
    await user.click(backdrop)
    expect(onClose).toHaveBeenCalled()
  })

  it('saves changes when Save is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const { updateTask: mockUpdate } = await import('../lib/api.js')
    mockUpdate.mockImplementation((id, data) => Promise.resolve({ _id: id, ...baseTask, ...data }))
    render(<TaskForm task={baseTask} onClose={onClose} />)
    const nameInput = screen.getByDisplayValue('Edit me')
    await user.clear(nameInput)
    await user.type(nameInput, 'Edited')
    await user.click(screen.getByText('Save'))
    const updated = useBoardStore.getState().board.tasks[0]
    expect(updated.name).toBe('Edited')
    expect(onClose).toHaveBeenCalled()
  })

  it('disables Save when no changes have been made', () => {
    render(<TaskForm task={baseTask} onClose={vi.fn()} />)
    expect(screen.getByText('Save')).toBeDisabled()
  })

  it('disables Save when name is empty', async () => {
    const user = userEvent.setup()
    render(<TaskForm task={baseTask} onClose={vi.fn()} />)
    const nameInput = screen.getByDisplayValue('Edit me')
    await user.clear(nameInput)
    expect(screen.getByText('Save')).toBeDisabled()
  })
})

describe('Column', () => {
  it('renders status name and task count', () => {
    const tasks = [
      { _id: '1', name: 'A1', description: '', icon: '⏰', status: 'In Progress' },
      { _id: '2', name: 'A2', description: '', icon: '🚀', status: 'In Progress' },
    ]
    render(<Column status="In Progress" tasks={tasks} onTaskClick={() => {}} />)
    expect(screen.getByRole('heading', { name: 'In Progress' })).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('renders 0 count when no tasks', () => {
    render(<Column status="Empty" tasks={[]} />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })
})

describe('BoardHeader', () => {
  it('renders the board name and description', () => {
    useBoardStore.setState({
      board: { _id: 'b1', name: 'My Board', description: 'A test', statuses: [], tasks: [] },
    })
    render(<BoardHeader />)
    expect(screen.getByDisplayValue('My Board')).toBeInTheDocument()
    expect(screen.getByDisplayValue('A test')).toBeInTheDocument()
  })

  it('lets the user edit the name (local state only, no persistence)', async () => {
    const user = userEvent.setup()
    useBoardStore.setState({
      board: { _id: 'b1', name: 'Original', description: '', statuses: [], tasks: [] },
    })
    render(<BoardHeader />)
    const nameInput = screen.getByDisplayValue('Original')
    await user.clear(nameInput)
    await user.type(nameInput, 'Edited')
    expect(nameInput).toHaveValue('Edited')
  })
})

describe('EmptyBoard', () => {
  it('shows the default message', () => {
    render(<EmptyBoard />)
    expect(screen.getByText('No board loaded')).toBeInTheDocument()
  })

  it('shows a custom message', () => {
    render(<EmptyBoard message="Loading..." />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })
})
