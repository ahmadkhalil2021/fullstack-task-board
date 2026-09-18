// scripts/migrate-task-fields.js — Idempotent backfill for dueDate/priority.
// Run with: npm run migrate:task-fields  (requires MONGODB_URI)
// The dev in-memory MongoDB is process-local, so this script is meant for
// real databases; run it with a backup and a maintenance window ready.

import 'dotenv/config'
import { pathToFileURL } from 'node:url'
import mongoose from 'mongoose'
import Task from '../models/Task.js'
import { connectDB } from '../db.js'

export const migrateTaskFields = async (TaskModel = Task, log = console.log) => {
  const missingDueDate = await TaskModel.find({ dueDate: { $exists: false } }).select('_id')
  const missingPriority = await TaskModel.find({ priority: { $exists: false } }).select('_id')

  let updated = 0

  for (const doc of missingDueDate) {
    await TaskModel.updateOne({ _id: doc._id }, { $set: { dueDate: null } })
    log(`Updated ${doc._id}: dueDate -> null`)
    updated += 1
  }

  for (const doc of missingPriority) {
    await TaskModel.updateOne({ _id: doc._id }, { $set: { priority: 'none' } })
    log(`Updated ${doc._id}: priority -> none`)
    updated += 1
  }

  log(`Migration complete. ${updated} field(s) updated.`)
  return updated
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isCli) {
  const run = async () => {
    await connectDB()
    await migrateTaskFields()
    await mongoose.disconnect()
  }
  run().catch(async (err) => {
    console.error('Migration failed:', err.message)
    await mongoose.disconnect().catch(() => {})
    process.exit(1)
  })
}
