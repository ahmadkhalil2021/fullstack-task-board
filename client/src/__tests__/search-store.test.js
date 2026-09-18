// __tests__/search-store.test.js — Pure search/filter helpers and the store slice (Issue #25).

import { describe, it, expect, beforeEach } from 'vitest'
import { useBoardStore, filterTasks } from '../store/useBoardStore.js'
import { resolveStatusKey, statusKeyFor, toStatusKey } from '../lib/statusKey.js'

const baseBoard = {
  _id: 'b1',
  name: 'Test Board',
  description: '',
  statuses: ['In Progress', 'Completed', "Won't do"],
  tasks: [
    { _id: 't1', name: 'Fix login bug', description: 'Auth flow breaks', status: 'In Progress', order: 0 },
    { _id: 't2', name: 'Write docs', description: 'Document the login flow', status: 'Completed', order: 0 },
    { _id: 't3', name: 'Refactor routes', description: 'Cleanup', status: "Won't do", order: 0 },
    { _id: 't4', name: 'No details', status: 'Completed', order: 1 },
  ],
}

beforeEach(() => {
  useBoardStore.setState({
    board: null,
    isLoading: false,
    error: null,
    query: '',
    filterStatus: null,
  })
})

describe('filterTasks', () => {
  it('returns all tasks for an empty query without a status filter', () => {
    expect(filterTasks(baseBoard.tasks, '', null)).toHaveLength(4)
  })

  it('matches task names case-insensitively', () => {
    expect(filterTasks(baseBoard.tasks, 'REFACTOR', null).map((t) => t._id)).toEqual(['t3'])
  })

  it('matches descriptions as well as names', () => {
    expect(filterTasks(baseBoard.tasks, 'auth flow', null).map((t) => t._id)).toEqual(['t1'])
  })

  it('treats missing fields as empty strings', () => {
    expect(filterTasks(baseBoard.tasks, 'no details', null).map((t) => t._id)).toEqual(['t4'])
  })

  it('applies the status filter exactly', () => {
    expect(filterTasks(baseBoard.tasks, '', 'Completed').map((t) => t._id)).toEqual(['t2', 't4'])
  })

  it('combines query and status filter', () => {
    expect(filterTasks(baseBoard.tasks, 'login', 'Completed').map((t) => t._id)).toEqual(['t2'])
  })
})

describe('status keys', () => {
  it('normalizes labels to url-safe keys', () => {
    expect(toStatusKey('In Progress')).toBe('in-progress')
    expect(toStatusKey("Won't do")).toBe('won-t-do')
    expect(toStatusKey('Café ☕')).toBe('cafe')
  })

  it('resolves semantic aliases to the matching board status', () => {
    expect(resolveStatusKey('progress', baseBoard.statuses)).toBe('In Progress')
    expect(resolveStatusKey('completed', baseBoard.statuses)).toBe('Completed')
    expect(resolveStatusKey('wont-do', baseBoard.statuses)).toBe("Won't do")
  })

  it('returns null for unknown or stale keys', () => {
    expect(resolveStatusKey('nonsense', baseBoard.statuses)).toBeNull()
    expect(resolveStatusKey('blocked', baseBoard.statuses)).toBeNull()
    expect(resolveStatusKey('', baseBoard.statuses)).toBeNull()
  })

  it('keeps plain keys when labels do not collide', () => {
    expect(statusKeyFor('Completed', baseBoard.statuses)).toBe('completed')
    expect(statusKeyFor("Won't do", baseBoard.statuses)).toBe('won-t-do')
  })

  it('rejects ambiguous base keys and accepts disambiguated ones', () => {
    const statuses = ['Done', 'done']
    expect(statusKeyFor('Done', statuses)).toBe('done-1')
    expect(statusKeyFor('done', statuses)).toBe('done-2')
    expect(resolveStatusKey('done', statuses)).toBeNull()
    expect(resolveStatusKey('done-1', statuses)).toBe('Done')
    expect(resolveStatusKey('done-2', statuses)).toBe('done')
  })
})

describe('store search slice', () => {
  it('exposes query/filter setters and derives filtered tasks', () => {
    useBoardStore.setState({ board: baseBoard })
    useBoardStore.getState().setSearchQuery('login')
    expect(useBoardStore.getState().query).toBe('login')
    useBoardStore.getState().setFilterStatus('Completed')
    expect(useBoardStore.getState().getFilteredTasks().map((t) => t._id)).toEqual(['t2'])
  })

  it('recalculates the derived set after an optimistic board update', () => {
    useBoardStore.setState({ board: baseBoard, query: 'login', filterStatus: null })
    expect(useBoardStore.getState().getFilteredTasks().map((t) => t._id)).toEqual(['t1', 't2'])

    useBoardStore.setState({
      board: { ...baseBoard, tasks: baseBoard.tasks.filter((t) => t._id !== 't1') },
    })
    expect(useBoardStore.getState().getFilteredTasks().map((t) => t._id)).toEqual(['t2'])
  })

  it('clearSearch resets query and status filter', () => {
    useBoardStore.setState({ board: baseBoard, query: 'login', filterStatus: 'Completed' })
    useBoardStore.getState().clearSearch()
    expect(useBoardStore.getState().query).toBe('')
    expect(useBoardStore.getState().filterStatus).toBeNull()
  })
})
