// Task model — a single task on a board.
// Status must be one of three values matching the board's columns.

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
  // Enum enforces the three allowed column values at the DB layer.
  // The API layer also validates for clearer error messages.
  status: {
    type: String,
    enum: ['In Progress', 'Completed', "Won't do"],
    default: 'In Progress',
  },
}, {
  // Adds createdAt + updatedAt automatically
  timestamps: true,
})

const Task = mongoose.model('Task', taskSchema)

export default Task
