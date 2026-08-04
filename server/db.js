// db.js — Mongoose connection helper
// Caches the connection across calls so we don't open a new connection
// on every serverless cold start (Vercel reuses functions but each cold
// start is fresh). Pattern from the Mongoose docs.

import mongoose from 'mongoose'

let cachedConnection = null

export const connectDB = async () => {
  // If we already have a connection, reuse it
  if (cachedConnection) return cachedConnection

  // Read the connection string from environment
  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set')
  }

  // Connect with sensible defaults
  // serverSelectionTimeoutMS: 5000 means we fail fast instead of hanging
  const connection = await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  })

  cachedConnection = connection
  return connection
}
