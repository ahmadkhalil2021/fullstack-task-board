// TaskCard.jsx — Sortable + draggable card for a single task
// Click to open the edit modal. Drag to move or reorder.
// Each card carries a left status-color stripe so the user can read its
// status at a glance even when columns aren't visible (e.g. grid view).

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { statusColor } from '../lib/statusColor.js'

const TaskCard = ({ task, onClick }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task._id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const handleClick = (e) => {
    if (!isDragging) onClick(task)
  }

  // Only Enter opens the card — Space must stay free for dnd-kit's KeyboardSensor pickup/drop
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (!isDragging) onClick?.(task)
    }
  }

  const stripe = statusColor(task.status)

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`Edit task: ${task.name}`}
      data-task-id={task._id}
      data-status-color={stripe}
      className={`group bg-surface-raised rounded-card pl-3 pr-3 py-3 shadow-card border border-surface-border hover:shadow-card-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle animate-fade-in transition-all duration-200 cursor-grab active:cursor-grabbing touch-none min-h-24 flex flex-col relative overflow-hidden ${
        isDragging ? 'opacity-30' : ''
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-1 bg-status-${stripe}`}
      />
      <div className="flex items-start gap-2 flex-1 min-h-0">
        <span className="text-2xl shrink-0" aria-hidden="true">{task.icon}</span>
        <div className="flex-1 min-w-0 flex flex-col">
          <h3 className="font-medium text-surface-text truncate">
            {task.name}
          </h3>
          {task.description && (
            <p className="mt-1 text-sm text-surface-text-muted line-clamp-3">
              {task.description}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default TaskCard