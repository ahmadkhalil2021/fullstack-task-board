// Board.js — Mongoose model for boards
// A Board is the top-level entity. It groups tasks into three columns
// ("In Progress", "Completed", "Won't do"). When a board is deleted,
// all of its tasks must be removed too (cascade delete).

import mongoose from 'mongoose'

// Define the Board schema
const boardSchema = new mongoose.Schema({
  // name: the human-readable title of the board
  name: {
    type: String,
    default: 'My Task Board',
    maxlength: 100,
    trim: true,
  },

  // description: optional subtitle or notes about the board
  description: {
    type: String,
    default: '',
    maxlength: 500,
    trim: true,
  },

  // tasks: array of references to Task documents
  // We use ObjectId references (not embedded sub-documents) so that
  // each task can be queried, updated, and deleted independently.
  // The `ref: 'Task'` tells Mongoose what model these IDs point to,
  // which enables `.populate('tasks')` to replace IDs with full task objects.
  tasks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
  }],
}, {
  // timestamps: true adds `createdAt` and `updatedAt` automatically
  timestamps: true,
})

// Cascade delete hook
// `pre('deleteOne')` runs BEFORE a board document is deleted via `board.deleteOne()`.
// `{ document: true }` restricts this hook to instance-level deletes only
// (i.e. when you have a board object and call .deleteOne() on it).
// Without `{ document: true }`, the hook would also fire on bulk queries
// like `Board.deleteOne({ name: 'old' })`, which is NOT what we want —
// we only want cascade when a specific board is being removed.
//
// Note: we use `deleteOne` (not the deprecated `remove`) because
// `deleteOne` is the modern Mongoose API and works with document middleware.
boardSchema.pre('deleteOne', { document: true }, async function () {
  // `this` is the board document being deleted
  // `this.tasks` is the array of task ObjectIds
  // We import Task at the top of the file to avoid a circular dependency
  // (Board depends on Task, but Task does not depend on Board)
  const Task = mongoose.model('Task')
  await Task.deleteMany({ _id: { $in: this.tasks } })
})

// Register the schema as a model named 'Board' and export it
const Board = mongoose.model('Board', boardSchema)

export default Board
