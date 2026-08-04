// __tests__/tasks.test.js — End-to-end tests for the tasks API
// Uses mongodb-memory-server and supertest, same as boards.test.js.

import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import request from 'supertest'

// Set the env var BEFORE importing the app
let mongo
process.env.MONGODB_URI = ''

// Import after env is set
const { default: app } = await import('../index.js')
const { connectDB } = await import('../db.js')

before(async () => {
  mongo = await MongoMemoryServer.create()
  process.env.MONGODB_URI = mongo.getUri()
  if (mongoose.connection.readyState === 0) await connectDB()
})

after(async () => {
  await mongoose.disconnect()
  await mongo.stop()
})

beforeEach(async () => {
  const collections = mongoose.connection.collections
  for (const key in collections) {
    await collections[key].deleteMany({})
  }
})

// Helper to create a board and return its first task
const createBoardWithTasks = async (statuses = ['A', 'B']) => {
  const res = await request(app).post('/api/boards').send({ statuses })
  return res.body.data.board
}

// --- PUT /api/tasks/:taskId ---

test('PUT /api/tasks/:taskId updates name', async () => {
  const board = await createBoardWithTasks(['A', 'B'])
  const taskId = board.tasks[0]._id

  const res = await request(app).put(`/api/tasks/${taskId}`).send({ name: 'Renamed' })
  assert.equal(res.status, 200)
  assert.equal(res.body.data.task.name, 'Renamed')
})

test('PUT /api/tasks/:taskId updates description', async () => {
  const board = await createBoardWithTasks(['A'])
  const taskId = board.tasks[0]._id

  const res = await request(app).put(`/api/tasks/${taskId}`).send({ description: 'New desc' })
  assert.equal(res.status, 200)
  assert.equal(res.body.data.task.description, 'New desc')
})

test('PUT /api/tasks/:taskId updates icon', async () => {
  const board = await createBoardWithTasks(['A'])
  const taskId = board.tasks[0]._id

  const res = await request(app).put(`/api/tasks/${taskId}`).send({ icon: '🚀' })
  assert.equal(res.status, 200)
  assert.equal(res.body.data.task.icon, '🚀')
})

test('PUT /api/tasks/:taskId updates status to a valid one', async () => {
  const board = await createBoardWithTasks(['A', 'B', 'C'])
  const taskId = board.tasks[0]._id

  const res = await request(app).put(`/api/tasks/${taskId}`).send({ status: 'C' })
  assert.equal(res.status, 200)
  assert.equal(res.body.data.task.status, 'C')
})

test('PUT /api/tasks/:taskId rejects status not in board.statuses', async () => {
  const board = await createBoardWithTasks(['A', 'B'])
  const taskId = board.tasks[0]._id

  const res = await request(app).put(`/api/tasks/${taskId}`).send({ status: 'NotAllowed' })
  assert.equal(res.status, 400)
  assert.equal(res.body.error.code, 'VALIDATION_ERROR')
})

test('PUT /api/tasks/:taskId updates multiple fields at once', async () => {
  const board = await createBoardWithTasks(['A', 'B'])
  const taskId = board.tasks[0]._id

  const res = await request(app).put(`/api/tasks/${taskId}`).send({
    name: 'Multi',
    icon: '🎯',
    status: 'B',
  })
  assert.equal(res.status, 200)
  assert.equal(res.body.data.task.name, 'Multi')
  assert.equal(res.body.data.task.icon, '🎯')
  assert.equal(res.body.data.task.status, 'B')
})

test('PUT /api/tasks/:taskId with empty body returns 400', async () => {
  const board = await createBoardWithTasks(['A'])
  const taskId = board.tasks[0]._id

  const res = await request(app).put(`/api/tasks/${taskId}`).send({})
  assert.equal(res.status, 400)
  assert.equal(res.body.error.code, 'VALIDATION_ERROR')
})

test('PUT /api/tasks/:taskId returns 404 for missing task', async () => {
  const fakeId = '64b2f1a000000000000000aa'
  const res = await request(app).put(`/api/tasks/${fakeId}`).send({ name: 'x' })
  assert.equal(res.status, 404)
  assert.equal(res.body.error.code, 'NOT_FOUND')
})

// --- DELETE /api/tasks/:taskId ---

test('DELETE /api/tasks/:taskId deletes the task', async () => {
  const board = await createBoardWithTasks(['A', 'B'])
  const taskId = board.tasks[0]._id

  const res = await request(app).delete(`/api/tasks/${taskId}`)
  assert.equal(res.status, 200)
  assert.equal(res.body.data.message, 'Task deleted')

  // Verify it's gone
  const get = await request(app).put(`/api/tasks/${taskId}`).send({ name: 'x' })
  assert.equal(get.status, 404)
})

test('DELETE /api/tasks/:taskId removes from board.tasks array', async () => {
  const board = await createBoardWithTasks(['A', 'B', 'C'])
  const taskId = board.tasks[0]._id
  const boardId = board._id

  await request(app).delete(`/api/tasks/${taskId}`)

  // Re-fetch the board and check the tasks array
  const res = await request(app).get(`/api/boards/${boardId}`)
  const remainingIds = res.body.data.board.tasks.map(t => t._id)
  assert.equal(remainingIds.length, 2)
  assert.ok(!remainingIds.includes(taskId))
})

test('DELETE /api/tasks/:taskId returns 404 for missing task', async () => {
  const fakeId = '64b2f1a000000000000000aa'
  const res = await request(app).delete(`/api/tasks/${fakeId}`)
  assert.equal(res.status, 404)
})

test('DELETE /api/tasks/:taskId does not delete the board', async () => {
  const board = await createBoardWithTasks(['A', 'B'])
  const taskId = board.tasks[0]._id
  const boardId = board._id

  await request(app).delete(`/api/tasks/${taskId}`)

  // Board should still exist
  const res = await request(app).get(`/api/boards/${boardId}`)
  assert.equal(res.status, 200)
  assert.equal(res.body.data.board.tasks.length, 1)  // 1 task left
})
