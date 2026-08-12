// api.js — Thin wrapper around fetch for the backend API
// All API calls go through this module. Components should call the Zustand
// store actions, not this directly — keeps fetch details out of the UI.

const API_BASE = import.meta.env.VITE_API_URL || '/api'

// Helper that throws a typed error when the response is not OK
const request = async (path, options = {}) => {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const message = body.error?.message || `Request failed: ${res.status}`
    const error = new Error(message)
    error.code = body.error?.code || 'UNKNOWN'
    throw error
  }
  return res.json()
}

export const fetchBoard = (boardId) =>
  request(`/boards/${boardId}`).then((res) => res.data.board)

export const createBoard = (data) =>
  request('/boards', { method: 'POST', body: JSON.stringify(data) })
    .then((res) => res.data.board)

export const updateBoard = (boardId, data) =>
  request(`/boards/${boardId}`, { method: 'PUT', body: JSON.stringify(data) })
    .then((res) => res.data.board)

export const updateTask = (taskId, data) =>
  request(`/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify(data) })
    .then((res) => res.data.task)

export const updateTaskOrder = (taskId, order) =>
  request(`/tasks/${taskId}/order`, { method: 'PUT', body: JSON.stringify({ order }) })
    .then((res) => res.data.task)

export const deleteTask = (taskId) =>
  request(`/tasks/${taskId}`, { method: 'DELETE' })
    .then((res) => res.data)

export const createTask = (data) =>
  request('/tasks', { method: 'POST', body: JSON.stringify(data) })
    .then((res) => res.data.task)
