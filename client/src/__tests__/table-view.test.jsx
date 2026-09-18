// __tests__/table-view.test.jsx — Sortable table: headers, aria-sort, persistence, filter, add.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
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
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => row.querySelector('td > span > span:last-child')?.textContent)

const renderBoardPage = (entry = '/board/b1/table', board = baseBoard) => {
  resetStore(board)
  const router = createMemoryRouter(
    [
      { path: '/board/:boardId', element: <BoardPage /> },
      { path: '/board/:boardId/table', element: <BoardPage /> },
      { path: '/board/:boardId/task/:taskId', element: <div>TASK PAGE</div> },
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

afterEach(() => {
  vi.restoreAllMocks()
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

  it('shows the centered CTA for an empty board', () => {
    renderTable(vi.fn(), { ...baseBoard, tasks: [] })
    expect(screen.getByText('No tasks yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add your first task' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Add new task' })).not.toBeInTheDocument()
  })

  it('offers the add button when the board has tasks', () => {
    renderTable()
    expect(screen.getByRole('button', { name: '+ Add new task' })).toBeInTheDocument()
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

  it('renders the Priority and Due date columns', () => {
    renderTable()
    expect(screen.getByRole('columnheader', { name: /Priority/ })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Due date/ })).toBeInTheDocument()
  })

  it('sorts by priority rank', () => {
    renderTable(vi.fn(), {
      ...baseBoard,
      tasks: [
        makeTask({ _id: 't1', name: 'Alpha', priority: 'high' }),
        makeTask({ _id: 't2', name: 'Beta', priority: 'none' }),
        makeTask({ _id: 't3', name: 'Gamma', priority: 'low' }),
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Priority' }))
    expect(rowNames()).toEqual(['Beta', 'Gamma', 'Alpha'])

    fireEvent.click(screen.getByRole('button', { name: 'Priority' }))
    expect(rowNames()).toEqual(['Alpha', 'Gamma', 'Beta'])
  })

  it('sorts due dates and always places empty dates last', () => {
    renderTable(vi.fn(), {
      ...baseBoard,
      tasks: [
        makeTask({ _id: 't1', name: 'Alpha', dueDate: '2026-10-01T00:00:00.000Z' }),
        makeTask({ _id: 't2', name: 'Beta', dueDate: null }),
        makeTask({ _id: 't3', name: 'Gamma', dueDate: '2026-09-01T00:00:00.000Z' }),
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Due date' }))
    expect(rowNames()).toEqual(['Gamma', 'Alpha', 'Beta'])

    fireEvent.click(screen.getByRole('button', { name: 'Due date' }))
    expect(rowNames()).toEqual(['Alpha', 'Gamma', 'Beta'])
  })

  it('breaks ties deterministically by id for equal and invalid dates', () => {
    const equal = new Date('2026-01-01T00:00:00.000Z').toISOString()
    renderTable(vi.fn(), {
      ...baseBoard,
      tasks: [
        makeTask({ _id: 'c', name: 'Charlie', createdAt: equal }),
        makeTask({ _id: 'a', name: 'Alpha', createdAt: equal }),
        makeTask({ _id: 'b', name: 'Bravo', createdAt: equal }),
        makeTask({ _id: 'd', name: 'Delta', createdAt: 'not-a-date' }),
      ],
    })
    expect(rowNames()).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta'])
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

  it('keeps sort state isolated per board', () => {
    const first = renderTable()
    fireEvent.click(screen.getByRole('button', { name: 'Name' }))
    expect(sessionStorage.getItem('board-view-table:b1')).toContain('"key":"name"')
    first.unmount()

    renderTable(vi.fn(), { ...baseBoard, _id: 'b2', name: 'Other Board' })
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'none')
    expect(screen.getByRole('columnheader', { name: /Created/ })).toHaveAttribute(
      'aria-sort',
      'descending'
    )
  })

  it('falls back to the default sort for invalid stored values', () => {
    sessionStorage.setItem('board-view-table:b1', JSON.stringify({ key: 'bogus', dir: 'up' }))
    renderTable()
    expect(screen.getByRole('columnheader', { name: /Created/ })).toHaveAttribute(
      'aria-sort',
      'descending'
    )
  })

  it('still sorts when sessionStorage access throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage denied')
    })

    renderTable()
    expect(rowNames()).toEqual(['Gamma', 'Beta', 'Alpha'])

    fireEvent.click(screen.getByRole('button', { name: 'Name' }))
    expect(rowNames()).toEqual(['Alpha', 'Beta', 'Gamma'])
  })
})

describe('TableView — filter, add and navigation', () => {
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

  it('creates in the first status and opens the detail page', async () => {
    api.createTask.mockResolvedValue(makeTask({ _id: 'new-1', name: 'New Task' }))
    renderBoardPage()

    fireEvent.click(screen.getByRole('button', { name: '+ Add new task' }))

    expect(await screen.findByText('TASK PAGE')).toBeInTheDocument()
    expect(api.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'In Progress', parentBoardId: 'b1' })
    )
  })

  it('renders as the active view on the table route', () => {
    renderBoardPage()
    expect(screen.getByRole('link', { name: 'Table' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('columnheader', { name: /Name/ })).toBeInTheDocument()
  })
})
