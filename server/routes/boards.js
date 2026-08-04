// routes/boards.js — Board resource endpoints
// All four CRUD operations for boards. Each handler is intentionally thin:
// it parses the request, calls the model, and returns JSON. Error handling
// is centralized in the errorHandler middleware.

import express from 'express'
import Board from '../models/Board.js'
import Task from '../models/Task.js'
import { notFound, validationError } from '../lib/errors.js'

const router = express.Router()

// Default statuses for a new board (matches the Kanban workflow)
const DEFAULT_STATUSES = ['Backlog', 'Ready', 'In progress', 'In review', 'Done']

// GET /api/boards/:boardId
// Returns the board with its tasks populated (full task objects, not just IDs)
router.get('/:boardId', async (req, res, next) => {
  try {
    const board = await Board.findById(req.params.boardId).populate('tasks')
    if (!board) throw notFound('Board not found')
    res.json({ data: { board } })
  } catch (err) {
    next(err)
  }
})

// POST /api/boards
// Creates a new board with one default task per status.
// Accepts optional name, description, and statuses in the request body.
router.post('/', async (req, res, next) => {
  try {
    const { name, description, statuses } = req.body || {}

    // Validate statuses if provided
    if (statuses !== undefined) {
      if (!Array.isArray(statuses) || statuses.length === 0) {
        throw validationError('statuses must be a non-empty array')
      }
      if (statuses.some((s) => typeof s !== 'string' || s.trim().length === 0)) {
        throw validationError('each status must be a non-empty string')
      }
    }

    // Use provided statuses or fall back to defaults
    const finalStatuses = statuses || DEFAULT_STATUSES

    // Create one default task per status. We do this first so we can
    // pass the task IDs to the board on creation (single round-trip).
    const taskDocs = await Task.insertMany(
      finalStatuses.map((status) => ({
        name: `Task ${status}`,
        status,
        icon: '⏰',
      }))
    )

    // Create the board with the task IDs
    const board = await Board.create({
      name,
      description,
      statuses: finalStatuses,
      tasks: taskDocs.map((t) => t._id),
    })

    // Re-fetch with populated tasks for the response
    const populated = await Board.findById(board._id).populate('tasks')
    res.status(201).json({ data: { board: populated } })
  } catch (err) {
    next(err)
  }
})

// PUT /api/boards/:boardId
// Updates only the fields provided in the request body.
// Supports name, description, and statuses.
router.put('/:boardId', async (req, res, next) => {
  try {
    const { name, description, statuses } = req.body || {}

    // Build the update object with only the fields that were provided
    const update = {}
    if (name !== undefined) update.name = name
    if (description !== undefined) update.description = description
    if (statuses !== undefined) {
      if (!Array.isArray(statuses) || statuses.length === 0) {
        throw validationError('statuses must be a non-empty array')
      }
      if (statuses.some((s) => typeof s !== 'string' || s.trim().length === 0)) {
        throw validationError('each status must be a non-empty string')
      }
      update.statuses = statuses
    }

    // Require at least one field to update
    if (Object.keys(update).length === 0) {
      throw validationError('No fields to update')
    }

    const board = await Board.findByIdAndUpdate(
      req.params.boardId,
      update,
      { new: true, runValidators: true }
    ).populate('tasks')

    if (!board) throw notFound('Board not found')
    res.json({ data: { board } })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/boards/:boardId
// Removes the board and cascades to all its tasks via the pre-deleteOne hook
router.delete('/:boardId', async (req, res, next) => {
  try {
    const board = await Board.findById(req.params.boardId)
    if (!board) throw notFound('Board not found')
    await board.deleteOne()  // triggers the cascade hook
    res.json({ data: { message: 'Board deleted' } })
  } catch (err) {
    next(err)
  }
})

export default router
