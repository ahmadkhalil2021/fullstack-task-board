// index.js — Express app entry point
// IMPORTANT: this file ONLY exports the app. It does NOT call app.listen().
// Vercel deploys this as a serverless function: it imports `app` and
// handles requests itself. For local development, dev.js imports this file
// and calls listen().

import express from 'express'
import cors from 'cors'
import boardsRouter from './routes/boards.js'
import { errorHandler } from './middleware/errorHandler.js'

const app = express()

// CORS — allows the Vite dev server to call our API.
// In production they share a domain, so CORS is not strictly required,
// but we leave it on for flexibility.
app.use(cors())

// JSON body parser — needed for req.body on POST/PUT requests
app.use(express.json())

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

// Resource routes
app.use('/api/boards', boardsRouter)

// Error handler — must be last so it catches errors from all routes above
app.use(errorHandler)

export default app
