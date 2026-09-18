// __tests__/grid-view.test.jsx — Card wall: sorting, status badges, add flow, filter.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import * as api from '../lib/api.js'
import GridView from '../views/GridView.jsx'
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

const HOUR = 3600 * 1000
const ago = (hours) => new Date(Date.now() - hours * HOUR).toISOString()

const makeTask = (overrides = {}) => ({
  _id: 't1',
  name: 'Task',
  description: '',
  icon: '⏰',
  status: 'In Progress',
  order: 0,
  createdAt: ago(1),
  updatedAt: ago(1),
  ...overrides,
})

const baseBoard = {
  _id: 'b1',
  name: 'Test Board',
  description: '',
  statuses: ['In Progress', 'Completed'],
  tasks: [
    makeTask({ _id: 't1', name: 'Alpha', createdAt: ago(3), updatedAt: ago(3) }),
    makeTask({ _id: 't2', name: 'Beta', status: 'Completed', createdAt: ago(2), updatedAt: ago(2) }),
    makeTask({ _id: 't3', name: 'Gamma', createdAt: ago(1), updatedAt: ago(1) }),
  ],
}

const resetStore = (board = baseBoard) =>
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

const renderGrid = (onTaskClick = vi.fn(), board = baseBoard) => {
  resetStore(board)
  render(<GridView onTaskClick={onTaskClick} />)
  return onTaskClick
}

const renderBoardPage = (entry = '/board/b1/grid', board = baseBoard) => {
  resetStore(board)
  const router = createMemoryRouter(
    [
      { path: '/board/:boardId', element: <BoardPage /> },
      { path: '/board/:boardId/grid', element: <BoardPage /> },
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

describe('GridView', () => {
  it('renders one card per task', () => {
    renderGrid()
    expect(screen.getAllByText(/^(Alpha|Beta|Gamma)$/)).toHaveLength(3)
  })

  it('sorts newest tasks first', () => {
    renderGrid()
    const names = screen.getAllByText(/^(Alpha|Beta|Gamma)$/).map((node) => node.textContent)
    expect(names).toEqual(['Gamma', 'Beta', 'Alpha'])
  })

  it('puts tasks without a valid createdAt last', () => {
    renderGrid(vi.fn(), {
      ...baseBoard,
      tasks: [...baseBoard.tasks, makeTask({ _id: 't4', name: 'NoDate', createdAt: undefined })],
    })
    const names = screen.getAllByText(/^(Alpha|Beta|Gamma|NoDate)$/).map((node) => node.textContent)
    expect(names).toEqual(['Gamma', 'Beta', 'Alpha', 'NoDate'])
  })

  it('puts tasks with an invalid createdAt last', () => {
    renderGrid(vi.fn(), {
      ...baseBoard,
      tasks: [...baseBoard.tasks, makeTask({ _id: 't4', name: 'BadDate', createdAt: 'not-a-date' })],
    })
    const names = screen.getAllByText(/^(Alpha|Beta|Gamma|BadDate)$/).map((node) => node.textContent)
    expect(names).toEqual(['Gamma', 'Beta', 'Alpha', 'BadDate'])
  })

  it('breaks ties deterministically by id for equal dates', () => {
    const equal = new Date('2026-01-01T00:00:00.000Z').toISOString()
    renderGrid(vi.fn(), {
      ...baseBoard,
      tasks: [
        makeTask({ _id: 'c', name: 'Charlie', createdAt: equal }),
        makeTask({ _id: 'a', name: 'Alpha', createdAt: equal }),
        makeTask({ _id: 'b', name: 'Bravo', createdAt: equal }),
      ],
    })
    const names = screen.getAllByText(/^(Alpha|Bravo|Charlie)$/).map((node) => node.textContent)
    expect(names).toEqual(['Alpha', 'Bravo', 'Charlie'])
  })

  it('shows a status badge per card', () => {
    renderGrid()
    expect(screen.getAllByText('In Progress')).toHaveLength(2)
    expect(screen.getByText('Completed')).toBeInTheDocument()
  })

  it('offers the add button when the board has tasks', () => {
    renderGrid()
    expect(screen.getByRole('button', { name: '+ Add new task' })).toBeInTheDocument()
  })

  it('calls onTaskClick when a card is clicked', () => {
    const onTaskClick = renderGrid()
    fireEvent.click(screen.getByText('Alpha'))
    expect(onTaskClick).toHaveBeenCalledWith(expect.objectContaining({ _id: 't1' }))
  })

  it('narrows cards through the shared store filter', () => {
    renderGrid()
    act(() => {
      useBoardStore.getState().setSearchQuery('Beta')
    })
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument()
    expect(screen.queryByText('Gamma')).not.toBeInTheDocument()
  })

  it('shows the centered CTA for an empty board', () => {
    renderGrid(vi.fn(), { ...baseBoard, tasks: [] })
    expect(screen.getByText('No tasks yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add your first task' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Add new task' })).not.toBeInTheDocument()
  })

  it('creates in the first status from the top-left add button and opens the detail page', async () => {
    api.createTask.mockResolvedValue(makeTask({ _id: 'new-1', name: 'New Task' }))
    renderBoardPage()

    fireEvent.click(screen.getByRole('button', { name: '+ Add new task' }))

    expect(await screen.findByText('TASK PAGE')).toBeInTheDocument()
    expect(api.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'In Progress', parentBoardId: 'b1' })
    )
  })

  it('creates in the first status from the empty-state CTA', async () => {
    api.createTask.mockResolvedValue(makeTask({ _id: 'new-1', name: 'New Task' }))
    renderBoardPage('/board/b1/grid', { ...baseBoard, tasks: [] })

    fireEvent.click(screen.getByRole('button', { name: 'Add your first task' }))

    expect(await screen.findByText('TASK PAGE')).toBeInTheDocument()
    expect(api.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'In Progress', parentBoardId: 'b1' })
    )
  })

  it('renders as the active view on the grid route', () => {
    renderBoardPage()
    expect(screen.getByRole('link', { name: 'Grid' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('Alpha')).toBeInTheDocument()
  })
})
