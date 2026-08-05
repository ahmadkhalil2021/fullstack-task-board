// Task model — a single task on a board.
// Status is a free string, but the API layer enforces that it must be
// one of the values in the parent board's `statuses` array.
// `order` is a numeric sort key within the task's status column.

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
  // Sort order within the task's status column. Lower = first.
  // Set by the API when tasks are created or reordered.
  order: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
})

const Task = mongoose.model('Task', taskSchema)

export default Task
