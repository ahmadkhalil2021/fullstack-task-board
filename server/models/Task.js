// Task model — a single task on a board.
// Status is a free string, but the API layer enforces that it must be
// one of the values in the parent board's `statuses` array.

import mongoose from 'mongoose'

const taskSchema = new mongoose.Schema({
  name: {
    type: String,
    default: 'New Task',
    maxlength: 100,
    trim: true,
  },
  description: {
    type: String,
    default: '',
    maxlength: 1000,
    trim: true,
  },
  // Stored as text (not image) so it's portable and easy to render
  icon: {
    type: String,
    default: '⏰',
    maxlength: 10,
  },
  // Free-form string. The enum was removed (see ADR-0007) so users can
  // define their own column names per board. The API layer validates
  // the value against the parent board's `statuses` array.
  status: {
    type: String,
    default: 'Backlog',
  },
}, {
  // Adds createdAt + updatedAt automatically
  timestamps: true,
})

const Task = mongoose.model('Task', taskSchema)

export default Task
