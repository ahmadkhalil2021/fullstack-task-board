// useBoardStore.js — Zustand store for board state
// Implements the Flux pattern: components call these actions,
// the actions call the API, the state updates, the UI re-renders.
//
// Optimistic updates (ADR-0005): every mutation updates the store
// FIRST, then syncs to the API. If the API fails, the store rolls back.

import { create } from 'zustand'
import * as api from '../lib/api.js'

// Toggle the `dark` class on <html> so Tailwind's `dark:` variants apply
// (requires `darkMode: 'class'` in tailwind.config.js).
const applyTheme = (theme) => {
  const dark =
    theme === 'dark' ||
    (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

const VALID_THEMES = ['light', 'dark', 'system']

// Fall back to 'system' on stale/corrupt values left in localStorage by older builds
const sanitizeTheme = (t) => (VALID_THEMES.includes(t) ? t : 'system')

export const useBoardStore = create((set, get) => ({
  board: null,
  isLoading: false,
  error: null,
  theme: sanitizeTheme(
    typeof window !== 'undefined' ? localStorage.getItem('theme') : null
  ),
  _themeListenerAttached: false,

  // Fetch a board by ID. Used by BoardPage on mount.
  fetchBoard: async (boardId) => {
    set({ isLoading: true, error: null })
    try {
      const board = await api.fetchBoard(boardId)
      set({ board, isLoading: false })
    } catch (err) {
      set({ error: err.message, isLoading: false })
    }
  },

  // Clear the global error banner.
  clearError: () => set({ error: null }),

  // Create a new board and return its ID.
  createBoard: async () => {
    const board = await api.createBoard({})
    set({ board })
    return board._id
  },

  // Optimistic update for a task. Updates the store immediately,
  // syncs to the API, and rolls back on failure.
  updateTask: async (taskId, data) => {
    const previousBoard = get().board
    if (!previousBoard) return

    // Step 1: apply the change optimistically
    set({
      board: {
        ...previousBoard,
        tasks: previousBoard.tasks.map((t) =>
          t._id === taskId ? { ...t, ...data } : t
        ),
      },
    })

    // Step 2: sync to API
    try {
      const task = await api.updateTask(taskId, data)
      // Replace with the server's version (handles server-side defaults)
      set({
        board: {
          ...get().board,
          tasks: get().board.tasks.map((t) => (t._id === taskId ? task : t)),
        },
      })
    } catch (err) {
      // Step 3: rollback on failure
      set({ board: previousBoard, error: err.message })
      throw err
    }
  },

  // Update a task's order (used for reordering within a column).
  // Optimistic: update the store immediately, sync to API, rollback on failure.
  updateTaskOrder: async (taskId, newOrder) => {
    const previousBoard = get().board
    if (!previousBoard) return

    // Apply the new order optimistically
    set({
      board: {
        ...previousBoard,
        tasks: previousBoard.tasks.map((t) =>
          t._id === taskId ? { ...t, order: newOrder } : t
        ),
      },
    })

    try {
      const task = await api.updateTaskOrder(taskId, newOrder)
      set({
        board: {
          ...get().board,
          tasks: get().board.tasks.map((t) => (t._id === taskId ? task : t)),
        },
      })
    } catch (err) {
      set({ board: previousBoard, error: err.message })
      throw err
    }
  },

  // Reorder tasks in a column by providing the new order of task IDs.
  // This is a more efficient way to reorder when moving a task within a column.
  reorderTasksInColumn: async (status, newTaskIds) => {
    const previousBoard = get().board
    if (!previousBoard) return

    // Apply the new order optimistically
    const orderByTaskId = new Map()
    newTaskIds.forEach((id, index) => orderByTaskId.set(id, index))

    set({
      board: {
        ...previousBoard,
        tasks: previousBoard.tasks.map((t) =>
          orderByTaskId.has(t._id) ? { ...t, order: orderByTaskId.get(t._id) } : t
        ),
      },
    })

    // Sync each task's new order to the API
    try {
      const updates = newTaskIds.map((id, index) =>
        api.updateTaskOrder(id, index)
      )
      await Promise.all(updates)
    } catch (err) {
      set({ board: previousBoard, error: err.message })
      throw err
    }
  },

  // Optimistic delete. Removes the task from the store, syncs to API, rolls back on failure.
  deleteTask: async (taskId) => {
    const previousBoard = get().board
    if (!previousBoard) return

    set({
      board: {
        ...previousBoard,
        tasks: previousBoard.tasks.filter((t) => t._id !== taskId),
      },
    })

    try {
      await api.deleteTask(taskId)
    } catch (err) {
      set({ board: previousBoard, error: err.message })
      throw err
    }
  },

  // Optimistic board update (name, description, statuses).
  updateBoard: async (data) => {
    const previousBoard = get().board
    if (!previousBoard) return

    set({ board: { ...previousBoard, ...data } })

    try {
      const updated = await api.updateBoard(previousBoard._id, data)
      set({ board: updated })
    } catch (err) {
      set({ board: previousBoard, error: err.message })
      throw err
    }
  },

  // Add a new task to the current board. Optimistic.
  addTask: async (status) => {
    const previousBoard = get().board
    if (!previousBoard) {
      throw new Error('No board loaded')
    }

    // Kanban inbox style: place the new task above the current top of the column.
    // Empty columns start at 0.
    const orders = previousBoard.tasks
      .filter((t) => t.status === status)
      .map((t) => t.order ?? 0)
    const newOrder = orders.length ? Math.min(...orders) - 1 : 0

    // Optimistic placeholder
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const tempTask = {
      _id: tempId,
      name: 'New Task',
      description: '',
      icon: '⏰',
      status,
      order: newOrder,
      parentBoardId: previousBoard._id,
    }
    set({
      board: {
        ...previousBoard,
        tasks: [...previousBoard.tasks, tempTask],
      },
    })

    try {
      // api.createTask already unwraps `res.data.task`, so this is the real task.
      const realTask = await api.createTask({
        name: tempTask.name,
        description: tempTask.description,
        icon: tempTask.icon,
        status,
        order: newOrder,
        parentBoardId: previousBoard._id,
      })
      set({
        board: {
          ...get().board,
          tasks: get().board.tasks.map((t) => (t._id === tempId ? realTask : t)),
        },
      })
      return realTask
    } catch (err) {
      set({ board: previousBoard, error: err.message })
      throw err
    }
  },

  setTheme: (t) => {
    if (!VALID_THEMES.includes(t)) return
    localStorage.setItem('theme', t)
    set({ theme: t })
    applyTheme(t)
  },

  // Apply the persisted theme on startup and react to OS theme changes
  // while the user has not picked an explicit light/dark preference.
  // App-level listener — intentional singleton. HMR guard prevents double-subscribe in dev.
  initTheme: () => {
    applyTheme(get().theme)
    if (get()._themeListenerAttached) return // HMR guard
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    if (typeof mq.addEventListener !== 'function') return
    mq.addEventListener('change', () => {
      if (get().theme === 'system') applyTheme('system')
    })
    set({ _themeListenerAttached: true })
  },
}))
