// useView.js — Derive the active board view from the URL.
// The URL is the single source of truth for view selection; unknown
// sub-paths fall back to Kanban only for the exact board root.

import { useLocation } from 'react-router-dom'

export const useView = () => {
  const { pathname } = useLocation()
  const segments = pathname.split('/').filter(Boolean)
  return segments.length === 3 && segments[0] === 'board' && segments[2] === 'list'
    ? 'list'
    : 'kanban'
}
