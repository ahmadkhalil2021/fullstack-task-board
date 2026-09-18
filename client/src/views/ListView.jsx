// ListView.jsx — Odoo-style grouped table of tasks.
// One collapsible group per status (board.statuses order) with an add-a-line
// row; row clicks open the task detail page. Filtering comes from the store (#25).

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useBoardStore, filterTasks } from '../store/useBoardStore.js'
import { formatRelativeTime } from '../lib/formatRelativeTime.js'
import { statusColor } from '../lib/statusColor.js'

const ListView = ({ onTaskClick }) => {
  const board = useBoardStore(s => s.board)
  const query = useBoardStore(s => s.query)
  const filterStatus = useBoardStore(s => s.filterStatus)
  const addTask = useBoardStore(s => s.addTask)

  const [collapsed, setCollapsed] = useState(() => new Set())
  const [addingStatus, setAddingStatus] = useState(null)
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

  const toggle = (status) => {
    setCollapsed((previous) => {
      const next = new Set(previous)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }

  const handleAddTask = async (status) => {
    if (addingRef.current) return
    addingRef.current = true
    setAddingStatus(status)
    try {
      const realTask = await addTask(status)
      onTaskClick(realTask)
    } catch {
      // The store already rolled back and set `error`; the existing error UI displays it.
    } finally {
      addingRef.current = false
      setAddingStatus(null)
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

        {board.statuses.map((status, index) => {
          const tasks = visibleTasks
            .filter((t) => t.status === status)
            .sort((a, b) => a.order - b.order)
          const isCollapsed = collapsed.has(status)
          const sectionId = `list-section-${index}`

          return (
            <Fragment key={status}>
              <tbody>
                <tr className="border-b border-surface-border bg-surface-muted/60">
                  <th scope="colgroup" colSpan={4} className="p-0 text-left">
                    <button
                      type="button"
                      onClick={() => toggle(status)}
                      aria-expanded={!isCollapsed}
                      aria-controls={sectionId}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left transition-colors duration-200 hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                    >
                      <span
                        aria-hidden="true"
                        className={`text-xs text-surface-text-subtle transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}
                      >
                        ›
                      </span>
                      <span className="font-semibold text-surface-text">{status}</span>
                      <span className="rounded-full border border-surface-border bg-surface-raised px-2 py-0.5 text-xs text-surface-text-subtle">
                        {tasks.length}
                      </span>
                    </button>
                  </th>
                </tr>
              </tbody>

              <tbody id={sectionId} hidden={isCollapsed}>
                {tasks.map((task) => (
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
                      <span className="inline-flex items-center gap-2 text-surface-text-muted">
                        <span
                          aria-hidden="true"
                          className={`inline-block h-2 w-2 shrink-0 rounded-full bg-status-${statusColor(task.status)}`}
                        />
                        {task.status}
                      </span>
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
                      onClick={() => handleAddTask(status)}
                      disabled={addingStatus === status}
                      className="w-full px-4 py-2 text-left text-sm text-primary transition-colors duration-200 hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                    >
                      + Add a line
                    </button>
                  </td>
                </tr>
              </tbody>
            </Fragment>
          )
        })}
      </table>
    </div>
  )
}

export default ListView
