// useBoardStore.js — Zustand store for board state
// Single source of truth for the entire board (including its tasks).
// Components import this hook and read what they need — no prop drilling.

import { create } from 'zustand'
import * as api from '../lib/api.js'

// Store shape:
//   board: { _id, name, description, statuses, tasks } | null
//   isLoading: bool
//   error: string | null
//
// Actions (placeholders for now — real implementations come in later issues):
//   fetchBoard(boardId): loads a board from the API
//   createBoard(): creates a new board and returns its ID
//   updateBoard(data): updates the current board
//   updateTask(taskId, data): updates a single task
//   deleteTask(taskId): deletes a single task
//   addTask(status): creates a new task in the given status column
export const useBoardStore = create((set, get) => ({
  board: null,
  isLoading: false,
  error: null,

  // Placeholders — real implementations in Issue #10 (Connect frontend to backend API)
  fetchBoard: async (_boardId) => {
    set({ isLoading: true, error: null })
    try {
      const board = await api.fetchBoard(_boardId)
      set({ board, isLoading: false })
    } catch (err) {
      set({ error: err.message, isLoading: false })
    }
  },

  createBoard: async () => {
    const board = await api.createBoard({})
    set({ board })
    return board._id
  },

  updateBoard: async (data) => {
    const board = get().board
    if (!board) return
    const updated = await api.updateBoard(board._id, data)
    set({ board: updated })
  },

  updateTask: async (taskId, data) => {
    const task = await api.updateTask(taskId, data)
    set({
      board: {
        ...get().board,
        tasks: get().board.tasks.map((t) => (t._id === taskId ? task : t)),
      },
    })
  },

  deleteTask: async (taskId) => {
    await api.deleteTask(taskId)
    set({
      board: {
        ...get().board,
        tasks: get().board.tasks.filter((t) => t._id !== taskId),
      },
    })
  },

  addTask: async (status) => {
    const task = await api.createTask({ status })
    set({
      board: {
        ...get().board,
        tasks: [...get().board.tasks, task],
      },
    })
  },
}))
