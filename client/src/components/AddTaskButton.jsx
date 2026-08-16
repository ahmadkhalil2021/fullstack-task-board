// AddTaskButton.jsx — "+ Add new task" button rendered at the bottom of a column.

const AddTaskButton = ({ onClick, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="mt-3 w-full rounded-xl border border-dashed border-white/50 bg-white/35 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-white/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
  >
    + Add new task
  </button>
)

export default AddTaskButton
