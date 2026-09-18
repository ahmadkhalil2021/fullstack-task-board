// useView.js — Derive the active board view from the URL.
// The URL is the single source of truth for view selection; unknown
// sub-paths fall back to Kanban only for the exact board root.

import { useLocation } from 'react-router-dom'

const EXTRA_VIEWS = ['list', 'grid', 'table']

export const useView = () => {
  const { pathname } = useLocation()
  const segments = pathname.split('/').filter(Boolean)
  if (
    segments.length === 3 &&
    segments[0] === 'board' &&
    EXTRA_VIEWS.includes(segments[2])
  ) {
    return segments[2]
  }
  return 'kanban'
}
