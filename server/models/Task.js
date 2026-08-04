// Task.js — Mongoose model for tasks
// Tasks belong to a Board. Each task has a name, optional description,
// an emoji icon, and a status that maps to one of the board's columns.

// Import mongoose — gives us the Schema class and the `model` function
// for registering the model with Mongoose
import mongoose from 'mongoose'

// Define the Task schema
// Schemas are the shape of the document. They declare fields, types,
// defaults, and validators. Mongoose turns each schema into a model
// you can use to create, read, update, and delete documents.
const taskSchema = new mongoose.Schema({
  // name: required-by-default string for the task title
  // `trim` removes leading/trailing whitespace before saving
  // `maxlength` enforces a hard cap so a user can't paste a novel
  name: {
    type: String,
    default: 'New Task',
    maxlength: 100,
    trim: true,
  },

  // description: optional long-form text
  description: {
    type: String,
    default: '',
    maxlength: 1000,
    trim: true,
  },

  // icon: short emoji (or any short string) used as the task's visual marker
  // We store it as text rather than an image so it's portable and easy to render
  icon: {
    type: String,
    default: '⏰',
    maxlength: 10,
  },

  // status: one of three fixed values matching the board's columns
  // `enum` validation makes Mongoose reject any value not in the list
  // This is the first line of defense — the API layer also validates for clearer errors
  status: {
    type: String,
    enum: ['In Progress', 'Completed', "Won't do"],
    default: 'In Progress',
  },
}, {
  // timestamps: true tells Mongoose to automatically add `createdAt`
  // and `updatedAt` fields. We use these for sorting and audit trails.
  timestamps: true,
})

// Register the schema as a model named 'Task' and export it
// The string 'Task' is what other schemas use in `ref: 'Task'` to
// create a relationship (e.g. Board.tasks[])
const Task = mongoose.model('Task', taskSchema)

export default Task
