// __tests__/board-ui.test.jsx — Tests for the new UI components

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useBoardStore } from '../store/useBoardStore.js'
import BoardHeader from '../components/BoardHeader.jsx'
import Column from '../components/Column.jsx'
import TaskCard from '../components/TaskCard.jsx'
import EmptyBoard from '../components/EmptyBoard.jsx'

// Reset the store before each test
beforeEach(() => {
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
})

describe('Column', () => {
  it('renders status name and task count', () => {
    const tasks = [
      { _id: '1', name: 'A1', description: '', icon: '⏰', status: 'In Progress' },
      { _id: '2', name: 'A2', description: '', icon: '🚀', status: 'In Progress' },
    ]
    render(<Column status="In Progress" tasks={tasks} />)
    expect(screen.getByText('In Progress')).toBeInTheDocument()
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
