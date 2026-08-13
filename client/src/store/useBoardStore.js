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

// Build a client-side activity object for optimistic appends. The server also
// emits the real event on the same mutation; this local copy just makes the
// feed feel instant before the next fetch.
const optimisticActivity = (boardId, fields) => ({
  _id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  boardId,
  createdAt: new Date().toISOString(),
  ...fields,
})

export const useBoardStore = create((set, get) => ({
  board: null,
  isLoading: false,
  error: null,
  activity: [],
  activityLoading: false,
  activityError: null,
  activityHasMore: true,
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

  // Fetch the activity feed for a board. Replaces the list on the first page;
  // appends older pages when a `before` cursor is supplied.
  fetchActivity: async (boardId, { limit = 50, before } = {}) => {
    set({ activityLoading: true, activityError: null })
    try {
      const { activities, hasMore } = await api.fetchActivity(boardId, { limit, before })
      set((state) => ({
        activity: before ? [...state.activity, ...activities] : activities,
        activityHasMore: hasMore,
        activityLoading: false,
      }))
    } catch (err) {
      set({ activityError: err.message, activityLoading: false })
    }
  },

  // Prepend a locally-built activity so the feed updates instantly.
  addOptimisticActivity: (activity) => {
    set((state) => ({ activity: [activity, ...state.activity] }))
  },

  clearActivityError: () => set({ activityError: null }),

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

    const oldTask = previousBoard.tasks.find((t) => t._id === taskId)

    // Step 1: apply the change optimistically
    set({
      board: {
        ...previousBoard,
        tasks: previousBoard.tasks.map((t) =>
          t._id === taskId ? { ...t, ...data } : t
        ),
      },
    })

    // Optimistically append matching activity so the feed feels instant.
    if (oldTask) {
      if (data.status !== undefined && data.status !== oldTask.status) {
        get().addOptimisticActivity(optimisticActivity(previousBoard._id, {
          type: 'task_moved',
          taskId,
          taskName: data.name !== undefined ? data.name : oldTask.name,
          changes: { status: { from: oldTask.status, to: data.status } },
        }))
      }
      const fieldChanges = {}
      if (data.name !== undefined && data.name !== oldTask.name) {
        fieldChanges.name = { from: oldTask.name, to: data.name }
      }
      if (data.description !== undefined && data.description !== oldTask.description) {
        fieldChanges.description = { from: oldTask.description, to: data.description }
      }
      if (data.icon !== undefined && data.icon !== oldTask.icon) {
        fieldChanges.icon = { from: oldTask.icon, to: data.icon }
      }
      if (Object.keys(fieldChanges).length > 0) {
        get().addOptimisticActivity(optimisticActivity(previousBoard._id, {
          type: 'task_updated',
          taskId,
          taskName: data.name !== undefined ? data.name : oldTask.name,
          changes: fieldChanges,
        }))
      }
    }

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

    const oldTask = previousBoard.tasks.find((t) => t._id === taskId)

    set({
      board: {
        ...previousBoard,
        tasks: previousBoard.tasks.filter((t) => t._id !== taskId),
      },
    })

    if (oldTask) {
      get().addOptimisticActivity(optimisticActivity(previousBoard._id, {
        type: 'task_deleted',
        taskId,
        taskName: oldTask.name,
      }))
    }

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

    // Optimistically append board/status activity (mirrors the server's diff).
    if (data.name !== undefined && data.name !== previousBoard.name) {
      get().addOptimisticActivity(optimisticActivity(previousBoard._id, {
        type: 'board_updated',
        changes: { name: { from: previousBoard.name, to: data.name } },
      }))
    }
    if (data.description !== undefined && data.description !== previousBoard.description) {
      get().addOptimisticActivity(optimisticActivity(previousBoard._id, {
        type: 'board_updated',
        changes: { description: { from: previousBoard.description, to: data.description } },
      }))
    }
    if (data.statuses !== undefined) {
      const oldStatuses = previousBoard.statuses || []
      const newStatuses = data.statuses
      const shared = Math.min(oldStatuses.length, newStatuses.length)
      for (let i = 0; i < shared; i++) {
        if (oldStatuses[i] !== newStatuses[i]) {
          get().addOptimisticActivity(optimisticActivity(previousBoard._id, {
            type: 'status_renamed',
            changes: { status: { from: oldStatuses[i], to: newStatuses[i] } },
          }))
        }
      }
      for (let i = shared; i < newStatuses.length; i++) {
        get().addOptimisticActivity(optimisticActivity(previousBoard._id, {
          type: 'status_added',
          changes: { status: { to: newStatuses[i] } },
        }))
      }
      for (let i = shared; i < oldStatuses.length; i++) {
        get().addOptimisticActivity(optimisticActivity(previousBoard._id, {
          type: 'status_removed',
          changes: { status: { from: oldStatuses[i] } },
        }))
      }
    }

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

    get().addOptimisticActivity(optimisticActivity(previousBoard._id, {
      type: 'task_created',
      taskId: tempId,
      taskName: tempTask.name,
    }))

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
