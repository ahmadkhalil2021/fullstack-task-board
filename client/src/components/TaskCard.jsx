// TaskCard.jsx — Draggable card for a single task
// Click to open the edit modal. Drag to move to another column.
// The activationConstraint (5px) ensures click vs drag is disambiguated.

import { useDraggable } from '@dnd-kit/core'

const TaskCard = ({ task, onClick }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task._id,
  })

  // Combine DnD listeners with the click handler.
  // dnd-kit will only start a drag after the pointer moves 5px (configured in sensors),
  // so a single click still triggers onClick.
  const handleClick = (e) => {
    if (!isDragging) onClick(task)
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      data-task-id={task._id}
      className={`bg-white dark:bg-gray-800 rounded-md p-3 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500 transition-all cursor-grab active:cursor-grabbing touch-none ${
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
