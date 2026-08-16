// __tests__/activity-feed.test.jsx — Tests for the activity store slice and sidebar
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as api from '../lib/api.js'
import ActivityFeed from '../components/ActivityFeed.jsx'
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

const makeActivity = (overrides = {}) => ({
  _id: 'a1',
  boardId: 'b1',
  type: 'task_created',
  taskName: 'Fix login bug',
  changes: null,
  createdAt: new Date().toISOString(),
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  useBoardStore.setState({
    board: null,
    isLoading: false,
    error: null,
    activity: [],
    activityLoading: false,
    activityError: null,
    activityHasMore: true,
  })
})

describe('useBoardStore activity slice', () => {
  it('addOptimisticActivity prepends to the activity list', () => {
    useBoardStore.getState().addOptimisticActivity(makeActivity({ _id: 'a1' }))
    useBoardStore.getState().addOptimisticActivity(makeActivity({ _id: 'a2' }))

    const ids = useBoardStore.getState().activity.map((a) => a._id)
    expect(ids).toEqual(['a2', 'a1'])
  })

  it('fetchActivity replaces the list on the first page', async () => {
    api.fetchActivity.mockResolvedValue({ activities: [makeActivity()], hasMore: false })

    await useBoardStore.getState().fetchActivity('b1')

    const [boardId, opts] = api.fetchActivity.mock.calls[0]
    expect(boardId).toBe('b1')
    expect(opts.limit).toBe(50)
    expect(useBoardStore.getState().activity).toHaveLength(1)
    expect(useBoardStore.getState().activityHasMore).toBe(false)
  })

  it('fetchActivity appends older pages when a before cursor is supplied', async () => {
    useBoardStore.setState({ activity: [makeActivity({ _id: 'a1' })] })
    api.fetchActivity.mockResolvedValue({ activities: [makeActivity({ _id: 'a0' })], hasMore: false })

    await useBoardStore.getState().fetchActivity('b1', { before: 'a1' })

    const ids = useBoardStore.getState().activity.map((a) => a._id)
    expect(ids).toEqual(['a1', 'a0'])
  })

  it('updateTask appends a matching task_moved activity', async () => {
    api.updateTask.mockResolvedValue({ _id: 't1', name: 'Fix login bug', status: 'Done' })
    useBoardStore.setState({
      board: {
        _id: 'b1',
        name: 'Board',
        statuses: ['In progress', 'Done'],
        tasks: [{ _id: 't1', name: 'Fix login bug', status: 'In progress', order: 0 }],
      },
    })

    await useBoardStore.getState().updateTask('t1', { status: 'Done' })

    const activity = useBoardStore.getState().activity
    expect(activity).toHaveLength(1)
    expect(activity[0].type).toBe('task_moved')
    expect(activity[0].changes.status).toEqual({ from: 'In progress', to: 'Done' })
  })
})

describe('ActivityFeed', () => {
  it('renders a skeleton while loading', () => {
    useBoardStore.setState({
      board: { _id: 'b1', name: 'Board', statuses: [], tasks: [] },
      activity: [],
      activityLoading: true,
    })
    render(<ActivityFeed isOpen onClose={() => {}} />)
    expect(screen.getByRole('status', { name: 'Loading activity' })).toBeInTheDocument()
  })

  it('renders the empty state when there is no activity', async () => {
    api.fetchActivity.mockResolvedValue({ activities: [], hasMore: false })
    useBoardStore.setState({
      board: { _id: 'b1', name: 'Board', statuses: [], tasks: [] },
      activity: [],
      activityLoading: false,
    })
    render(<ActivityFeed isOpen onClose={() => {}} />)
    expect(await screen.findByText('No activity yet — make a move!')).toBeInTheDocument()
  })

  it('renders list items with descriptions', () => {
    useBoardStore.setState({
      board: { _id: 'b1', name: 'Board', statuses: [], tasks: [] },
      activity: [
        makeActivity({
          _id: 'a1',
          type: 'task_moved',
          taskName: 'Fix login bug',
          changes: { status: { from: 'In progress', to: 'In review' } },
        }),
        makeActivity({ _id: 'a2', type: 'task_deleted', taskName: 'Old task' }),
      ],
      activityLoading: false,
    })
    render(<ActivityFeed isOpen onClose={() => {}} />)

    expect(screen.getByText('Moved "Fix login bug" from In progress to In review')).toBeInTheDocument()
    expect(screen.getByText('Task deleted: Old task')).toBeInTheDocument()
  })

  it('calls fetchActivity with the before cursor on "Load more"', async () => {
    const user = userEvent.setup()
    api.fetchActivity.mockResolvedValue({ activities: [], hasMore: false })
    const items = Array.from({ length: 50 }, (_, i) =>
      makeActivity({ _id: `a${i}`, type: 'task_created', taskName: `Task ${i}` })
    )
    useBoardStore.setState({
      board: { _id: 'b1', name: 'Board', statuses: [], tasks: [] },
      activity: items,
      activityLoading: false,
      activityHasMore: true,
    })
    render(<ActivityFeed isOpen onClose={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Load more' }))

    expect(api.fetchActivity).toHaveBeenCalledWith('b1', expect.objectContaining({ before: 'a49' }))
  })
})
