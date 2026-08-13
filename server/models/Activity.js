// Activity model — a single event in a board's activity feed.
// Written by route handlers as a side effect of mutations; read-only for clients.
// `changes` stores an { from / to } pair per modified field so the feed can
// explain "what changed?" without keeping full document snapshots.

import mongoose from 'mongoose'

const ACTIVITY_TYPES = [
  'task_created',
  'task_updated',
  'task_moved',
  'task_deleted',
  'board_updated',
  'status_added',
  'status_renamed',
  'status_removed',
]

const activitySchema = new mongoose.Schema({
  boardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Board',
    required: true,
    index: true,
  },
  type: {
    type: String,
    required: true,
    enum: ACTIVITY_TYPES,
  },
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
  },
  // Snapshot of the task name so deleted-task events stay readable
  // without a join (the task itself no longer exists).
  taskName: {
    type: String,
  },
  // Free-form diff: { field: { from, to } }. Mixed because field names
  // are dynamic and vary per event type.
  changes: {
    type: mongoose.Schema.Types.Mixed,
  },
}, {
  timestamps: true,
})

const Activity = mongoose.model('Activity', activitySchema)

// Emit helper: recording activity is a side effect and must never fail the
// user's request, so creation errors are logged and swallowed here.
export const emitActivity = async (payload) => {
  try {
    await Activity.create(payload)
  } catch (err) {
    console.error('Failed to record activity:', err)
  }
}

export default Activity
