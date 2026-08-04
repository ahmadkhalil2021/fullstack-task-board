// dev.js — local development entry point
// This file exists ONLY for running the server locally with `npm run dev`.
// It imports the `app` exported from index.js and starts an HTTP listener.
//
// This file is NOT used in production. Vercel reads `index.js` directly.
import 'dotenv/config'
import app from './index.js'

// Choose port from environment variable, default to 5001
// We avoid 3000 (commonly used by Next.js) to prevent port conflicts
const PORT = process.env.PORT || 5001

// Start the HTTP server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
