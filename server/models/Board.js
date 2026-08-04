// Board model — top-level entity. Groups tasks into columns.
// When a board is deleted, all of its tasks are removed too (cascade).

import mongoose from 'mongoose'

const boardSchema = new mongoose.Schema({
  name: {
    type: String,
    default: 'My Task Board',
    maxlength: 100,
    trim: true,
  },
  description: {
    type: String,
    default: '',
    maxlength: 500,
    trim: true,
  },
  // User-defined column names. Each task's `status` must be one of these strings.
  // The API layer validates this (Mongoose can't, because the allowed values
  // live in the parent document, not the task schema).
  // Defaults match the project's Kanban workflow stages.
  statuses: {
    type: [String],
    default: ['Backlog', 'Ready', 'In progress', 'In review', 'Done'],
    validate: {
      validator: (arr) => Array.isArray(arr) && arr.length >= 1 && arr.every((s) => typeof s === 'string' && s.trim().length > 0),
      message: 'statuses must be a non-empty array of non-empty strings',
    },
  },
  // ObjectId refs (not embedded docs) so each task can be queried,
  // updated, and deleted independently. Use .populate('tasks') to load them.
  tasks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
  }],
}, {
  timestamps: true,
})

// Cascade delete: removing a board also removes its tasks.
// `{ document: true }` limits this hook to instance deletes (board.deleteOne())
// — without it, bulk queries like Board.deleteOne({ name: 'old' }) would also cascade,
// which is not what we want.
boardSchema.pre('deleteOne', { document: true }, async function () {
  // Look up the Task model via mongoose.model() (not import) to avoid
  // a circular dependency: Board depends on Task, but Task does not depend on Board.
  const Task = mongoose.model('Task')
  await Task.deleteMany({ _id: { $in: this.tasks } })
})

const Board = mongoose.model('Board', boardSchema)

export default Board
