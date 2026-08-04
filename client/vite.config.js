// Vite config — we set explicit ports to avoid conflicts with the API server (5001)
// `server.port` is the dev server, `preview.port` is for `vite preview` (production build preview)
// `server.proxy` forwards `/api` calls to the Express server during development
// In production (Vercel), the same `/api` path is handled by vercel.json rewrites
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 5173,
  },
})
