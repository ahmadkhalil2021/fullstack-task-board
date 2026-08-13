// routes/boards.js — Board resource endpoints
// All four CRUD operations for boards. Each handler is intentionally thin:
// it parses the request, calls the model, and returns JSON. Error handling
// is centralized in the errorHandler middleware.

import express from 'express'
import Board from '../models/Board.js'
import Task from '../models/Task.js'
import { emitActivity } from '../models/Activity.js'
import { notFound, validationError } from '../lib/errors.js'

const router = express.Router()

// Default statuses for a new board (matches the Kanban workflow)
const DEFAULT_STATUSES = ['Backlog', 'Ready', 'In progress', 'In review', 'Done']

// Diff status arrays to infer add/rename/remove events. Same-index changes
// are treated as renames; extra items appended to the tail are added; items
// dropped from the tail are removed. (A full reorder surfaces as renames —
// acceptable for a simple audit trail.)
const emitStatusChanges = async (boardId, oldStatuses, newStatuses) => {
  const shared = Math.min(oldStatuses.length, newStatuses.length)
  for (let i = 0; i < shared; i++) {
    if (oldStatuses[i] !== newStatuses[i]) {
      await emitActivity({
        boardId,
        type: 'status_renamed',
        changes: { status: { from: oldStatuses[i], to: newStatuses[i] } },
      })
    }
  }
  for (let i = shared; i < newStatuses.length; i++) {
    await emitActivity({
      boardId,
      type: 'status_added',
      changes: { status: { to: newStatuses[i] } },
    })
  }
  for (let i = shared; i < oldStatuses.length; i++) {
    await emitActivity({
      boardId,
      type: 'status_removed',
      changes: { status: { from: oldStatuses[i] } },
    })
  }
}

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
    // We assign `order` incrementally so the tasks display in the same
    // order as the statuses array.
    const taskDocs = await Task.insertMany(
      finalStatuses.map((status, index) => ({
        name: `Task ${status}`,
        status,
        icon: '⏰',
        order: index,
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

    // Load the previous document so we can diff against it for the activity feed
    const oldBoard = await Board.findById(req.params.boardId)
    if (!oldBoard) throw notFound('Board not found')

    const board = await Board.findByIdAndUpdate(
      req.params.boardId,
      update,
      { new: true, runValidators: true }
    ).populate('tasks')

    if (name !== undefined && name !== oldBoard.name) {
      await emitActivity({
        boardId: board._id,
        type: 'board_updated',
        changes: { name: { from: oldBoard.name, to: board.name } },
      })
    }
    if (description !== undefined && description !== oldBoard.description) {
      await emitActivity({
        boardId: board._id,
        type: 'board_updated',
        changes: { description: { from: oldBoard.description, to: board.description } },
      })
    }
    if (statuses !== undefined) {
      await emitStatusChanges(board._id, oldBoard.statuses, board.statuses)
    }

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
