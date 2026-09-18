// __tests__/list-view.test.jsx — Flat table, sorting, filter and navigation integration.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within, fireEvent, act } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import * as api from '../lib/api.js'
import ListView from '../views/ListView.jsx'
import BoardPage from '../pages/BoardPage.jsx'
import { useBoardStore } from '../store/useBoardStore.js'

vi.mock('../lib/api.js', () => ({
  fetchBoard: vi.fn(),
  createBoard: vi.fn(),
  updateBoard: vi.fn(),
  updateTask: vi.fn(),
  updateTaskOrder: vi.fn(),
  deleteTask: vi.fn(),
  createTask: vi.fn(),
  fetchActivity: vi.fn(),
}))

const TWO_HOURS_AGO = new Date(Date.now() - 2 * 3600 * 1000).toISOString()

const makeTask = (overrides = {}) => ({
  _id: 't1',
  name: 'Task',
  description: '',
  icon: '⏰',
  status: 'In Progress',
  order: 0,
  createdAt: TWO_HOURS_AGO,
  updatedAt: TWO_HOURS_AGO,
  ...overrides,
})

// Statuses are intentionally non-alphabetical to prove board order is kept.
const baseBoard = {
  _id: 'b1',
  name: 'Test Board',
  description: '',
  statuses: ['Blocked', 'In Progress', 'Completed'],
  tasks: [
    makeTask({ _id: 't2', name: 'Blocked B', status: 'Blocked', order: 0 }),
    makeTask({ _id: 't1', name: 'Doing A', status: 'In Progress', order: 1 }),
    makeTask({ _id: 't4', name: 'Doing A2', status: 'In Progress', order: 0 }),
    makeTask({ _id: 't3', name: 'Done C', status: 'Completed', order: 0 }),
  ],
}

const resetStore = (board = baseBoard) => {
  useBoardStore.setState({
    board,
    isLoading: false,
    error: null,
    query: '',
    filterStatus: null,
    activity: [],
    activityLoading: false,
    activityError: null,
  })
}

const renderList = (onTaskClick = vi.fn()) => {
  resetStore()
  render(<ListView onTaskClick={onTaskClick} />)
  return onTaskClick
}

const renderBoardPage = (entry = '/board/b1/list') => {
  resetStore()
  const router = createMemoryRouter(
    [
      { path: '/board/:boardId', element: <BoardPage /> },
      { path: '/board/:boardId/list', element: <BoardPage /> },
      { path: '/board/:boardId/task/:taskId', element: <div>TASK PAGE</div> },
    ],
    { initialEntries: [entry] }
  )
  return render(<RouterProvider router={router} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  api.fetchActivity.mockResolvedValue({ activities: [], hasMore: false })
})

describe('ListView — flat Odoo-style table', () => {
  it('renders a flat list sorted by board status order, then order', () => {
    renderList()
    const names = screen
      .getAllByText(/Blocked B|Doing A2|Doing A|Done C/)
      .map((node) => node.textContent)
    expect(names).toEqual(['Blocked B', 'Doing A2', 'Doing A', 'Done C'])
  })

  it('renders no status group headers', () => {
    renderList()
    expect(screen.queryByRole('button', { name: /^In Progress/ })).not.toBeInTheDocument()
    expect(document.querySelector('[id^="list-section-"]')).toBeNull()
  })

  it('shows icon, name, status, relative time and a row affordance', () => {
    renderList()
    expect(screen.getByText('Doing A').closest('button')).toHaveAccessibleName('Doing A')
    expect(screen.getAllByText(/^Updated .* ago$/)).toHaveLength(4)
    expect(screen.getAllByText('⏰')).toHaveLength(4)
    expect(screen.getByRole('columnheader', { name: 'Task' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Updated' })).toBeInTheDocument()
    expect(within(screen.getByText('Doing A').closest('tr')).getByText('In Progress')).toBeInTheDocument()
  })

  it('keeps the add-a-line row for empty boards', () => {
    resetStore({ ...baseBoard, tasks: [] })
    render(<ListView onTaskClick={vi.fn()} />)

    expect(screen.getByText('No tasks yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Add a line' })).toBeInTheDocument()
  })

  it('calls onTaskClick once whether the name or the row is clicked', () => {
    const onTaskClick = renderList()
    fireEvent.click(screen.getByText('Doing A'))
    expect(onTaskClick).toHaveBeenCalledTimes(1)
    expect(onTaskClick).toHaveBeenCalledWith(expect.objectContaining({ _id: 't1' }))

    fireEvent.click(screen.getAllByText(/^Updated .* ago$/)[0])
    expect(onTaskClick).toHaveBeenCalledTimes(2)
  })
})

describe('ListView — filter integration', () => {
  it('narrows rows through the shared store filter', () => {
    renderList()
    act(() => {
      useBoardStore.getState().setSearchQuery('Blocked')
    })

    expect(screen.getByText('Blocked B')).toBeInTheDocument()
    expect(screen.queryByText('Doing A')).not.toBeInTheDocument()
    expect(screen.queryByText('Done C')).not.toBeInTheDocument()
  })

  it('shows the shared no-results banner and clears it from BoardPage', () => {
    renderBoardPage()
    act(() => {
      useBoardStore.getState().setSearchQuery('zzz')
    })

    expect(screen.getByText('No tasks match')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.queryByText('No tasks match')).not.toBeInTheDocument()
    expect(screen.getByText('Doing A')).toBeInTheDocument()
  })
})

describe('ListView — add and navigation integration', () => {
  it('creates a task in the first status and opens its detail page', async () => {
    const created = makeTask({ _id: 'new-1', name: 'New Task', status: 'Blocked', order: -1 })
    api.createTask.mockResolvedValue(created)
    renderBoardPage()

    fireEvent.click(screen.getByRole('button', { name: '+ Add a line' }))

    expect(await screen.findByText('TASK PAGE')).toBeInTheDocument()
    expect(api.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Blocked', parentBoardId: 'b1' })
    )
  })

  it('navigates to the task detail page when a row is clicked', () => {
    renderBoardPage()
    fireEvent.click(screen.getByText('Doing A'))
    expect(screen.getByText('TASK PAGE')).toBeInTheDocument()
  })
})
