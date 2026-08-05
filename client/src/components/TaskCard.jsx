// TaskCard.jsx — Read-only display of a single task
// Clicking opens the TaskForm modal for editing (handled by the parent).

const TaskCard = ({ task, onClick }) => {
  return (
    <div
      onClick={() => onClick(task)}
      className="bg-white dark:bg-gray-800 rounded-md p-3 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500 transition-all cursor-pointer"
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
