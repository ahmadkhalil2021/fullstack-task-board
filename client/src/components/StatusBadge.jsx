// StatusBadge.jsx — Status name with its color token.
// Shared by the Grid and Table views so status presentation stays consistent.

import { statusColor } from '../lib/statusColor.js'

const StatusBadge = ({ status, className = '' }) => (
  <span className={`inline-flex items-center gap-2 text-surface-text-muted ${className}`}>
    <span
      aria-hidden="true"
      className={`inline-block h-2 w-2 shrink-0 rounded-full bg-status-${statusColor(status)}`}
    />
    {status}
  </span>
)

export default StatusBadge
