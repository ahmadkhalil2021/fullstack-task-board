// __tests__/boards.test.js — End-to-end tests for the boards API
// Uses mongodb-memory-server to run a real MongoDB in-process.
// Uses Node's built-in test runner (no Jest/Vitest needed).

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
  // Start in-memory MongoDB and set the URI
  mongo = await MongoMemoryServer.create()
  process.env.MONGODB_URI = mongo.getUri()
  // Reset the cached connection so connectDB picks up the new URI
  mongoose.connection.readyState === 0 && (await connectDB())
})

after(async () => {
  await mongoose.disconnect()
  await mongo.stop()
})

beforeEach(async () => {
  // Clean the database between tests
  const collections = mongoose.connection.collections
  for (const key in collections) {
    await collections[key].deleteMany({})
  }
})

// --- GET /api/boards/:boardId ---

test('GET /api/boards/:boardId returns 404 for missing board', async () => {
  const fakeId = '64b2f1a000000000000000aa'
  const res = await request(app).get(`/api/boards/${fakeId}`)
  assert.equal(res.status, 404)
  assert.equal(res.body.error.code, 'NOT_FOUND')
})

test('GET /api/boards/:boardId returns board with populated tasks', async () => {
  // Create a board first via POST
  const create = await request(app).post('/api/boards').send({})
  const boardId = create.body.data.board._id

  const res = await request(app).get(`/api/boards/${boardId}`)
  assert.equal(res.status, 200)
  assert.equal(res.body.data.board._id, boardId)
  assert.ok(Array.isArray(res.body.data.board.tasks))
  assert.equal(res.body.data.board.tasks.length, 5)  // 5 default tasks
  assert.equal(res.body.data.board.statuses.length, 5)
})

// --- POST /api/boards ---

test('POST /api/boards creates a board with default statuses', async () => {
  const res = await request(app).post('/api/boards').send({})
  assert.equal(res.status, 201)
  const board = res.body.data.board
  assert.equal(board.name, 'My Task Board')
  assert.equal(board.description, '')
  assert.deepEqual(board.statuses, ['Backlog', 'Ready', 'In progress', 'In review', 'Done'])
  assert.equal(board.tasks.length, 5)
})

test('POST /api/boards accepts custom name and description', async () => {
  const res = await request(app).post('/api/boards').send({
    name: 'My Project',
    description: 'Sprint board',
  })
  assert.equal(res.status, 201)
  assert.equal(res.body.data.board.name, 'My Project')
  assert.equal(res.body.data.board.description, 'Sprint board')
})

test('POST /api/boards accepts custom statuses', async () => {
  const res = await request(app).post('/api/boards').send({
    statuses: ['Backlog', 'Doing', 'Done'],
  })
  assert.equal(res.status, 201)
  assert.deepEqual(res.body.data.board.statuses, ['Backlog', 'Doing', 'Done'])
  assert.equal(res.body.data.board.tasks.length, 3)
})

test('POST /api/boards creates one task per status', async () => {
  const res = await request(app).post('/api/boards').send({
    statuses: ['A', 'B', 'C'],
  })
  const tasks = res.body.data.board.tasks
  assert.equal(tasks.length, 3)
  assert.deepEqual(tasks.map(t => t.status), ['A', 'B', 'C'])
  assert.deepEqual(tasks.map(t => t.name), ['Task A', 'Task B', 'Task C'])
})

test('POST /api/boards rejects empty statuses array', async () => {
  const res = await request(app).post('/api/boards').send({ statuses: [] })
  assert.equal(res.status, 400)
  assert.equal(res.body.error.code, 'VALIDATION_ERROR')
})

// --- PUT /api/boards/:boardId ---

test('PUT /api/boards/:boardId updates name', async () => {
  const create = await request(app).post('/api/boards').send({})
  const boardId = create.body.data.board._id

  const res = await request(app).put(`/api/boards/${boardId}`).send({ name: 'Updated' })
  assert.equal(res.status, 200)
  assert.equal(res.body.data.board.name, 'Updated')
})

test('PUT /api/boards/:boardId updates statuses', async () => {
  const create = await request(app).post('/api/boards').send({})
  const boardId = create.body.data.board._id

  const res = await request(app).put(`/api/boards/${boardId}`).send({
    statuses: ['Todo', 'Doing', 'Done'],
  })
  assert.equal(res.status, 200)
  assert.deepEqual(res.body.data.board.statuses, ['Todo', 'Doing', 'Done'])
})

test('PUT /api/boards/:boardId with empty body returns 400', async () => {
  const create = await request(app).post('/api/boards').send({})
  const boardId = create.body.data.board._id

  const res = await request(app).put(`/api/boards/${boardId}`).send({})
  assert.equal(res.status, 400)
})

test('PUT /api/boards/:boardId returns 404 for missing board', async () => {
  const fakeId = '64b2f1a000000000000000aa'
  const res = await request(app).put(`/api/boards/${fakeId}`).send({ name: 'x' })
  assert.equal(res.status, 404)
})

// --- DELETE /api/boards/:boardId ---

test('DELETE /api/boards/:boardId deletes board and cascades tasks', async () => {
  const create = await request(app).post('/api/boards').send({})
  const boardId = create.body.data.board._id
  const taskIds = create.body.data.board.tasks.map(t => t._id)

  const res = await request(app).delete(`/api/boards/${boardId}`)
  assert.equal(res.status, 200)
  assert.equal(res.body.data.message, 'Board deleted')

  // Verify board is gone
  const getRes = await request(app).get(`/api/boards/${boardId}`)
  assert.equal(getRes.status, 404)

  // Verify tasks are gone (cascade)
  const Task = (await import('../models/Task.js')).default
  for (const taskId of taskIds) {
    const task = await Task.findById(taskId)
    assert.equal(task, null, `Task ${taskId} should have been deleted`)
  }
})

test('DELETE /api/boards/:boardId returns 404 for missing board', async () => {
  const fakeId = '64b2f1a000000000000000aa'
  const res = await request(app).delete(`/api/boards/${fakeId}`)
  assert.equal(res.status, 404)
})
