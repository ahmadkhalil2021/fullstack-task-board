// routes/activities.js — Board activity feed endpoint
// Exposes the persisted audit trail for a board, newest first, with
// cursor-based pagination via the `before` query param (the last seen _id).

import express from 'express'
import mongoose from 'mongoose'
import Board from '../models/Board.js'
import Activity from '../models/Activity.js'
import { notFound, validationError } from '../lib/errors.js'

const router = express.Router()

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

// GET /api/boards/:boardId/activity?limit=N&before=<id>
router.get('/:boardId/activity', async (req, res, next) => {
  try {
    const { boardId } = req.params

    const board = await Board.findById(boardId)
    if (!board) throw notFound('Board not found')

    let limit = DEFAULT_LIMIT
    if (req.query.limit !== undefined) {
      const parsed = Number(req.query.limit)
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
        throw validationError(`limit must be an integer between 1 and ${MAX_LIMIT}`)
      }
      limit = parsed
    }

    const query = { boardId }
    if (req.query.before !== undefined) {
      if (!mongoose.isValidObjectId(req.query.before)) {
        throw validationError('before must be a valid ObjectId')
      }
      query._id = { $lt: req.query.before }
    }

    // Fetch one extra so we can tell whether there are older events.
    const activities = await Activity.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)

    const hasMore = activities.length > limit
    const results = hasMore ? activities.slice(0, limit) : activities

    res.json({ data: { activities: results, hasMore } })
  } catch (err) {
    next(err)
  }
})

export default router
