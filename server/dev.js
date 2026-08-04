// dev.js — local development entry point
// Starts an in-memory MongoDB if MONGODB_URI is not set, then connects
// and starts the Express server.

import 'dotenv/config'
import app from './index.js'

const PORT = process.env.PORT || 5001

const start = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      // Dev fallback: spin up an in-process MongoDB so you don't need Atlas locally
      // First run downloads the binary (~90MB) to ~/.cache/mongodb-binaries
      const { MongoMemoryServer } = await import('mongodb-memory-server')
      const mongo = new MongoMemoryServer()
      await mongo.start()
      process.env.MONGODB_URI = mongo.getUri()
      console.log(`In-memory MongoDB started at ${process.env.MONGODB_URI}`)
    }

    const { connectDB } = await import('./db.js')
    await connectDB()

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`)
    })
  } catch (err) {
    console.error('Failed to start server:', err.message)
    process.exit(1)
  }
}

start()
