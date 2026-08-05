// TaskForm.jsx — Modal for editing a single task
// Opens when a task is clicked. Edits all fields. Has Save, Cancel, and Delete.

import { useState, useEffect, useRef } from 'react'
import { useBoardStore } from '../store/useBoardStore.js'

const ICONS = ['⏰', '🚀', '🎯', '⭐', '🏁', '✅', '❌', '🔥', '💡', '📌']

const TaskForm = ({ task, onClose }) => {
  const board = useBoardStore(s => s.board)
  const updateTask = useBoardStore(s => s.updateTask)
  const deleteTask = useBoardStore(s => s.deleteTask)

  // Local drafts so the user can edit without immediately saving
  const [name, setName] = useState(task.name)
  const [description, setDescription] = useState(task.description)
  const [icon, setIcon] = useState(task.icon)
  const [status, setStatus] = useState(task.status)
  const [isSaving, setIsSaving] = useState(false)
  const nameRef = useRef(null)

  // Focus the name input when the form opens
  useEffect(() => {
    nameRef.current?.focus()
    nameRef.current?.select()
  }, [])

  // Close on Escape
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
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Edit task</h2>

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

        {/* Description */}
        <label className="block mb-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className={`text-2xl p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${i === icon ? 'bg-blue-100 dark:bg-blue-900 ring-2 ring-blue-500' : ''}`}
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
