// TaskCard.jsx — Sortable + draggable card for a single task
// Click to open the edit modal. Drag to move or reorder.
// The dashboard shows a compact view (truncated description, fixed height).
// The full description is shown in the TaskForm modal.

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (!isDragging) onClick?.(task)
    }
  }

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
      className={`bg-white dark:bg-gray-800 rounded-md p-3 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 animate-fade-in transition-all duration-150 cursor-grab active:cursor-grabbing touch-none h-32 flex flex-col ${
        isDragging ? 'opacity-30' : ''
      }`}
    >
      <div className="flex items-start gap-2 flex-1 min-h-0">
        <span className="text-2xl shrink-0" aria-hidden="true">{task.icon}</span>
        <div className="flex-1 min-w-0 flex flex-col">
          <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
            {task.name}
          </h3>
          {task.description && (
            // line-clamp-3 keeps the card at a fixed height regardless of description length
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
              {task.description}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default TaskCard
