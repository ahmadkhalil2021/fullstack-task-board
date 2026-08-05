// routes/tasks.js — Task resource endpoints
// Implements POST (create), PUT (update), and DELETE for individual tasks.
// The board POST handler in routes/boards.js creates the initial tasks;
// this POST is for the "Add new task" UI button (Issue #8).

import express from 'express'
import Task from '../models/Task.js'
import Board from '../models/Board.js'
import { notFound, validationError } from '../lib/errors.js'

const router = express.Router()

// POST /api/tasks
// Creates a new task and links it to its parent board.
// The parent board is found by looking up which board contains a task
// with the given parentBoardId in its tasks array.
router.post('/', async (req, res, next) => {
  try {
    const { name, description, icon, status, parentBoardId } = req.body || {}

    if (!parentBoardId) {
      throw validationError('parentBoardId is required')
    }
    if (!status) {
      throw validationError('status is required')
    }

    // Find the parent board and verify the status is in its allowed list
    const board = await Board.findById(parentBoardId)
    if (!board) throw notFound('Parent board not found')
    if (!board.statuses.includes(status)) {
      throw validationError(
        `Status "${status}" is not in the board's allowed statuses: ${board.statuses.join(', ')}`
      )
    }

    // Create the task
    const task = await Task.create({ name, description, icon, status })

    // Link the task to the board
    board.tasks.push(task._id)
    await board.save()

    res.status(201).json({ data: { task } })
  } catch (err) {
    next(err)
  }
})

// PUT /api/tasks/:taskId
// Updates only the fields provided in the request body.
// If `status` is provided, validates it against the parent board's statuses.
router.put('/:taskId', async (req, res, next) => {
  try {
    const { name, description, icon, status } = req.body || {}

    // Build the update object with only provided fields
    const update = {}
    if (name !== undefined) update.name = name
    if (description !== undefined) update.description = description
    if (icon !== undefined) update.icon = icon
    if (status !== undefined) update.status = status

    if (Object.keys(update).length === 0) {
      throw validationError('No fields to update')
    }

    // If status is being changed, find the parent board and validate
    if (status !== undefined) {
      const board = await Board.findOne({ tasks: req.params.taskId })
      if (!board) throw notFound('Parent board not found')
      if (!board.statuses.includes(status)) {
        throw validationError(
          `Status "${status}" is not in the board's allowed statuses: ${board.statuses.join(', ')}`
        )
      }
    }

    // Apply the update. `new: true` returns the updated document.
    // `runValidators: true` enforces Mongoose schema validators on update.
    const task = await Task.findByIdAndUpdate(
      req.params.taskId,
      update,
      { new: true, runValidators: true }
    )
    if (!task) throw notFound('Task not found')

    res.json({ data: { task } })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/tasks/:taskId
// Removes the task and pulls its ID from the parent board's tasks array.
router.delete('/:taskId', async (req, res, next) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.taskId)
    if (!task) throw notFound('Task not found')

    // Remove the task reference from the parent board
    // $pull removes all matching values from the array
    await Board.updateOne(
      { tasks: req.params.taskId },
      { $pull: { tasks: req.params.taskId } }
    )

    res.json({ data: { message: 'Task deleted' } })
  } catch (err) {
    next(err)
  }
})

export default router
