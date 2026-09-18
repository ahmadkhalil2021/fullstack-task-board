// TaskDetailPage.jsx — Odoo-style form view for a single task.
// Replaces the former TaskForm modal: /board/:boardId/task/:taskId.
// Control panel (breadcrumb + Save/Discard), statusbar stages, form sheet.
// Statusbar clicks save immediately; Save covers the remaining fields.

import { Fragment, useEffect, useRef, useState } from 'react'
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
  const [isSaving, setIsSaving] = useState(false)
  const [isStatusSaving, setIsStatusSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [now, setNow] = useState(Date.now())

  // Re-render once per minute so the meta timestamps stay fresh.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(id)
  }, [])

  const statuses = board?.statuses ?? []
  // Statusbar changes save immediately, so Save only covers the other fields.
  const status = task.status
  const hasChanges =
    name !== task.name ||
    description !== (task.description ?? '') ||
    icon !== task.icon

  const handleDiscard = () => {
    setName(task.name)
    setDescription(task.description ?? '')
    setIcon(task.icon)
    setSaved(false)
  }

  const handleStatusSelect = async (stage) => {
    if (stage === task.status || isStatusSaving || isSaving) return
    setIsStatusSaving(true)
    setSaved(false)
    try {
      await updateTask(task._id, { status: stage })
    } catch {
      // Store rolled back the optimistic change and set the error banner;
      // the statusbar follows the store again.
    } finally {
      setIsStatusSaving(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaved(false)
    try {
      await updateTask(task._id, { name: name.trim(), description, icon })
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
    <div className="flex min-h-screen flex-col bg-surface-subtle">
      {/* Control panel: breadcrumb + record actions */}
      <div className="sticky top-0 z-10 border-b border-surface-border bg-surface-raised">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-2 sm:px-6">
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-sm">
            <Link
              to={backTo}
              className="rounded px-1 py-0.5 text-surface-text-muted hover:text-surface-text focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle transition-colors duration-200"
            >
              {board?.name ?? 'Board'}
            </Link>
            <span aria-hidden="true" className="text-surface-text-subtle">
              /
            </span>
            <span className="truncate text-surface-text">{task.name}</span>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            {saved && (
              <span role="status" className="text-xs text-surface-text-subtle">
                Saved
              </span>
            )}
            <button
              type="button"
              onClick={handleDiscard}
              disabled={!hasChanges || isSaving}
              aria-label="Discard"
              title="Discard"
              className="inline-flex items-center justify-center rounded p-2 text-surface-text-muted hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle transition-colors duration-200"
            >
              <svg
                viewBox="0 0 16 16"
                aria-hidden="true"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M3 6h6.5a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5.5 3 2.5 6l3 3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasChanges || isSaving || !name.trim()}
              aria-label={isSaving ? 'Saving...' : 'Save'}
              title="Save"
              className="inline-flex items-center justify-center rounded bg-primary p-2 text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle transition-colors duration-200"
            >
              <svg
                viewBox="0 0 16 16"
                aria-hidden="true"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 8.5 6.5 12 13 4.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        {/* Statusbar: board stages, current one highlighted */}
        <div role="radiogroup" aria-label="Status" className="mb-4 flex flex-wrap items-center gap-1">
          {statuses.map((stage, index) => {
            const isActive = status === stage
            return (
              <Fragment key={stage}>
                {index > 0 && (
                  <span aria-hidden="true" className="text-surface-text-subtle">
                    →
                  </span>
                )}
                <button
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => handleStatusSelect(stage)}
                  disabled={isStatusSaving || isSaving}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle disabled:cursor-not-allowed disabled:opacity-50 ${
                    isActive
                      ? 'border-primary bg-primary-muted font-semibold text-primary-muted-text'
                      : 'border-surface-border bg-surface-raised text-surface-text-muted hover:bg-surface-muted'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`inline-block h-2 w-2 shrink-0 rounded-full bg-status-${statusColor(stage)}`}
                  />
                  {stage}
                </button>
              </Fragment>
            )
          })}
        </div>

        {/* Form sheet */}
        <div className="overflow-hidden rounded-card border border-surface-border bg-surface-raised shadow-card">
          <div className="flex items-start gap-4 border-b border-surface-border p-6">
            <span aria-hidden="true" className="text-3xl leading-none">
              {icon}
            </span>
            <label className="flex-1">
              <span className="sr-only">Name</span>
              <input
                type="text"
                aria-label="Name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setSaved(false)
                }}
                placeholder="Task name"
                className="w-full border-0 bg-transparent text-2xl font-semibold text-surface-text placeholder:text-surface-text-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle rounded transition-colors duration-200"
              />
            </label>
          </div>

          <div className="grid gap-6 p-6 sm:grid-cols-2">
            <label htmlFor="task-description" className="block sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-wide text-surface-text-subtle">
                Description
              </span>
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

            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-surface-text-subtle">
                Icon
              </span>
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

            <div className="text-xs text-surface-text-subtle sm:text-right">
              <p>Created {formatRelativeTime(task.createdAt, now)}</p>
              <p>Last updated {formatRelativeTime(task.updatedAt ?? task.createdAt, now)}</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-surface-border p-4 sm:px-6">
            {confirmingDelete ? (
              <div className="flex items-center gap-2" data-testid="delete-confirm">
                <span className="text-sm text-surface-text-muted">Delete "{task.name}"?</span>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="rounded px-3 py-1 text-sm text-surface-text-muted hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  data-testid="confirm-delete"
                  className="rounded bg-danger px-3 py-1 text-sm text-white hover:bg-danger-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle transition-colors duration-200"
                >
                  Delete
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                data-testid="request-delete"
                className="rounded px-2 py-1 text-sm text-danger hover:text-danger-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle transition-colors duration-200"
              >
                Delete
              </button>
            )}
            <p className="text-xs text-surface-text-subtle">
              {status ? `Status: ${status}` : ''}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

const TaskDetailPage = () => {
  const { boardId, taskId } = useParams()
  const board = useBoardStore(s => s.board)
  const isLoading = useBoardStore(s => s.isLoading)
  const error = useBoardStore(s => s.error)
  const fetchBoard = useBoardStore(s => s.fetchBoard)
  const location = useLocation()

  // Preserve the exact board view (kanban/grid/table + filters) the user came from.
  const backTo = location.state?.from ?? `/board/${boardId}`

  useEffect(() => {
    if (board?._id !== boardId) {
      fetchBoard(boardId)
    }
  }, [boardId, board?._id, fetchBoard])

  // A board from a previous navigation must not leak into this page while the
  // target board is still loading.
  const isBoardReady = board?._id === boardId && !isLoading

  if (!isBoardReady) {
    return (
      <div className="min-h-screen bg-surface-subtle flex flex-col">
        <ErrorBanner />
        <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
          <Link
            to={backTo}
            className="inline-flex w-fit items-center gap-1 rounded text-sm text-surface-text-muted hover:text-surface-text focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle transition-colors duration-200"
          >
            ← Back to board
          </Link>
          {error && !isLoading ? (
            <div
              role="status"
              className="mt-4 rounded-card border border-surface-border bg-surface-raised px-4 py-3 text-sm text-surface-text-muted"
            >
              Board not found — the link may be invalid.
            </div>
          ) : (
            <p role="status" className="mt-4 text-sm text-surface-text-muted">
              Loading task...
            </p>
          )}
        </div>
      </div>
    )
  }

  const task = board.tasks.find((t) => t._id === taskId)

  if (!task) {
    return (
      <div className="min-h-screen bg-surface-subtle flex flex-col">
        <ErrorBanner />
        <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
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
      <TaskDetailForm key={`${board._id}-${task._id}`} task={task} backTo={backTo} />
    </div>
  )
}

export default TaskDetailPage
