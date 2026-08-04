// index.js — Express app entry point
// IMPORTANT: this file ONLY exports the app. It does NOT call app.listen().
// Why? Because Vercel deploys this as a serverless function: it imports `app`
// and handles requests itself. If we called app.listen() here, it would either
// block the serverless cold start or fail entirely in production.
//
// For local development, see `dev.js` — it imports this file and calls listen().
import express from 'express'
import cors from 'cors'

// Create the Express app instance
const app = express()

// CORS middleware — allows the Vite dev server (localhost:5173) to call our API
// In production, the client and API share the same Vercel domain, so CORS is not needed
// but we leave it on for flexibility (it does not cause issues)
app.use(cors())

// JSON body parser — Express needs this to read JSON request bodies
// Without it, `req.body` would be undefined for JSON requests
app.use(express.json())

// Health check route — useful for verifying the server is alive
// Will be expanded in Issue #3 with the actual board/task API endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

// Export `app` so Vercel (or dev.js) can use it
export default app
