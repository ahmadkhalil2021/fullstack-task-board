// Board model — top-level entity. Groups tasks into three columns.
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
  // `this` is the board being deleted. `this.tasks` holds the task IDs.
  // We look up the Task model via mongoose.model() (not import) to avoid
  // a circular dependency: Board depends on Task, but Task does not depend on Board.
  const Task = mongoose.model('Task')
  await Task.deleteMany({ _id: { $in: this.tasks } })
})

const Board = mongoose.model('Board', boardSchema)

export default Board
