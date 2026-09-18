// __tests__/use-board-store.test.js — dueDate/priority round-trip and rollback.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as api from '../lib/api.js'
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

const baseTask = {
  _id: 't1',
  name: 'Task',
  description: '',
  icon: '⏰',
  status: 'A',
  order: 0,
  dueDate: null,
  priority: 'none',
}

const board = {
  _id: 'b1',
  name: 'Board',
  description: '',
  statuses: ['A'],
  tasks: [baseTask],
}

beforeEach(() => {
  vi.clearAllMocks()
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
})

describe('useBoardStore — dueDate and priority', () => {
  it('applies an optimistic update and keeps the server round-trip', async () => {
    api.updateTask.mockImplementation((id, data) => Promise.resolve({ ...baseTask, ...data }))

    const pending = useBoardStore.getState().updateTask('t1', {
      dueDate: '2026-09-15',
      priority: 'high',
    })

    const optimistic = useBoardStore.getState().board.tasks[0]
    expect(optimistic.dueDate).toBe('2026-09-15')
    expect(optimistic.priority).toBe('high')

    await pending
    expect(useBoardStore.getState().board.tasks[0].priority).toBe('high')
  })

  it('rolls back the task and sets the error when the API rejects', async () => {
    api.updateTask.mockRejectedValue(new Error('Update failed'))

    await expect(
      useBoardStore.getState().updateTask('t1', { priority: 'high' })
    ).rejects.toThrow('Update failed')

    const task = useBoardStore.getState().board.tasks[0]
    expect(task.priority).toBe('none')
    expect(task.dueDate).toBeNull()
    expect(useBoardStore.getState().error).toBe('Update failed')
  })

  it('addTask creates with null/none defaults', async () => {
    api.createTask.mockImplementation((data) => Promise.resolve({ _id: 'new-1', order: 0, ...data }))

    const created = await useBoardStore.getState().addTask('A')

    expect(api.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ dueDate: null, priority: 'none' })
    )
    expect(created.priority).toBe('none')
  })

  it('ignores out-of-order responses so the newest update wins', async () => {
    let resolveFirst
    let resolveSecond
    api.updateTask
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve }))

    const first = useBoardStore.getState().updateTask('t1', { dueDate: '2026-10-01' })
    const second = useBoardStore.getState().updateTask('t1', { dueDate: '2026-10-05' })
    expect(useBoardStore.getState().board.tasks[0].dueDate).toBe('2026-10-05')

    resolveSecond({ ...baseTask, dueDate: '2026-10-05' })
    await second
    resolveFirst({ ...baseTask, dueDate: '2026-10-01' })
    await first

    expect(useBoardStore.getState().board.tasks[0].dueDate).toBe('2026-10-05')
  })

  it('does not roll back newer state when a stale update fails', async () => {
    let rejectFirst
    api.updateTask
      .mockImplementationOnce(() => new Promise((resolve, reject) => { rejectFirst = reject }))
      .mockImplementationOnce(() => Promise.resolve({ ...baseTask, dueDate: '2026-10-05' }))

    const first = useBoardStore.getState().updateTask('t1', { dueDate: '2026-10-01' })
    const second = useBoardStore.getState().updateTask('t1', { dueDate: '2026-10-05' })
    await second
    rejectFirst(new Error('stale failure'))
    await first

    expect(useBoardStore.getState().board.tasks[0].dueDate).toBe('2026-10-05')
    expect(useBoardStore.getState().error).toBeNull()
  })
})
