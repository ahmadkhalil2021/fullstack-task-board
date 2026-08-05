// Column.jsx — One column in the board
// Acts as a drop target for drag-and-drop. Tasks can be dragged onto it to change their status.

import { useDroppable } from '@dnd-kit/core'
import TaskCard from './TaskCard.jsx'

const Column = ({ status, tasks, onTaskClick }) => {
  // Make this column a drop target. `isOver` is true when a draggable is over it.
  const { isOver, setNodeRef } = useDroppable({ id: status })

  return (
    <div
      ref={setNodeRef}
      data-status={status}
      className={`flex flex-col rounded-lg p-3 min-w-[280px] flex-1 transition-colors ${
        isOver
          ? 'bg-blue-100 dark:bg-blue-900/30 ring-2 ring-blue-400'
          : 'bg-gray-100 dark:bg-gray-900'
      }`}
    >
      <div className="flex items-center justify-between px-2 py-1 mb-2">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-700 dark:text-gray-300">
          {status}
        </h2>
        <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 rounded-full px-2 py-0.5">
          {tasks.length}
        </span>
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto min-h-[100px]">
        {tasks.map((task) => (
          <TaskCard key={task._id} task={task} onClick={onTaskClick} />
        ))}
      </div>
    </div>
  )
}

export default Column
