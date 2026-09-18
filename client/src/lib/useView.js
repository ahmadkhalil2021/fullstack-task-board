// useView.js — Derive the active board view from the URL.
// Only the four exact board paths map to a view; anything else returns null
// so a malformed URL can never be mistaken for Kanban. The router remains the
// 404 authority for unknown paths.

import { useLocation } from 'react-router-dom'

const EXTRA_VIEWS = ['grid', 'table', 'calendar']

export const useView = () => {
  const { pathname } = useLocation()
  const segments = pathname.split('/').filter(Boolean)
  if (segments[0] !== 'board') return null
  if (segments.length === 2) return 'kanban'
  if (segments.length === 3 && EXTRA_VIEWS.includes(segments[2])) return segments[2]
  return null
}
