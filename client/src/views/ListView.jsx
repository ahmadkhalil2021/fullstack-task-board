// ListView.jsx — Read-oriented list grouped by status.
// Sections follow board.statuses order, collapse locally, and share the
// store filter (#25) and TaskForm with the Kanban view.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useBoardStore, filterTasks } from '../store/useBoardStore.js'
import { formatRelativeTime } from '../lib/formatRelativeTime.js'
import { statusColor } from '../lib/statusColor.js'
import AddTaskButton from '../components/AddTaskButton.jsx'

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
    <div className="flex flex-col gap-4">
      {board.statuses.map((status, index) => {
        const tasks = visibleTasks
          .filter((t) => t.status === status)
          .sort((a, b) => a.order - b.order)
        const hasTasks = tasks.length > 0
        const isCollapsed = collapsed.has(status)
        const sectionId = `list-section-${index}`

        return (
          <section
            key={status}
            className="rounded-card border border-surface-border bg-surface-raised"
          >
            {hasTasks && (
              <h2 className="text-sm font-semibold uppercase tracking-wide text-surface-text-muted">
                <button
                  type="button"
                  onClick={() => toggle(status)}
                  aria-expanded={!isCollapsed}
                  aria-controls={sectionId}
                  className="flex w-full items-center gap-2 rounded-t-card px-4 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle transition-colors duration-200 hover:bg-surface-muted"
                >
                  <span
                    aria-hidden="true"
                    className={`inline-block h-2 w-2 shrink-0 rounded-full bg-status-${statusColor(status)}`}
                  />
                  <span className="flex-1">{status}</span>
                  <span className="rounded-full border border-surface-border bg-surface-muted px-2 py-0.5 text-xs text-surface-text-subtle">
                    {tasks.length}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`text-surface-text-subtle transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}
                  >
                    ›
                  </span>
                </button>
              </h2>
            )}

            {hasTasks && (
              <ul id={sectionId} hidden={isCollapsed} className="border-t border-surface-border">
                {tasks.map((task) => (
                  <li key={task._id} className="border-b border-surface-border last:border-b-0">
                    <button
                      type="button"
                      onClick={() => onTaskClick(task)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset transition-colors duration-200"
                    >
                      <span aria-hidden="true" className="text-lg leading-none">
                        {task.icon}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-surface-text">{task.name}</span>
                      <span className="shrink-0 text-xs text-surface-text-subtle">
                        Updated {formatRelativeTime(task.updatedAt ?? task.createdAt, now)}
                      </span>
                      <span aria-hidden="true" className="text-surface-text-subtle">
                        ›
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="px-3 pb-3 pt-3">
              <AddTaskButton
                onClick={() => handleAddTask(status)}
                disabled={addingStatus === status}
              />
            </div>
          </section>
        )
      })}
    </div>
  )
}

export default ListView
