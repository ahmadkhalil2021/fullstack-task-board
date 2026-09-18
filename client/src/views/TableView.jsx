// TableView.jsx — Dense, sortable task table.
// Sort state lives in sessionStorage per board; rows are keyboard reachable
// and open the task detail page. Filtering comes from the store (#25).

import { useEffect, useMemo, useRef, useState } from 'react'
import { useBoardStore, filterTasks } from '../store/useBoardStore.js'
import StatusBadge from '../components/StatusBadge.jsx'
import AddTaskButton from '../components/AddTaskButton.jsx'
import { formatRelativeTime } from '../lib/formatRelativeTime.js'
import { formatDueDate, isOverdue } from '../lib/dueDate.js'
import { PRIORITY_RANK, priorityColor, priorityLabel } from '../lib/priority.js'

const COLUMNS = [
  { key: 'name', label: 'Name', align: 'left' },
  { key: 'status', label: 'Status', align: 'left' },
  { key: 'priority', label: 'Priority', align: 'left' },
  { key: 'dueDate', label: 'Due date', align: 'right' },
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
  if (key === 'priority') {
    return PRIORITY_RANK[task.priority] ?? 0
  }
  if (key === 'dueDate') {
    // null marks "no due date" and always sorts last (both directions).
    if (!task.dueDate) return null
    const timestamp = new Date(task.dueDate).getTime()
    return Number.isNaN(timestamp) ? null : timestamp
  }
  return (task[key] ?? '').toString().toLowerCase()
}

const TableView = ({ onTaskClick }) => {
  const board = useBoardStore(s => s.board)
  const query = useBoardStore(s => s.query)
  const filterStatus = useBoardStore(s => s.filterStatus)
  const addTask = useBoardStore(s => s.addTask)

  const [sort, setSort] = useState(() => readStoredSort(board?._id))
  const [isAdding, setIsAdding] = useState(false)
  const [now, setNow] = useState(Date.now())
  const addingRef = useRef(false)

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
      // Null values (no due date) always sort last, independent of direction.
      if (aValue === null && bValue === null) return a._id.localeCompare(b._id)
      if (aValue === null) return 1
      if (bValue === null) return -1
      if (aValue < bValue) return sort.dir === 'asc' ? -1 : 1
      if (aValue > bValue) return sort.dir === 'asc' ? 1 : -1
      // Stable, direction-independent tie-break for equal/invalid values.
      return a._id.localeCompare(b._id)
    })
  }, [board?.tasks, query, filterStatus, sort])

  if (!board) return null

  const isFiltering = query !== '' || filterStatus !== null
  const isEmptyBoard = board.tasks.length === 0 && !isFiltering

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

  const handleAddTask = async () => {
    if (!board.statuses.length) return
    if (addingRef.current) return
    addingRef.current = true
    setIsAdding(true)
    try {
      const realTask = await addTask(board.statuses[0])
      onTaskClick(realTask)
    } catch {
      // The store already rolled back and set `error`; the existing error UI displays it.
    } finally {
      addingRef.current = false
      setIsAdding(false)
    }
  }

  if (isEmptyBoard) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-surface-border-strong bg-surface-raised px-6 py-16 text-center">
        <p className="text-sm text-surface-text-muted">No tasks yet</p>
        <button
          type="button"
          onClick={handleAddTask}
          disabled={isAdding}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle transition-colors duration-200"
        >
          Add your first task
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="w-full sm:w-64">
        <AddTaskButton onClick={handleAddTask} disabled={isAdding} />
      </div>

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
                <td className="whitespace-nowrap px-4 py-2">
                  {priorityColor(task.priority) ? (
                    <span className="inline-flex items-center gap-2 text-surface-text-muted">
                      <span
                        aria-hidden="true"
                        className={`inline-block h-2 w-2 shrink-0 rounded-full bg-priority-${priorityColor(task.priority)}`}
                      />
                      {priorityLabel(task.priority)}
                    </span>
                  ) : (
                    <span className="text-surface-text-subtle">—</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right text-xs">
                  {formatDueDate(task.dueDate) ? (
                    <span
                      className={
                        isOverdue(task.dueDate)
                          ? 'font-medium text-danger'
                          : 'text-surface-text-muted'
                      }
                    >
                      {formatDueDate(task.dueDate)}
                      {isOverdue(task.dueDate) && <span className="sr-only"> (overdue)</span>}
                    </span>
                  ) : (
                    <span className="text-surface-text-subtle">—</span>
                  )}
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
    </div>
  )
}

export default TableView
