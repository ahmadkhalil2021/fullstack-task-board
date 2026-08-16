// __tests__/activity.test.js — Tests for the board activity feed
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
const { default: Activity } = await import('../models/Activity.js')

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

const createBoard = async (statuses = ['A', 'B', 'C']) => {
  const res = await request(app).post('/api/boards').send({ statuses })
  return res.body.data.board
}

// --- Model validation ---

test('Activity rejects an unknown type', async () => {
  const boardId = new mongoose.Types.ObjectId()
  await assert.rejects(
    Activity.create({ boardId, type: 'not_a_type' }),
    (err) => err.name === 'ValidationError'
  )
})

test('Activity requires a boardId', async () => {
  await assert.rejects(
    Activity.create({ type: 'task_created' }),
    (err) => err.name === 'ValidationError'
  )
})

// --- GET /api/boards/:boardId/activity ---

test('GET activity returns 404 for an unknown board', async () => {
  const fakeId = '64b2f1a000000000000000aa'
  const res = await request(app).get(`/api/boards/${fakeId}/activity`)
  assert.equal(res.status, 404)
  assert.equal(res.body.error.code, 'NOT_FOUND')
})

test('GET activity returns events newest-first', async () => {
  const board = await createBoard(['A', 'B'])
  const taskId = board.tasks[0]._id

  await request(app).put(`/api/tasks/${taskId}`).send({ status: 'B' }) // task_moved
  await request(app).post('/api/tasks').send({ name: 'New', status: 'A', parentBoardId: board._id }) // task_created

  const res = await request(app).get(`/api/boards/${board._id}/activity`)
  assert.equal(res.status, 200)
  assert.equal(res.body.data.hasMore, false)
  assert.equal(res.body.data.activities.length, 2)
  assert.equal(res.body.data.activities[0].type, 'task_created')
  assert.equal(res.body.data.activities[1].type, 'task_moved')
})

test('GET activity respects limit and reports hasMore', async () => {
  const board = await createBoard(['A'])
  for (let i = 0; i < 3; i++) {
    await request(app).post('/api/tasks').send({ name: `Task ${i}`, status: 'A', parentBoardId: board._id })
  }

  const res = await request(app).get(`/api/boards/${board._id}/activity?limit=2`)
  assert.equal(res.status, 200)
  assert.equal(res.body.data.activities.length, 2)
  assert.equal(res.body.data.hasMore, true)
})

test('GET activity paginates with the before cursor', async () => {
  const board = await createBoard(['A'])
  for (let i = 0; i < 3; i++) {
    await request(app).post('/api/tasks').send({ name: `Task ${i}`, status: 'A', parentBoardId: board._id })
  }

  const first = await request(app).get(`/api/boards/${board._id}/activity?limit=2`)
  const page = first.body.data.activities
  assert.equal(page.length, 2)

  const oldestId = page[1]._id
  const second = await request(app).get(`/api/boards/${board._id}/activity?before=${oldestId}`)
  assert.equal(second.status, 200)
  assert.equal(second.body.data.activities.length, 1)
  assert.equal(second.body.data.hasMore, false)
})

test('GET activity returns 400 for an invalid limit', async () => {
  const board = await createBoard(['A'])
  const res = await request(app).get(`/api/boards/${board._id}/activity?limit=0`)
  assert.equal(res.status, 400)
  assert.equal(res.body.error.code, 'VALIDATION_ERROR')
})

test('GET activity returns 400 for a malformed before cursor', async () => {
  const board = await createBoard(['A'])
  const res = await request(app).get(`/api/boards/${board._id}/activity?before=not-an-id`)
  assert.equal(res.status, 400)
  assert.equal(res.body.error.code, 'VALIDATION_ERROR')
})

// --- Mutation hooks emit activity ---

test('POST /api/tasks emits task_created', async () => {
  const board = await createBoard(['A'])
  const res = await request(app).post('/api/tasks').send({ name: 'New task', status: 'A', parentBoardId: board._id })
  const taskId = res.body.data.task._id

  const activities = await Activity.find({ boardId: board._id })
  assert.equal(activities.length, 1)
  assert.equal(activities[0].type, 'task_created')
  assert.equal(String(activities[0].taskId), taskId)
  assert.equal(activities[0].taskName, 'New task')
})

test('PUT task status emits task_moved', async () => {
  const board = await createBoard(['A', 'B'])
  const taskId = board.tasks[0]._id

  await request(app).put(`/api/tasks/${taskId}`).send({ status: 'B' })

  const activities = await Activity.find({ boardId: board._id })
  assert.equal(activities.length, 1)
  assert.equal(activities[0].type, 'task_moved')
  assert.deepEqual(activities[0].changes.status, { from: 'A', to: 'B' })
})

test('PUT task name emits task_updated', async () => {
  const board = await createBoard(['A'])
  const taskId = board.tasks[0]._id

  await request(app).put(`/api/tasks/${taskId}`).send({ name: 'Renamed' })

  const activities = await Activity.find({ boardId: board._id })
  assert.equal(activities.length, 1)
  assert.equal(activities[0].type, 'task_updated')
  assert.deepEqual(activities[0].changes.name, { from: 'Task A', to: 'Renamed' })
})

test('DELETE task emits task_deleted with a taskName snapshot', async () => {
  const board = await createBoard(['A', 'B'])
  const taskId = board.tasks[0]._id
  const taskName = board.tasks[0].name

  await request(app).delete(`/api/tasks/${taskId}`)

  const activities = await Activity.find({ boardId: board._id })
  assert.equal(activities.length, 1)
  assert.equal(activities[0].type, 'task_deleted')
  assert.equal(activities[0].taskName, taskName)
})

test('PUT board name emits board_updated', async () => {
  const board = await createBoard(['A'])

  await request(app).put(`/api/boards/${board._id}`).send({ name: 'New Board Name' })

  const activities = await Activity.find({ boardId: board._id })
  assert.equal(activities.length, 1)
  assert.equal(activities[0].type, 'board_updated')
  assert.deepEqual(activities[0].changes.name, { from: 'My Task Board', to: 'New Board Name' })
})

test('PUT board statuses emits status_renamed for same-index changes', async () => {
  const board = await createBoard(['A', 'B'])

  await request(app).put(`/api/boards/${board._id}`).send({ statuses: ['A', 'X'] })

  const activities = await Activity.find({ boardId: board._id })
  assert.equal(activities.length, 1)
  assert.equal(activities[0].type, 'status_renamed')
  assert.deepEqual(activities[0].changes.status, { from: 'B', to: 'X' })
})

test('PUT board statuses emits status_added for appended statuses', async () => {
  const board = await createBoard(['A', 'B'])

  await request(app).put(`/api/boards/${board._id}`).send({ statuses: ['A', 'B', 'C'] })

  const activities = await Activity.find({ boardId: board._id })
  assert.equal(activities.length, 1)
  assert.equal(activities[0].type, 'status_added')
  assert.deepEqual(activities[0].changes.status, { to: 'C' })
})

test('PUT board statuses emits status_removed for dropped statuses', async () => {
  const board = await createBoard(['A', 'B', 'C'])

  await request(app).put(`/api/boards/${board._id}`).send({ statuses: ['A'] })

  const activities = await Activity.find({ boardId: board._id }).sort({ _id: 1 })
  assert.equal(activities.length, 2)
  assert.equal(activities[0].type, 'status_removed')
  assert.equal(activities[1].type, 'status_removed')
  assert.deepEqual(activities[0].changes.status, { from: 'B' })
  assert.deepEqual(activities[1].changes.status, { from: 'C' })
})

test('DELETE board removes its activities', async () => {
  const board = await createBoard(['A'])
  await request(app).post('/api/tasks').send({ name: 'New', status: 'A', parentBoardId: board._id })

  const before = await Activity.countDocuments({ boardId: board._id })
  assert.equal(before, 1)

  await request(app).delete(`/api/boards/${board._id}`)

  const after = await Activity.countDocuments({ boardId: board._id })
  assert.equal(after, 0)
})
