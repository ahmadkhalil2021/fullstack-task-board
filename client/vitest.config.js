// vitest.config.js — Vitest setup for client tests
// Uses jsdom for the DOM environment and configures path aliases (none yet).

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
  },
})
