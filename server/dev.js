// dev.js — local development entry point
// Loads env vars, connects to MongoDB, then starts the HTTP server.

import 'dotenv/config'
import app from './index.js'
import { connectDB } from './db.js'

const PORT = process.env.PORT || 5001

const start = async () => {
  try {
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
