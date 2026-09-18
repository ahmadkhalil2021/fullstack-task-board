// __tests__/task-detail.test.jsx — Odoo-style task form: fields, statusbar, save, delete, navigation.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import * as api from '../lib/api.js'
import TaskDetailPage from '../pages/TaskDetailPage.jsx'
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

const task = {
  _id: 't1',
  name: 'Fix login',
  description: 'Auth flow',
  icon: '🚀',
  status: 'In Progress',
  order: 0,
  createdAt: TWO_HOURS_AGO,
  updatedAt: TWO_HOURS_AGO,
}

const secondTask = {
  _id: 't2',
  name: 'Second task',
  description: '',
  icon: '⭐',
  status: 'Completed',
  order: 1,
  createdAt: TWO_HOURS_AGO,
  updatedAt: TWO_HOURS_AGO,
}

const board = {
  _id: 'b1',
  name: 'Board',
  description: '',
  statuses: ['In Progress', 'Completed'],
  tasks: [task, secondTask],
}

const renderDetail = ({ entry = '/board/b1/task/t1', state, storeBoard = board } = {}) => {
  useBoardStore.setState({
    board: storeBoard,
    isLoading: false,
    error: null,
    query: '',
    filterStatus: null,
    activity: [],
    activityLoading: false,
    activityError: null,
  })
  const router = createMemoryRouter(
    [
      { path: '/board/:boardId/task/:taskId', element: <TaskDetailPage /> },
      { path: '/board/:boardId', element: <div>BOARD PAGE</div> },
    ],
    { initialEntries: [state ? { pathname: entry, state } : entry] }
  )
  const rendered = render(<RouterProvider router={router} />)
  return { ...rendered, router }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('TaskDetailPage', () => {
  it('renders the task fields, statusbar and meta information', () => {
    renderDetail()
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Fix login')
    expect(screen.getByLabelText('Description')).toHaveValue('Auth flow')
    expect(screen.getByRole('radio', { name: 'In Progress' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Completed' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText(/^Created /)).toBeInTheDocument()
    expect(screen.getByText(/^Last updated /)).toBeInTheDocument()
  })

  it('renders icon-only Save and Discard controls with accessible names', () => {
    renderDetail()
    for (const name of ['Save', 'Discard']) {
      const button = screen.getByRole('button', { name })
      expect(button.textContent).toBe('')
      expect(button.querySelector('svg')).toBeInTheDocument()
    }
  })

  it('lists the board statuses in the statusbar', () => {
    renderDetail()
    const stages = screen
      .getAllByRole('radio')
      .map((node) => node.textContent.replace(/[^A-Za-z ]/g, '').trim())
    expect(stages).toEqual(['In Progress', 'Completed'])
  })

  it('disables Save until something changes, then saves and confirms', async () => {
    const user = userEvent.setup()
    api.updateTask.mockImplementation((id, data) => Promise.resolve({ ...task, ...data }))
    renderDetail()

    const save = screen.getByRole('button', { name: 'Save' })
    expect(save).toBeDisabled()

    const name = screen.getByLabelText('Name')
    await user.clear(name)
    await user.type(name, 'Fix signup')
    expect(save).toBeEnabled()
    await user.click(save)

    await waitFor(() => {
      expect(api.updateTask).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({ name: 'Fix signup' })
      )
    })
    expect(await screen.findByText('Saved')).toBeInTheDocument()
  })

  it('saves a clicked statusbar stage immediately without pressing Save', async () => {
    const user = userEvent.setup()
    api.updateTask.mockImplementation((id, data) => Promise.resolve({ ...task, ...data }))
    renderDetail()

    await user.click(screen.getByRole('radio', { name: 'Completed' }))

    await waitFor(() => {
      expect(api.updateTask).toHaveBeenCalledWith('t1', { status: 'Completed' })
    })
    expect(screen.getByRole('radio', { name: 'Completed' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('reverts the statusbar when the immediate status save fails', async () => {
    const user = userEvent.setup()
    api.updateTask.mockRejectedValue(new Error('Update failed'))
    renderDetail()

    await user.click(screen.getByRole('radio', { name: 'Completed' }))

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'In Progress' })).toHaveAttribute('aria-checked', 'true')
    })
    expect(useBoardStore.getState().error).toBe('Update failed')
  })

  it('discards local edits', async () => {
    const user = userEvent.setup()
    renderDetail()

    await user.type(screen.getByLabelText('Name'), ' dirty')
    expect(screen.getByRole('button', { name: 'Discard' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Discard' }))
    expect(screen.getByLabelText('Name')).toHaveValue('Fix login')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('disables Save when the name is empty', async () => {
    const user = userEvent.setup()
    renderDetail()
    await user.clear(screen.getByLabelText('Name'))
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('shows a not-found state for unknown task ids', () => {
    renderDetail({ entry: '/board/b1/task/missing' })
    expect(screen.getByText(/Task not found/)).toBeInTheDocument()
  })

  it('shows a not-found state when the board cannot be loaded', async () => {
    api.fetchBoard.mockRejectedValue(new Error('Board not found'))
    renderDetail({ entry: '/board/missing/task/t1', storeBoard: null })
    expect(await screen.findByText(/the link may be invalid/)).toBeInTheDocument()
  })

  it('does not leak tasks from a previous board while the target board loads', async () => {
    let resolveFetch
    api.fetchBoard.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve
        })
    )
    const otherBoard = {
      _id: 'b2',
      name: 'Other board',
      description: '',
      statuses: ['In Progress'],
      tasks: [{ ...task, name: 'Wrong board task' }],
    }
    renderDetail({ entry: '/board/b1/task/t1', storeBoard: otherBoard })

    expect(screen.getByText('Loading task...')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Wrong board task')).not.toBeInTheDocument()

    await act(async () => {
      resolveFetch(board)
    })
    expect(await screen.findByDisplayValue('Fix login')).toBeInTheDocument()
  })

  it('resets the form when navigating to another task', async () => {
    const user = userEvent.setup()
    const { router } = renderDetail()

    await user.type(screen.getByLabelText('Name'), ' dirty')
    await act(async () => {
      await router.navigate('/board/b1/task/t2')
    })

    expect(screen.getByLabelText('Name')).toHaveValue('Second task')
  })

  it('links back to the board by default', () => {
    renderDetail()
    expect(screen.getByRole('link', { name: 'Board' })).toHaveAttribute('href', '/board/b1')
  })

  it('links back to the originating view and filters when provided', () => {
    renderDetail({
      entry: '/board/b1/task/t1',
      state: { from: '/board/b1/table?q=login&f=in-progress' },
    })
    expect(screen.getByRole('link', { name: 'Board' })).toHaveAttribute(
      'href',
      '/board/b1/table?q=login&f=in-progress'
    )
  })

  it('deletes after an inline confirmation and returns to the board', async () => {
    const user = userEvent.setup()
    api.deleteTask.mockResolvedValue({ message: 'deleted' })
    renderDetail()

    await user.click(screen.getByTestId('request-delete'))
    expect(screen.getByTestId('delete-confirm')).toBeInTheDocument()

    await user.click(screen.getByTestId('confirm-delete'))

    await waitFor(() => {
      expect(api.deleteTask).toHaveBeenCalledWith('t1')
    })
    expect(await screen.findByText('BOARD PAGE')).toBeInTheDocument()
  })
})
