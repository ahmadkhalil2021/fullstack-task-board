// TaskForm.jsx — Modal for editing a single task
// Opens when a task is clicked. Edits all fields. Has Save, Cancel, and Delete.
// The description textarea auto-grows to fit the content.

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
      className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-hidden"
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
  const nameRef = useRef(null)
  const previousFocus = useRef(document.activeElement)

  useEffect(() => {
    nameRef.current?.focus()
    nameRef.current?.select()
  }, [])

  useEffect(() => {
    const focusTarget = previousFocus.current
    return () => focusTarget?.focus?.()
  }, [])

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

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
    if (window.confirm(`Delete "${task.name}"?`)) {
      try {
        await deleteTask(task._id)
        onClose()
      } catch {
        // error already in store
      }
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
      className="fixed inset-0 z-50 bg-black/30 backdrop-blur-md flex items-center justify-center p-4"
      role="presentation"
    >
      <div
        className="glass-surface bg-white/85 dark:bg-gray-800/85 backdrop-blur-lg border border-white/40 dark:border-white/10 rounded-2xl shadow-glass dark:shadow-glass-dark w-full max-w-2xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-form-title"
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 id="task-form-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit task</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close task editor"
            className="min-h-11 min-w-11 -mr-2 -mt-2 rounded text-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            ×
          </button>
        </div>

        {/* Name */}
        <label className="block mb-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Name</span>
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        {/* Description — auto-growing textarea so the full text is visible */}
        <label className="block mb-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</span>
          <GrowingTextarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a description..."
            minRows={4}
          />
        </label>

        {/* Icon picker */}
        <div className="mb-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Icon</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {ICONS.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIcon(i)}
                aria-label={`Use ${i} icon`}
                aria-pressed={i === icon}
                className={`min-h-11 min-w-11 text-2xl p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${i === icon ? 'bg-blue-100 dark:bg-blue-900 ring-2 ring-blue-500' : ''}`}
              >
                {i}
              </button>
            ))}
          </div>
        </div>

        {/* Status */}
        <label className="block mb-4">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {statuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        {/* Actions */}
        <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={handleDelete}
            className="text-red-500 hover:text-red-700 dark:hover:text-red-300 text-sm"
          >
            Delete
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasChanges || isSaving || !name.trim()}
              className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
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
