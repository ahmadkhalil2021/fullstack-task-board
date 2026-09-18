// ViewSwitcher.jsx — Pill links that switch between Kanban and List.
// The URL is the source of truth; ?q=/?f= are preserved across switches.

import { Link, useLocation, useParams } from 'react-router-dom'
import { useView } from '../lib/useView.js'

const VIEWS = [
  { key: 'kanban', label: 'Kanban', path: '' },
  { key: 'list', label: 'List', path: '/list' },
]

const ViewSwitcher = () => {
  const { boardId } = useParams()
  const { search } = useLocation()
  const view = useView()

  return (
    <nav
      aria-label="Board view"
      className="inline-flex gap-1 rounded-card border border-surface-border bg-surface-muted p-1"
    >
      {VIEWS.map(({ key, label, path }) => {
        const isActive = view === key
        return (
          <Link
            key={key}
            to={`/board/${boardId}${path}${search}`}
            aria-current={isActive ? 'page' : undefined}
            className={`rounded px-3 py-1.5 text-sm font-medium transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle ${
              isActive
                ? 'bg-surface-raised text-surface-text shadow-card'
                : 'text-surface-text-muted hover:bg-surface-raised'
            }`}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

export default ViewSwitcher
