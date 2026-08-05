// TaskCard.jsx — Sortable + draggable card for a single task
// Click to open the edit modal. Drag to move or reorder.
// Uses useSortable from @dnd-kit/sortable for in-list reordering.

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

  // Click handler: only fires if we're not in the middle of a drag
  const handleClick = (e) => {
    if (!isDragging) onClick(task)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      data-task-id={task._id}
      className={`bg-white dark:bg-gray-800 rounded-md p-3 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500 transition-shadow cursor-grab active:cursor-grabbing touch-none ${
        isDragging ? 'opacity-30' : ''
      }`}
    >
      <div className="flex items-start gap-2">
        <span className="text-2xl" aria-hidden="true">{task.icon}</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
            {task.name}
          </h3>
          {task.description && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
              {task.description}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default TaskCard
