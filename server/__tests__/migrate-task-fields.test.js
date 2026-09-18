// __tests__/migrate-task-fields.test.js — Idempotent dueDate/priority backfill.

import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'

let mongo

before(async () => {
  mongo = await MongoMemoryServer.create()
  process.env.MONGODB_URI = mongo.getUri()
  if (mongoose.connection.readyState === 0) {
    const { connectDB } = await import('../db.js')
    await connectDB()
  }
})

after(async () => {
  await mongoose.disconnect()
  await mongo.stop()
})

beforeEach(async () => {
  await mongoose.connection.collection('tasks').deleteMany({})
})

test('backfills missing fields idempotently and logs the changes', async () => {
  const raw = mongoose.connection.collection('tasks')
  await raw.insertMany([
    { name: 'Legacy A', status: 'A', order: 0 },
    { name: 'Legacy B', status: 'A', order: 1, dueDate: null },
  ])

  const { migrateTaskFields } = await import('../scripts/migrate-task-fields.js')
  const { default: Task } = await import('../models/Task.js')

  const logs = []
  const first = await migrateTaskFields(Task, (line) => logs.push(line))
  assert.equal(first, 3) // A: dueDate + priority, B: priority only
  assert.ok(logs.some((line) => line.includes('dueDate -> null')))
  assert.ok(logs.some((line) => line.includes('priority -> none')))
  assert.ok(logs.some((line) => line.includes('3 field(s) updated')))

  const second = await migrateTaskFields(Task, () => {})
  assert.equal(second, 0)

  const a = await raw.findOne({ name: 'Legacy A' })
  const b = await raw.findOne({ name: 'Legacy B' })
  assert.equal(a.dueDate, null)
  assert.equal(a.priority, 'none')
  assert.equal(b.dueDate, null)
  assert.equal(b.priority, 'none')
})
