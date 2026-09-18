// __tests__/table-view.test.jsx — Sortable table: headers, aria-sort, persistence, filter.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import * as api from '../lib/api.js'
import TableView from '../views/TableView.jsx'
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
    makeTask({ _id: 't1', name: 'Alpha', status: 'In Progress', createdAt: ago(3), updatedAt: ago(1) }),
    makeTask({ _id: 't2', name: 'Beta', status: 'Completed', createdAt: ago(2), updatedAt: ago(2) }),
    makeTask({ _id: 't3', name: 'Gamma', status: 'In Progress', createdAt: ago(1), updatedAt: ago(3) }),
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

const renderTable = (onTaskClick = vi.fn(), board = baseBoard) => {
  resetStore(board)
  return {
    onTaskClick,
    ...render(<TableView onTaskClick={onTaskClick} />),
  }
}

const rowNames = () =>
  screen.getAllByText(/^(Alpha|Beta|Gamma)$/).map((node) => node.textContent)

const renderBoardPage = (entry = '/board/b1/table') => {
  resetStore()
  const router = createMemoryRouter(
    [
      { path: '/board/:boardId', element: <BoardPage /> },
      { path: '/board/:boardId/table', element: <BoardPage /> },
    ],
    { initialEntries: [entry] }
  )
  return render(<RouterProvider router={router} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  api.fetchActivity.mockResolvedValue({ activities: [], hasMore: false })
})

describe('TableView — rendering', () => {
  it('renders the sortable column headers and rows', () => {
    renderTable()
    expect(screen.getByRole('columnheader', { name: /Name/ })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Status/ })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Created/ })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Updated/ })).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(4)
  })

  it('shows status badges and relative timestamps', () => {
    renderTable()
    expect(screen.getAllByText('In Progress')).toHaveLength(2)
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getAllByText(/hour(s)? ago$/)).toHaveLength(6)
  })

  it('shows an empty message for a board without tasks', () => {
    renderTable(vi.fn(), { ...baseBoard, tasks: [] })
    expect(screen.getByText('No tasks yet')).toBeInTheDocument()
  })
})

describe('TableView — sorting', () => {
  it('sorts by Created descending by default', () => {
    renderTable()
    expect(rowNames()).toEqual(['Gamma', 'Beta', 'Alpha'])
    expect(screen.getByRole('columnheader', { name: /Created/ })).toHaveAttribute(
      'aria-sort',
      'descending'
    )
  })

  it('starts ascending when another column is clicked and toggles on repeat', () => {
    renderTable()
    fireEvent.click(screen.getByRole('button', { name: 'Name' }))
    expect(rowNames()).toEqual(['Alpha', 'Beta', 'Gamma'])
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'ascending')

    fireEvent.click(screen.getByRole('button', { name: 'Name' }))
    expect(rowNames()).toEqual(['Gamma', 'Beta', 'Alpha'])
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'descending')
  })

  it('marks inactive headers with aria-sort none', () => {
    renderTable()
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'none')
    expect(screen.getByRole('columnheader', { name: /Status/ })).toHaveAttribute('aria-sort', 'none')
  })

  it('persists the sort per board in sessionStorage and restores it', () => {
    const first = renderTable()
    fireEvent.click(screen.getByRole('button', { name: 'Status' }))
    expect(sessionStorage.getItem('board-view-table:b1')).toBe(
      JSON.stringify({ key: 'status', dir: 'asc' })
    )
    first.unmount()

    renderTable()
    expect(screen.getByRole('columnheader', { name: /Status/ })).toHaveAttribute('aria-sort', 'ascending')
    expect(screen.getByRole('columnheader', { name: /Created/ })).toHaveAttribute('aria-sort', 'none')
  })

  it('falls back to the default sort for invalid stored values', () => {
    sessionStorage.setItem('board-view-table:b1', JSON.stringify({ key: 'bogus', dir: 'up' }))
    renderTable()
    expect(screen.getByRole('columnheader', { name: /Created/ })).toHaveAttribute(
      'aria-sort',
      'descending'
    )
  })
})

describe('TableView — filter and navigation', () => {
  it('narrows rows through the shared store filter', () => {
    renderTable()
    act(() => {
      useBoardStore.getState().setSearchQuery('Beta')
    })
    expect(rowNames()).toEqual(['Beta'])
  })

  it('calls onTaskClick when a row is clicked', () => {
    const { onTaskClick } = renderTable()
    fireEvent.click(screen.getByText('Alpha').closest('tr'))
    expect(onTaskClick).toHaveBeenCalledWith(expect.objectContaining({ _id: 't1' }))
  })

  it('opens a task with Enter on a focused row', () => {
    const { onTaskClick } = renderTable()
    fireEvent.keyDown(screen.getByText('Beta').closest('tr'), { key: 'Enter' })
    expect(onTaskClick).toHaveBeenCalledWith(expect.objectContaining({ _id: 't2' }))
  })

  it('renders as the active view on the table route', () => {
    renderBoardPage()
    expect(screen.getByRole('link', { name: 'Table' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('columnheader', { name: /Name/ })).toBeInTheDocument()
  })
})
