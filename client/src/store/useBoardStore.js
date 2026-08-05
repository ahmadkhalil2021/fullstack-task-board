// useBoardStore.js — Zustand store for board state
// Implements the Flux pattern: components call these actions,
// the actions call the API, the state updates, the UI re-renders.
//
// Optimistic updates (ADR-0005): every mutation updates the store
// FIRST, then syncs to the API. If the API fails, the store rolls back.

import { create } from 'zustand'
import * as api from '../lib/api.js'

export const useBoardStore = create((set, get) => ({
  board: null,
  isLoading: false,
  error: null,

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
    if (!previousBoard) return

    // Optimistic placeholder
    const tempId = `temp-${Date.now()}`
    const tempTask = {
      _id: tempId,
      name: 'New Task',
      description: '',
      icon: '⏰',
      status,
    }
    set({
      board: {
        ...previousBoard,
        tasks: [...previousBoard.tasks, tempTask],
      },
    })

    try {
      const task = await api.createTask({ status })
      set({
        board: {
          ...get().board,
          tasks: get().board.tasks.map((t) => (t._id === tempId ? task : t)),
        },
      })
    } catch (err) {
      set({ board: previousBoard, error: err.message })
      throw err
    }
  },
}))
