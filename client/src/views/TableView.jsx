// TableView.jsx — Dense, sortable task table.
// Sort state lives in sessionStorage per board; rows are keyboard reachable
// and open the task detail page. Filtering comes from the store (#25).

import { useEffect, useMemo, useState } from 'react'
import { useBoardStore, filterTasks } from '../store/useBoardStore.js'
import StatusBadge from '../components/StatusBadge.jsx'
import { formatRelativeTime } from '../lib/formatRelativeTime.js'

const COLUMNS = [
  { key: 'name', label: 'Name', align: 'left' },
  { key: 'status', label: 'Status', align: 'left' },
  { key: 'createdAt', label: 'Created', align: 'right' },
  { key: 'updatedAt', label: 'Updated', align: 'right' },
]

const VALID_KEYS = COLUMNS.map((column) => column.key)
const VALID_DIRECTIONS = ['asc', 'desc']
const DEFAULT_SORT = { key: 'createdAt', dir: 'desc' }

const storageKey = (boardId) => `board-view-table:${boardId}`

const readStoredSort = (boardId) => {
  try {
    const raw = sessionStorage.getItem(storageKey(boardId))
    if (!raw) return DEFAULT_SORT
    const parsed = JSON.parse(raw)
    if (!VALID_KEYS.includes(parsed?.key) || !VALID_DIRECTIONS.includes(parsed?.dir)) {
      return DEFAULT_SORT
    }
    return { key: parsed.key, dir: parsed.dir }
  } catch {
    return DEFAULT_SORT
  }
}

const sortValue = (task, key) => {
  if (key === 'createdAt' || key === 'updatedAt') {
    const timestamp = new Date(task[key] ?? task.createdAt).getTime()
    return Number.isNaN(timestamp) ? -Infinity : timestamp
  }
  return (task[key] ?? '').toString().toLowerCase()
}

const TableView = ({ onTaskClick }) => {
  const board = useBoardStore(s => s.board)
  const query = useBoardStore(s => s.query)
  const filterStatus = useBoardStore(s => s.filterStatus)

  const [sort, setSort] = useState(() => readStoredSort(board?._id))
  const [now, setNow] = useState(Date.now())

  // Re-render once per minute so relative timestamps stay fresh.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey(board?._id), JSON.stringify(sort))
    } catch {
      // Storage can be unavailable (private mode); sorting still works in memory.
    }
  }, [board?._id, sort])

  const rows = useMemo(() => {
    const filtered = filterTasks(board?.tasks, query, filterStatus)
    return [...filtered].sort((a, b) => {
      const aValue = sortValue(a, sort.key)
      const bValue = sortValue(b, sort.key)
      let compare = aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      if (compare === 0) compare = a._id.localeCompare(b._id)
      return sort.dir === 'asc' ? compare : -compare
    })
  }, [board?.tasks, query, filterStatus, sort])

  if (!board) return null

  const isFiltering = query !== '' || filterStatus !== null

  const toggleSort = (key) => {
    setSort((previous) =>
      previous.key === key
        ? { key, dir: previous.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    )
  }

  const ariaSortFor = (key) => {
    if (sort.key !== key) return 'none'
    return sort.dir === 'asc' ? 'ascending' : 'descending'
  }

  return (
    <div className="overflow-hidden rounded-card border border-surface-border bg-surface-raised">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-surface-border text-left text-xs uppercase tracking-wide text-surface-text-subtle">
            {COLUMNS.map((column) => (
              <th
                key={column.key}
                scope="col"
                aria-sort={ariaSortFor(column.key)}
                className={`px-4 py-2 font-medium ${column.align === 'right' ? 'text-right' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => toggleSort(column.key)}
                  className={`inline-flex items-center gap-1 rounded px-1 py-0.5 uppercase tracking-wide hover:text-surface-text focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle transition-colors duration-200 ${
                    column.align === 'right' ? 'flex-row-reverse' : ''
                  }`}
                >
                  {column.label}
                  {sort.key === column.key && (
                    <span aria-hidden="true" className="text-[10px]">
                      {sort.dir === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                </button>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 && !isFiltering && (
            <tr>
              <td colSpan={COLUMNS.length} className="px-4 py-6 text-center text-sm text-surface-text-subtle">
                No tasks yet
              </td>
            </tr>
          )}

          {rows.map((task) => (
            <tr
              key={task._id}
              tabIndex={0}
              aria-keyshortcuts="Enter"
              onClick={() => onTaskClick(task)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  onTaskClick(task)
                }
              }}
              className="cursor-pointer border-b border-surface-border transition-colors duration-200 hover:bg-surface-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
            >
              <td className="px-4 py-2">
                <span className="flex items-center gap-3">
                  <span aria-hidden="true" className="text-lg leading-none">
                    {task.icon}
                  </span>
                  <span className="min-w-0 truncate text-surface-text">{task.name}</span>
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-2">
                <StatusBadge status={task.status} />
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-right text-xs text-surface-text-subtle">
                {formatRelativeTime(task.createdAt, now)}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-right text-xs text-surface-text-subtle">
                {formatRelativeTime(task.updatedAt ?? task.createdAt, now)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default TableView
