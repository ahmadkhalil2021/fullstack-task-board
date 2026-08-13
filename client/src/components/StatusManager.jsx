// StatusManager.jsx — Modal dialog for adding/renaming/removing board statuses.
// Persists via the store's updateBoard action (optimistic + rollback).

import { useState, useEffect } from 'react'
import { useBoardStore } from '../store/useBoardStore.js'

const StatusManager = ({ isOpen, onClose }) => {
  const board = useBoardStore((s) => s.board)
  const updateBoard = useBoardStore((s) => s.updateBoard)

  // Local working copy of statuses (unsaved edits)
  const [draft, setDraft] = useState([])
  const [editingIndex, setEditingIndex] = useState(null)
  const [editingValue, setEditingValue] = useState('')
  const [confirmingRemove, setConfirmingRemove] = useState(null) // index
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen && board) {
      setDraft([...board.statuses])
      setEditingIndex(null)
      setEditingValue('')
      setConfirmingRemove(null)
      setError(null)
    }
  }, [isOpen, board])

  if (!isOpen) return null

  const taskCountFor = (status) =>
    board ? board.tasks.filter((t) => t.status === status).length : 0

  const validate = (next) => {
    const trimmed = next.map((s) => s.trim())
    if (trimmed.some((s) => !s)) return 'Status names cannot be empty'
    if (new Set(trimmed).size !== trimmed.length) return 'Status names must be unique'
    return null
  }

  const save = async () => {
    const validationError = validate(draft)
    if (validationError) {
      setError(validationError)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await updateBoard({ statuses: draft.map((s) => s.trim()) })
      onClose()
    } catch (err) {
      setError(err?.message || 'Could not save statuses')
      // Rollback local draft to current board statuses on error
      setDraft([...(board?.statuses ?? [])])
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (index) => {
    setEditingIndex(index)
    setEditingValue(draft[index])
    setError(null)
  }

  const commitEdit = () => {
    if (editingIndex === null) return
    const next = [...draft]
    const proposedValue = editingValue.trim()
    const trial = [...draft]
    // Empty edits revert to the original value, so validation sees a no-op
    trial[editingIndex] = proposedValue || draft[editingIndex]
    const validationError = validate(trial)
    if (validationError && proposedValue !== draft[editingIndex]) {
      setError(validationError)
      setEditingValue(draft[editingIndex])
      return
    }
    next[editingIndex] = proposedValue || draft[editingIndex]
    setDraft(next)
    setEditingIndex(null)
    setEditingValue('')
  }

  const addStatus = () => {
    const baseName = 'New status'
    let name = baseName
    let counter = 2
    const existingNames = new Set(draft.map((s) => s.toLowerCase()))
    while (existingNames.has(name.toLowerCase())) {
      name = `${baseName} ${counter}`
      counter += 1
    }
    setDraft([...draft, name])
    setEditingIndex(draft.length)
    setEditingValue(name)
    setError(null)
  }

  const requestRemove = (index) => {
    setConfirmingRemove(index)
  }

  const confirmRemove = () => {
    if (confirmingRemove === null) return
    const next = [...draft]
    next.splice(confirmingRemove, 1)
    setDraft(next)
    setConfirmingRemove(null)
  }

  const cancelRemove = () => setConfirmingRemove(null)

  // Use the index to look up the original server-side status name
  const canRemove = (index) => {
    const originalName = board.statuses[index]
    const hasTasks = board.tasks.some((t) => t.status === originalName)
    return !hasTasks && draft.length > 1
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="status-manager-title"
      onClick={() => {
        if (confirmingRemove === null) onClose()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && confirmingRemove === null) onClose()
      }}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="status-manager-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Manage statuses
        </h2>

        <ul className="space-y-2 mb-4">
          {draft.map((status, index) => {
            const count = taskCountFor(board.statuses[index])
            const isEditing = editingIndex === index
            const removable = canRemove(index)
            return (
              <li
                key={`${status}-${index}`}
                className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-900 rounded"
              >
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      autoFocus
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          commitEdit()
                        }
                        if (e.key === 'Escape') {
                          e.stopPropagation() // prevent backdrop from closing modal
                          setEditingIndex(null)
                          setEditingValue('')
                        }
                      }}
                      className="flex-1 px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    />
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => startEdit(index)}
                      className="flex-1 text-left px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      {status}
                    </button>
                    {count > 0 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {count} {count === 1 ? 'task' : 'tasks'}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => requestRemove(index)}
                      disabled={!removable}
                      aria-label={`Remove status: ${status}`}
                      title={
                        !removable
                          ? count > 0
                            ? `Cannot remove: ${count} task(s) in this status`
                            : 'Cannot remove the last status'
                          : 'Remove status'
                      }
                      className="min-h-[44px] min-w-[44px] p-2 rounded text-gray-500 dark:text-gray-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      🗑
                    </button>
                  </>
                )}
              </li>
            )
          })}
        </ul>

        <button
          type="button"
          onClick={addStatus}
          className="w-full px-4 py-2 mb-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors duration-150"
        >
          + Add status
        </button>

        {error && (
          <p role="alert" className="text-red-600 dark:text-red-400 text-sm mb-4">
            {error}
          </p>
        )}

        {confirmingRemove !== null ? (
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={cancelRemove}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmRemove}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 transition-colors duration-150"
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors duration-150"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default StatusManager
