// ListView.jsx — Flat Odoo-style task table (no status grouping).
// Columns: Task | Status | Updated. Rows sort by board status order, then by
// the Kanban order. Row clicks open the task detail page; filtering comes
// from the store (#25).

import { useEffect, useMemo, useRef, useState } from 'react'
import { useBoardStore, filterTasks } from '../store/useBoardStore.js'
import { formatRelativeTime } from '../lib/formatRelativeTime.js'
import StatusBadge from '../components/StatusBadge.jsx'

const ListView = ({ onTaskClick }) => {
  const board = useBoardStore(s => s.board)
  const query = useBoardStore(s => s.query)
  const filterStatus = useBoardStore(s => s.filterStatus)
  const addTask = useBoardStore(s => s.addTask)

  const [isAdding, setIsAdding] = useState(false)
  const [now, setNow] = useState(Date.now())
  const addingRef = useRef(false)

  // Re-render once per minute so relative timestamps stay fresh.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(id)
  }, [])

  const visibleTasks = useMemo(
    () => filterTasks(board?.tasks, query, filterStatus),
    [board?.tasks, query, filterStatus]
  )

  if (!board) return null

  const statusOrder = new Map(board.statuses.map((status, index) => [status, index]))
  const rows = [...visibleTasks].sort((a, b) => {
    const aIndex = statusOrder.get(a.status) ?? board.statuses.length
    const bIndex = statusOrder.get(b.status) ?? board.statuses.length
    if (aIndex !== bIndex) return aIndex - bIndex
    return (a.order ?? 0) - (b.order ?? 0)
  })
  const isFiltering = query !== '' || filterStatus !== null

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

  return (
    <div className="overflow-hidden rounded-card border border-surface-border bg-surface-raised">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-surface-border text-left text-xs uppercase tracking-wide text-surface-text-subtle">
            <th scope="col" className="px-4 py-2 font-medium">
              Task
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Status
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium">
              Updated
            </th>
            <th scope="col" className="w-8 px-2 py-2">
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 && !isFiltering && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-sm text-surface-text-subtle">
                No tasks yet
              </td>
            </tr>
          )}

          {rows.map((task) => (
            <tr
              key={task._id}
              onClick={(event) => {
                // The inner button already handles activation; avoid a double call.
                if (event.target.closest('button')) return
                onTaskClick(task)
              }}
              className="cursor-pointer border-b border-surface-border transition-colors duration-200 hover:bg-surface-muted/50"
            >
              <td className="px-4 py-2">
                <button
                  type="button"
                  onClick={() => onTaskClick(task)}
                  className="flex w-full items-center gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                >
                  <span aria-hidden="true" className="text-lg leading-none">
                    {task.icon}
                  </span>
                  <span className="min-w-0 truncate text-surface-text">{task.name}</span>
                </button>
              </td>
              <td className="whitespace-nowrap px-4 py-2">
                <StatusBadge status={task.status} />
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-right text-xs text-surface-text-subtle">
                Updated {formatRelativeTime(task.updatedAt ?? task.createdAt, now)}
              </td>
              <td aria-hidden="true" className="px-2 py-2 text-right text-surface-text-subtle">
                ›
              </td>
            </tr>
          ))}

          <tr>
            <td colSpan={4} className="p-0">
              <button
                type="button"
                onClick={handleAddTask}
                disabled={isAdding}
                className="w-full px-4 py-2 text-left text-sm text-primary transition-colors duration-200 hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
              >
                + Add a line
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export default ListView
