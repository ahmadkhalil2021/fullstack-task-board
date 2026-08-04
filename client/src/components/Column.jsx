// Column.jsx — One column in the board
// Renders a header with the status name and a list of tasks for that status.
// Issue #6: visual only. Add/delete comes in later issues.

import TaskCard from './TaskCard.jsx'

const Column = ({ status, tasks }) => {
  return (
    <div className="flex flex-col bg-gray-100 dark:bg-gray-900 rounded-lg p-3 min-w-[280px] flex-1">
      <div className="flex items-center justify-between px-2 py-1 mb-2">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-700 dark:text-gray-300">
          {status}
        </h2>
        <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 rounded-full px-2 py-0.5">
          {tasks.length}
        </span>
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto">
        {tasks.map((task) => (
          <TaskCard key={task._id} task={task} />
        ))}
      </div>
    </div>
  )
}

export default Column
