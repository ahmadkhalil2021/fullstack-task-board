// TaskForm.jsx — Modal for editing a single task
// Opens when a task is clicked. Edits all fields. Has Save, Cancel, and Delete.
// The description textarea auto-grows to fit the content.
// Delete uses a two-step inline confirm pattern instead of window.confirm so
// it stays testable and doesn't break in iframes.

import { useState, useEffect, useRef } from 'react'
import { useBoardStore } from '../store/useBoardStore.js'

const ICONS = ['⏰', '🚀', '🎯', '⭐', '🏁', '✅', '❌', '🔥', '💡', '📌']

// Auto-growing textarea: resizes its height to fit the content.
// On every change, the scrollHeight is set as the new height so the
// user always sees the full content without scrolling.
const GrowingTextarea = ({ value, onChange, placeholder, minRows = 4 }) => {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Reset to auto so the scrollHeight can be measured
    el.style.height = 'auto'
    // Set the height to the scrollHeight (content height)
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      rows={minRows}
      placeholder={placeholder}
      className="mt-1 w-full px-3 py-2 border border-surface-border-strong rounded bg-surface-raised text-surface-text focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle resize-none overflow-hidden transition-colors duration-200"
    />
  )
}

const TaskForm = ({ task, onClose }) => {
  const board = useBoardStore(s => s.board)
  const updateTask = useBoardStore(s => s.updateTask)
  const deleteTask = useBoardStore(s => s.deleteTask)

  const [name, setName] = useState(task.name)
  const [description, setDescription] = useState(task.description)
  const [icon, setIcon] = useState(task.icon)
  const [status, setStatus] = useState(task.status)
  const [isSaving, setIsSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const nameRef = useRef(null)

  useEffect(() => {
    nameRef.current?.focus()
    nameRef.current?.select()
  }, [])

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        if (confirmingDelete) {
          setConfirmingDelete(false)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose, confirmingDelete])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateTask(task._id, { name, description, icon, status })
      onClose()
    } catch {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteTask(task._id)
      onClose()
    } catch {
      // error already in store
    }
  }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  const statuses = board?.statuses ?? []
  const hasChanges =
    name !== task.name ||
    description !== task.description ||
    icon !== task.icon ||
    status !== task.status

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
    >
      <div className="bg-surface-overlay rounded-card shadow-card-hover w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-surface-text mb-4">Edit task</h2>

        {/* Name */}
        <label className="block mb-3">
          <span className="text-sm font-medium text-surface-text-muted">Name</span>
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-surface-border-strong rounded bg-surface-raised text-surface-text focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle transition-colors duration-200"
          />
        </label>

        {/* Description — auto-growing textarea so the full text is visible */}
        <label className="block mb-3">
          <span className="text-sm font-medium text-surface-text-muted">Description</span>
          <GrowingTextarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a description..."
            minRows={4}
          />
        </label>

        {/* Icon picker */}
        <div className="mb-3">
          <span className="text-sm font-medium text-surface-text-muted">Icon</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {ICONS.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIcon(i)}
                className={`text-2xl p-1 rounded hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle transition-colors duration-200 ${i === icon ? 'bg-primary-muted ring-2 ring-primary' : ''}`}
              >
                {i}
              </button>
            ))}
          </div>
        </div>

        {/* Status */}
        <label className="block mb-4">
          <span className="text-sm font-medium text-surface-text-muted">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-surface-border-strong rounded bg-surface-raised text-surface-text focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle transition-colors duration-200"
          >
            {statuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        {/* Actions */}
        <div className="flex justify-between items-center pt-2 border-t border-surface-border">
          {confirmingDelete ? (
            <div className="flex items-center gap-2" data-testid="delete-confirm">
              <span className="text-sm text-surface-text-muted">
                Delete "{name}"?
              </span>
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
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-surface-text-muted hover:bg-surface-muted rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle transition-colors duration-200"
            >
              Cancel
            </button>
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

export default TaskForm