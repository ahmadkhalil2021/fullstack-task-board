// GridView.jsx — Responsive card wall, newest tasks first.
// Reuses TaskCard (click/Enter opens the detail page); the filter from #25
// applies. Dragging is intentionally not wired (Kanban owns drag-and-drop).

import { useMemo, useRef, useState } from 'react'
import { useBoardStore, filterTasks } from '../store/useBoardStore.js'
import TaskCard from '../components/TaskCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import AddTaskButton from '../components/AddTaskButton.jsx'

const GridView = ({ onTaskClick }) => {
  const board = useBoardStore(s => s.board)
  const query = useBoardStore(s => s.query)
  const filterStatus = useBoardStore(s => s.filterStatus)
  const addTask = useBoardStore(s => s.addTask)

  const [isAdding, setIsAdding] = useState(false)
  const addingRef = useRef(false)

  const visibleTasks = useMemo(
    () => filterTasks(board?.tasks, query, filterStatus),
    [board?.tasks, query, filterStatus]
  )

  if (!board) return null

  const rows = [...visibleTasks].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : NaN
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : NaN
    if (Number.isNaN(aTime) && Number.isNaN(bTime)) return a._id.localeCompare(b._id)
    if (Number.isNaN(aTime)) return 1
    if (Number.isNaN(bTime)) return -1
    if (aTime !== bTime) return bTime - aTime
    return a._id.localeCompare(b._id)
  })

  const isFiltering = query !== '' || filterStatus !== null
  const isEmptyBoard = board.tasks.length === 0 && !isFiltering

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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {rows.map((task) => (
          <div key={task._id} className="relative">
            <div className="absolute right-2 top-2 z-10">
              <StatusBadge
                status={task.status}
                className="rounded-full border border-surface-border bg-surface-raised/95 px-2 py-0.5 text-xs"
              />
            </div>
            <TaskCard task={task} onClick={onTaskClick} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default GridView
