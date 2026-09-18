// __tests__/calendar-view.test.jsx — Month grid, tray, panel, navigation, filters, keyboard moves.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within, fireEvent, waitFor, act } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import * as api from '../lib/api.js'
import CalendarView from '../views/CalendarView.jsx'
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

const pad = (value) => String(value).padStart(2, '0')
const keyOf = (year, month, day) => `${year}-${pad(month)}-${pad(day)}`
const dueIso = (key) => `${key}T00:00:00.000Z`

const today = new Date()
const thisMonthKey = (day) => keyOf(today.getFullYear(), today.getMonth() + 1, day)
const nextMonthDate = new Date(today.getFullYear(), today.getMonth() + 1, 1)
const nextMonthKey = (day) => keyOf(nextMonthDate.getFullYear(), nextMonthDate.getMonth() + 1, day)

const monthLabelOf = (year, monthIndex) =>
  new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, monthIndex, 1)))
const shortDayLabel = (key) =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${key}T00:00:00.000Z`))
const fullDayLabel = (key) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${key}T00:00:00.000Z`))

const CURRENT_LABEL = monthLabelOf(today.getFullYear(), today.getMonth())
const NEXT_LABEL = monthLabelOf(nextMonthDate.getFullYear(), nextMonthDate.getMonth())

const makeTask = (overrides = {}) => ({
  _id: 't1',
  name: 'Task',
  description: '',
  icon: '⏰',
  status: 'In Progress',
  order: 0,
  dueDate: null,
  priority: 'none',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

const baseBoard = {
  _id: 'b1',
  name: 'Test Board',
  description: '',
  statuses: ['In Progress'],
  tasks: [
    makeTask({ _id: 'ta', name: 'Design review', dueDate: dueIso(thisMonthKey(15)), priority: 'high' }),
    makeTask({ _id: 'tb', name: 'Write specs', dueDate: dueIso(thisMonthKey(15)) }),
    makeTask({ _id: 'tc', name: 'Ship build', dueDate: dueIso(thisMonthKey(16)), priority: 'low' }),
    makeTask({ _id: 'td', name: 'Plan roadmap', priority: 'high' }),
    makeTask({ _id: 'te', name: 'Next month task', dueDate: dueIso(nextMonthKey(20)) }),
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

const renderCalendar = (onTaskClick = vi.fn(), board = baseBoard) => {
  resetStore(board)
  render(<CalendarView onTaskClick={onTaskClick} />)
  return onTaskClick
}

const dayButton = (key, count) =>
  screen.getByRole('button', { name: `${shortDayLabel(key)}, ${count} task${count === 1 ? '' : 's'}` })

const renderBoardPage = () => {
  resetStore()
  const router = createMemoryRouter(
    [
      { path: '/board/:boardId', element: <BoardPage /> },
      { path: '/board/:boardId/calendar', element: <BoardPage /> },
      { path: '/board/:boardId/task/:taskId', element: <div>TASK PAGE</div> },
    ],
    { initialEntries: ['/board/b1/calendar'] }
  )
  return render(<RouterProvider router={router} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  api.fetchActivity.mockResolvedValue({ activities: [], hasMore: false })
})

describe('CalendarView — month grid', () => {
  it('renders the current month and weekday headers', () => {
    renderCalendar()
    expect(screen.getByRole('heading', { name: CURRENT_LABEL })).toBeInTheDocument()
    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
      expect(screen.getByText(day)).toBeInTheDocument()
    }
  })

  it('renders chips on their due date with per-day counts', () => {
    renderCalendar()
    expect(screen.getByText('Design review')).toBeInTheDocument()
    expect(screen.getByText('Ship build')).toBeInTheDocument()
    expect(dayButton(thisMonthKey(15), 2)).toBeInTheDocument()
    expect(dayButton(thisMonthKey(16), 1)).toBeInTheDocument()
  })

  it('caps a day at three chips and shows +N more', () => {
    const crowded = {
      ...baseBoard,
      tasks: [1, 2, 3, 4, 5].map((n) =>
        makeTask({ _id: `t${n}`, name: `Task ${n}`, dueDate: dueIso(thisMonthKey(15)) })
      ),
    }
    renderCalendar(vi.fn(), crowded)

    expect(screen.getByText('Task 3')).toBeInTheDocument()
    expect(screen.queryByText('Task 4')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+2 more' })).toBeInTheDocument()
  })

  it('marks today with aria-current="date"', () => {
    renderCalendar()
    const current = document.querySelector('[aria-current="date"]')
    expect(current).not.toBeNull()
    expect(current).toHaveTextContent(String(today.getDate()))
  })

  it('shows a hint when the month has no scheduled tasks but a tray exists', () => {
    renderCalendar(vi.fn(), {
      ...baseBoard,
      tasks: [makeTask({ _id: 'td', name: 'Plan roadmap' })],
    })
    expect(screen.getByText(/No tasks due this month/)).toBeInTheDocument()
  })

  it('shows the empty-filter state', () => {
    renderCalendar()
    act(() => {
      useBoardStore.getState().setSearchQuery('zzz')
    })
    expect(screen.getByText('No tasks match the current filters.')).toBeInTheDocument()
  })
})

describe('CalendarView — day panel', () => {
  it('opens the panel with all tasks of the day and focuses close', async () => {
    renderCalendar()
    fireEvent.click(dayButton(thisMonthKey(15), 2))

    const panel = await screen.findByRole('complementary', {
      name: `Tasks on ${fullDayLabel(thisMonthKey(15))}`,
    })
    expect(panel).toBeInTheDocument()
    expect(within(panel).getByText('Design review')).toBeInTheDocument()
    expect(within(panel).getByText('Write specs')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close day panel' })).toHaveFocus()
  })

  it('calls onTaskClick from a panel entry', () => {
    const onTaskClick = renderCalendar()
    fireEvent.click(dayButton(thisMonthKey(15), 2))
    fireEvent.click(within(screen.getByRole('complementary')).getByText('Design review'))
    expect(onTaskClick).toHaveBeenCalledWith(expect.objectContaining({ _id: 'ta' }))
  })

  it('returns focus to the day button when the panel closes', () => {
    renderCalendar()
    const button = dayButton(thisMonthKey(15), 2)
    fireEvent.click(button)
    fireEvent.click(screen.getByRole('button', { name: 'Close day panel' }))
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    expect(button).toHaveFocus()
  })
})

describe('CalendarView — unscheduled tray', () => {
  it('renders unscheduled tasks with a count', () => {
    renderCalendar()
    const tray = screen.getByRole('region', { name: 'Unscheduled tasks' })
    expect(within(tray).getByRole('heading', { name: 'Unscheduled · 1' })).toBeInTheDocument()
    expect(within(tray).getByText('Plan roadmap')).toBeInTheDocument()
  })

  it('sorts unscheduled tasks by priority then createdAt', () => {
    renderCalendar(vi.fn(), {
      ...baseBoard,
      tasks: [
        makeTask({ _id: 'a', name: 'Alpha', priority: 'none', createdAt: '2026-01-03T00:00:00.000Z' }),
        makeTask({ _id: 'b', name: 'Bravo', priority: 'low', createdAt: '2026-01-01T00:00:00.000Z' }),
        makeTask({ _id: 'c', name: 'Charlie', priority: 'high', createdAt: '2026-01-02T00:00:00.000Z' }),
      ],
    })
    const tray = screen.getByRole('region', { name: 'Unscheduled tasks' })
    const names = within(tray)
      .getAllByText(/^(Alpha|Bravo|Charlie)$/)
      .map((node) => node.textContent)
    expect(names).toEqual(['Charlie', 'Bravo', 'Alpha'])
  })

  it('narrows chips and tray through the shared filter', () => {
    renderCalendar()
    act(() => {
      useBoardStore.getState().setSearchQuery('Design')
    })
    expect(screen.getByText('Design review')).toBeInTheDocument()
    expect(screen.queryByText('Ship build')).not.toBeInTheDocument()
    expect(screen.queryByText('Plan roadmap')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Unscheduled · 0' })).toBeInTheDocument()
  })
})

describe('CalendarView — rescheduling', () => {
  it('moves a task one day forward in keyboard move mode', async () => {
    api.updateTask.mockImplementation((id, data) =>
      Promise.resolve({ ...makeTask({ _id: id }), ...data })
    )
    renderCalendar()

    const chip = screen.getByText('Design review').closest('button')
    fireEvent.keyDown(chip, { key: 'm' })
    expect(screen.getByText(/→/)).toBeInTheDocument()
    fireEvent.keyDown(chip, { key: 'ArrowRight' })
    fireEvent.keyDown(chip, { key: 'Enter' })

    await waitFor(() => {
      expect(api.updateTask).toHaveBeenCalledWith('ta', { dueDate: thisMonthKey(16) })
    })
  })

  it('cancels move mode with Escape without saving', () => {
    renderCalendar()
    const chip = screen.getByText('Ship build').closest('button')
    fireEvent.keyDown(chip, { key: 'm' })
    fireEvent.keyDown(chip, { key: 'ArrowRight' })
    fireEvent.keyDown(chip, { key: 'Escape' })
    expect(api.updateTask).not.toHaveBeenCalled()
    expect(screen.queryByText(/→/)).not.toBeInTheDocument()
  })
})

describe('CalendarView — month navigation', () => {
  it('moves to the next and previous month and back with Today', () => {
    renderCalendar()
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
    expect(screen.getByRole('heading', { name: NEXT_LABEL })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(screen.getByRole('heading', { name: CURRENT_LABEL })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
    fireEvent.click(screen.getByRole('button', { name: 'Today' }))
    expect(screen.getByRole('heading', { name: CURRENT_LABEL })).toBeInTheDocument()
  })

  it('shows tasks of other months when navigating there', () => {
    renderCalendar()
    expect(screen.queryByText('Next month task')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
    expect(screen.getByText('Next month task')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(screen.queryByText('Next month task')).not.toBeInTheDocument()
  })
})

describe('CalendarView — BoardPage integration', () => {
  it('renders as the active view on the calendar route', () => {
    renderBoardPage()
    expect(screen.getByRole('link', { name: 'Calendar' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { name: CURRENT_LABEL })).toBeInTheDocument()
  })

  it('navigates to the task detail page when a chip is clicked', () => {
    renderBoardPage()
    fireEvent.click(screen.getByText('Design review'))
    expect(screen.getByText('TASK PAGE')).toBeInTheDocument()
  })
})
