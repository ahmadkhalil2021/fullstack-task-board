// ViewSwitcher.jsx — Icon links that switch between the board views.
// The URL is the source of truth; ?q=/?f= are preserved across switches.

import { Link, useLocation, useParams } from 'react-router-dom'
import { useView } from '../lib/useView.js'

const VIEWS = [
  { key: 'kanban', label: 'Kanban', path: '' },
  { key: 'grid', label: 'Grid', path: '/grid' },
  { key: 'table', label: 'Table', path: '/table' },
]

const KanbanIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4" fill="currentColor">
    <rect x="1" y="1" width="4" height="14" rx="1" />
    <rect x="6" y="1" width="4" height="9" rx="1" />
    <rect x="11" y="1" width="4" height="12" rx="1" />
  </svg>
)

const GridIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4" fill="currentColor">
    <rect x="1" y="1" width="6" height="6" rx="1" />
    <rect x="9" y="1" width="6" height="6" rx="1" />
    <rect x="1" y="9" width="6" height="6" rx="1" />
    <rect x="9" y="9" width="6" height="6" rx="1" />
  </svg>
)

const TableIcon = () => (
  <svg
    viewBox="0 0 16 16"
    aria-hidden="true"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <rect x="1" y="2" width="14" height="12" rx="1" />
    <path d="M1 6h14M6 6v8" />
  </svg>
)

const ICONS = {
  kanban: KanbanIcon,
  grid: GridIcon,
  table: TableIcon,
}

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
        const Icon = ICONS[key]
        return (
          <Link
            key={key}
            to={`/board/${boardId}${path}${search}`}
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
            title={label}
            className={`inline-flex items-center justify-center rounded px-2.5 py-2 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle ${
              isActive
                ? 'bg-surface-raised text-surface-text shadow-card'
                : 'text-surface-text-muted hover:bg-surface-raised'
            }`}
          >
            <Icon />
          </Link>
        )
      })}
    </nav>
  )
}

export default ViewSwitcher
