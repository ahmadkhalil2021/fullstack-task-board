// __tests__/board-ui.test.jsx — Tests for the new UI components

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useBoardStore } from '../store/useBoardStore.js'
import BoardHeader from '../components/BoardHeader.jsx'
import Column from '../components/Column.jsx'
import TaskCard from '../components/TaskCard.jsx'
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
    render(<TaskCard task={task} />)
    expect(screen.getByText('Test task')).toBeInTheDocument()
    expect(screen.getByText('A test')).toBeInTheDocument()
    expect(screen.getByText('🚀')).toBeInTheDocument()
  })

  it('omits description paragraph when empty', () => {
    const task = { _id: '1', name: 'No desc', description: '', icon: '⏰', status: 'A' }
    render(<TaskCard task={task} />)
    expect(screen.getByText('No desc')).toBeInTheDocument()
    expect(screen.queryByText(/A test/)).not.toBeInTheDocument()
  })

  it('enters edit mode when name is clicked', async () => {
    const user = userEvent.setup()
    const task = { _id: '1', name: 'Click me', description: '', icon: '⏰', status: 'A' }
    useBoardStore.setState({ board: { _id: 'b1', statuses: ['A', 'B'], tasks: [] } })
    render(<TaskCard task={task} />)
    await user.click(screen.getByText('Click me'))
    expect(screen.getByDisplayValue('Click me')).toBeInTheDocument()
  })

  it('saves name on Enter', async () => {
    const user = userEvent.setup()
    const task = { _id: 't1', name: 'Old', description: '', icon: '⏰', status: 'A' }
    // Mock returns the same data the UI sent (realistic API behavior)
    const { updateTask: mockUpdate } = await import('../lib/api.js')
    mockUpdate.mockImplementation((id, data) => Promise.resolve({ _id: id, ...data, description: '', icon: '⏰', status: 'A' }))
    useBoardStore.setState({
      board: { _id: 'b1', statuses: ['A', 'B'], tasks: [task] },
    })
    render(<TaskCard task={task} />)
    await user.click(screen.getByText('Old'))
    const input = screen.getByDisplayValue('Old')
    await user.clear(input)
    await user.type(input, 'New name{enter}')
    // After the API response, the store should have the new name
    const updated = useBoardStore.getState().board.tasks[0]
    expect(updated.name).toBe('New name')
  })
})

describe('Column', () => {
  it('renders status name and task count', () => {
    const tasks = [
      { _id: '1', name: 'A1', description: '', icon: '⏰', status: 'In Progress' },
      { _id: '2', name: 'A2', description: '', icon: '🚀', status: 'In Progress' },
    ]
    // Pre-populate the store so the TaskCard status button can read it
    useBoardStore.setState({ board: { _id: 'b1', statuses: ['In Progress', 'Done'], tasks: [] } })
    render(<Column status="In Progress" tasks={tasks} />)
    // The status appears in <h2> (column header) and in TaskCard status buttons.
    // Use a heading-specific query to avoid ambiguity.
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
