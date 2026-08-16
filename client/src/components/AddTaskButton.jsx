// AddTaskButton.jsx — "+ Add new task" button rendered at the bottom of a column.

const AddTaskButton = ({ onClick, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="mt-3 w-full rounded-lg border-2 border-dashed border-surface-border-strong px-4 py-2 text-sm font-medium text-surface-text-muted hover:bg-surface-raised hover:border-surface-border focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle disabled:cursor-not-allowed disabled:opacity-50 transition-colors duration-200"
  >
    + Add new task
  </button>
)

export default AddTaskButton