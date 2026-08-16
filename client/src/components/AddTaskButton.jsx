// AddTaskButton.jsx — "+ Add new task" button rendered at the bottom of a column.

const AddTaskButton = ({ onClick, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="mt-3 w-full rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
  >
    + Add new task
  </button>
)

export default AddTaskButton
