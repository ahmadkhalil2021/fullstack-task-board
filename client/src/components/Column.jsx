// Column.jsx — One column in the board
// Acts as a drop target for drag-and-drop. Tasks can be dragged onto it to change their status.
// The top border color mirrors the status token so columns read as a system.

import { useDroppable } from '@dnd-kit/core'
import TaskCard from './TaskCard.jsx'
import AddTaskButton from './AddTaskButton.jsx'
import { statusColor } from '../lib/statusColor.js'

const Column = ({ status, tasks, onTaskClick, onAddTask, isAddingTask }) => {
  // Make this column a drop target. `isOver` is true when a draggable is over it.
  const { isOver, setNodeRef } = useDroppable({ id: status })

  const stripe = statusColor(status)

  return (
    <div
      ref={setNodeRef}
      data-status={status}
      className={`flex flex-col rounded-card pt-1 pb-3 px-3 min-w-[280px] flex-1 transition-colors duration-200 bg-surface-muted border-t-4 border-t-status-${stripe} ${
        isOver ? 'ring-2 ring-primary ring-inset bg-primary/10' : ''
      }`}
    >
      <div className="flex flex-col gap-2 overflow-y-auto scrollbar-hide flex-1 min-h-[100px]">
        {/* Header lives inside the scroll container so sticky has a scrolling ancestor to engage against.
            bg-surface-muted/95 + backdrop-blur keeps the header opaque-ish as cards scroll under it. */}
        <div className="flex items-center justify-between px-2 py-2 mb-1 sticky top-0 bg-surface-muted/95 backdrop-blur z-10">
          <div className="flex items-center gap-2 min-w-0">
            <span
              aria-hidden="true"
              className={`inline-block w-2 h-2 rounded-full bg-status-${stripe} shrink-0`}
            />
            <h2 className="font-semibold text-sm uppercase tracking-wide text-surface-text-muted truncate">
              {status}
            </h2>
          </div>
          <span className="text-xs text-surface-text-subtle bg-surface-raised rounded-full px-2 py-0.5 min-w-[24px] text-center border border-surface-border">
            {tasks.length}
          </span>
        </div>
        {tasks.map((task) => (
          <TaskCard key={task._id} task={task} onClick={onTaskClick} />
        ))}
      </div>
      {onAddTask && (
        <AddTaskButton onClick={onAddTask} disabled={isAddingTask} />
      )}
    </div>
  )
}

export default Column