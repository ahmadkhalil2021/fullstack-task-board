// TaskDetailPage.jsx — Dedicated, fully editable page for a single task.
// Replaces the former TaskForm modal: /board/:boardId/task/:taskId.
// Reads the task from the store (Flux), persists through store actions.

import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useBoardStore } from '../store/useBoardStore.js'
import { formatRelativeTime } from '../lib/formatRelativeTime.js'
import { statusColor } from '../lib/statusColor.js'
import ErrorBanner from '../components/ErrorBanner.jsx'

const ICONS = ['⏰', '🚀', '🎯', '⭐', '🏁', '✅', '❌', '🔥', '💡', '📌']

// Auto-growing textarea: resizes its height to fit the content.
const GrowingTextarea = ({ id, value, onChange, placeholder, minRows = 4 }) => {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Reset to auto so the scrollHeight can be measured
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  return (
    <textarea
      ref={ref}
      id={id}
      value={value}
      onChange={onChange}
      rows={minRows}
      placeholder={placeholder}
      className="mt-1 w-full px-3 py-2 border border-surface-border-strong rounded bg-surface-raised text-surface-text focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle resize-none overflow-hidden transition-colors duration-200"
    />
  )
}

const TaskDetailForm = ({ task, backTo }) => {
  const board = useBoardStore(s => s.board)
  const updateTask = useBoardStore(s => s.updateTask)
  const deleteTask = useBoardStore(s => s.deleteTask)
  const navigate = useNavigate()

  const [name, setName] = useState(task.name)
  const [description, setDescription] = useState(task.description ?? '')
  const [icon, setIcon] = useState(task.icon)
  const [status, setStatus] = useState(task.status)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [now, setNow] = useState(Date.now())

  // Re-render once per minute so the meta timestamps stay fresh.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(id)
  }, [])

  const statuses = board?.statuses ?? []
  const hasChanges =
    name !== task.name ||
    description !== (task.description ?? '') ||
    icon !== task.icon ||
    status !== task.status

  const handleSave = async () => {
    setIsSaving(true)
    setSaved(false)
    try {
      await updateTask(task._id, { name: name.trim(), description, icon, status })
      setSaved(true)
    } catch {
      // Store rolled back and set the error banner.
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteTask(task._id)
      navigate(backTo)
    } catch {
      // Store rolled back and set the error banner.
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 sm:p-6">
      <Link
        to={backTo}
        className="inline-flex w-fit items-center gap-1 rounded text-sm text-surface-text-muted hover:text-surface-text focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle transition-colors duration-200"
      >
        ← Back to board
      </Link>

      <div className="rounded-card border border-surface-border bg-surface-raised p-6 shadow-card">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h1 className="text-lg font-semibold text-surface-text">Edit task</h1>
          <span className="inline-flex items-center gap-2 rounded-full border border-surface-border bg-surface-muted px-3 py-1 text-xs text-surface-text-muted">
            <span
              aria-hidden="true"
              className={`inline-block h-2 w-2 shrink-0 rounded-full bg-status-${statusColor(status)}`}
            />
            {status}
          </span>
        </div>

        <label htmlFor="task-name" className="block mb-3">
          <span className="text-sm font-medium text-surface-text-muted">Name</span>
          <input
            id="task-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setSaved(false)
            }}
            className="mt-1 w-full px-3 py-2 border border-surface-border-strong rounded bg-surface-raised text-surface-text focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle transition-colors duration-200"
          />
        </label>

        <label htmlFor="task-description" className="block mb-3">
          <span className="text-sm font-medium text-surface-text-muted">Description</span>
          <GrowingTextarea
            id="task-description"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value)
              setSaved(false)
            }}
            placeholder="Add a description..."
            minRows={4}
          />
        </label>

        <div className="mb-3">
          <span className="text-sm font-medium text-surface-text-muted">Icon</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {ICONS.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setIcon(i)
                  setSaved(false)
                }}
                aria-pressed={i === icon}
                aria-label={`Use icon ${i}`}
                className={`text-2xl p-1 rounded hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle transition-colors duration-200 ${i === icon ? 'bg-primary-muted ring-2 ring-primary' : ''}`}
              >
                {i}
              </button>
            ))}
          </div>
        </div>

        <label htmlFor="task-status" className="block mb-4">
          <span className="text-sm font-medium text-surface-text-muted">Status</span>
          <select
            id="task-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setSaved(false)
            }}
            className="mt-1 w-full px-3 py-2 border border-surface-border-strong rounded bg-surface-raised text-surface-text focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle transition-colors duration-200"
          >
            {statuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        <p className="mb-4 text-xs text-surface-text-subtle">
          Created {formatRelativeTime(task.createdAt, now)} · Updated{' '}
          {formatRelativeTime(task.updatedAt ?? task.createdAt, now)}
        </p>

        <div className="flex justify-between items-center pt-2 border-t border-surface-border">
          {confirmingDelete ? (
            <div className="flex items-center gap-2" data-testid="delete-confirm">
              <span className="text-sm text-surface-text-muted">Delete "{task.name}"?</span>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="px-3 py-1 text-sm text-surface-text-muted hover:bg-surface-muted rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                data-testid="confirm-delete"
                className="px-3 py-1 text-sm bg-danger text-white rounded hover:bg-danger-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle transition-colors duration-200"
              >
                Delete
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              data-testid="request-delete"
              className="text-danger hover:text-danger-hover text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle rounded px-2 py-1 transition-colors duration-200"
            >
              Delete
            </button>
          )}
          <div className="flex items-center gap-3">
            {saved && (
              <span role="status" className="text-sm text-surface-text-muted">
                Saved
              </span>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasChanges || isSaving || !name.trim()}
              className="px-4 py-2 text-sm bg-primary text-white rounded hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle transition-colors duration-200"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const TaskDetailPage = () => {
  const { boardId, taskId } = useParams()
  const board = useBoardStore(s => s.board)
  const fetchBoard = useBoardStore(s => s.fetchBoard)
  const location = useLocation()

  // Preserve the exact board view (kanban/list + filters) the user came from.
  const backTo = location.state?.from ?? `/board/${boardId}`

  useEffect(() => {
    if (board?._id !== boardId) {
      fetchBoard(boardId)
    }
  }, [boardId, board?._id, fetchBoard])

  if (!board) {
    return (
      <div className="min-h-screen bg-surface-subtle flex flex-col">
        <ErrorBanner />
        <div className="mx-auto w-full max-w-2xl p-4 sm:p-6">
          <Link
            to={backTo}
            className="inline-flex w-fit items-center gap-1 rounded text-sm text-surface-text-muted hover:text-surface-text focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle transition-colors duration-200"
          >
            ← Back to board
          </Link>
          <p role="status" className="mt-4 text-sm text-surface-text-muted">
            Loading task...
          </p>
        </div>
      </div>
    )
  }

  const task = board.tasks.find((t) => t._id === taskId)

  if (!task) {
    return (
      <div className="min-h-screen bg-surface-subtle flex flex-col">
        <ErrorBanner />
        <div className="mx-auto w-full max-w-2xl p-4 sm:p-6">
          <Link
            to={backTo}
            className="inline-flex w-fit items-center gap-1 rounded text-sm text-surface-text-muted hover:text-surface-text focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle transition-colors duration-200"
          >
            ← Back to board
          </Link>
          <div
            role="status"
            className="mt-4 rounded-card border border-surface-border bg-surface-raised px-4 py-3 text-sm text-surface-text-muted"
          >
            Task not found — it may have been deleted.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-subtle flex flex-col">
      <ErrorBanner />
      <TaskDetailForm key={task._id} task={task} backTo={backTo} />
    </div>
  )
}

export default TaskDetailPage
