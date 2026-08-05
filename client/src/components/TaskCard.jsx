// TaskCard.jsx — Single task with inline editing
// Click to edit. Enter/blur to save. Escape to cancel.
// Delete with confirmation. Icon and status use small dropdowns.

import { useState, useRef, useEffect } from 'react'
import { useBoardStore } from '../store/useBoardStore.js'

const ICONS = ['⏰', '🚀', '🎯', '⭐', '🏁', '✅', '❌', '🔥', '💡', '📌']

// Editable text field. Click to edit, Enter/blur to save, Escape to cancel.
const EditableText = ({ value, onSave, multiline = false, className = '' }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef(null)

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing])

  // Sync draft with prop value when not editing
  useEffect(() => {
    if (!isEditing) setDraft(value)
  }, [value, isEditing])

  const handleSave = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) {
      onSave(trimmed)
    }
    setIsEditing(false)
  }

  const handleCancel = () => {
    setDraft(value)
    setIsEditing(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
  }

  if (isEditing) {
    if (multiline) {
      return (
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          rows={2}
          className={`w-full bg-transparent border border-blue-500 rounded px-1 focus:outline-none text-gray-900 dark:text-gray-100 ${className}`}
        />
      )
    }
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={`w-full bg-transparent border border-blue-500 rounded px-1 focus:outline-none text-gray-900 dark:text-gray-100 ${className}`}
      />
    )
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className={`cursor-text hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-1 -mx-1 ${className}`}
    >
      {value || <span className="text-gray-400 italic">Click to add</span>}
    </div>
  )
}

const TaskCard = ({ task }) => {
  const board = useBoardStore(s => s.board)
  const updateTask = useBoardStore(s => s.updateTask)
  const deleteTask = useBoardStore(s => s.deleteTask)
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [showStatusPicker, setShowStatusPicker] = useState(false)

  const handleDelete = async () => {
    if (window.confirm(`Delete "${task.name}"?`)) {
      try {
        await deleteTask(task._id)
      } catch {
        // Store already set the error state; nothing to do here
      }
    }
  }

  const statuses = board?.statuses ?? []

  return (
    <div className="bg-white dark:bg-gray-800 rounded-md p-3 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow group">
      <div className="flex items-start gap-2">
        {/* Icon + picker */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { setShowIconPicker(!showIconPicker); setShowStatusPicker(false) }}
            className="text-2xl hover:bg-gray-100 dark:hover:bg-gray-700 rounded p-0.5"
            aria-label="Change icon"
          >
            {task.icon}
          </button>
          {showIconPicker && (
            <div className="absolute z-10 top-full left-0 mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded shadow-lg p-1 grid grid-cols-5 gap-1 w-40">
              {ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => { updateTask(task._id, { icon }); setShowIconPicker(false) }}
                  className="text-xl hover:bg-gray-100 dark:hover:bg-gray-600 rounded p-1"
                >
                  {icon}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Name + description */}
        <div className="flex-1 min-w-0">
          <EditableText
            value={task.name}
            onSave={(name) => updateTask(task._id, { name })}
            className="font-medium text-gray-900 dark:text-gray-100"
          />
          <EditableText
            value={task.description}
            onSave={(description) => updateTask(task._id, { description })}
            multiline
            className="mt-1 text-sm text-gray-600 dark:text-gray-400"
          />
        </div>

        {/* Status picker */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { setShowStatusPicker(!showStatusPicker); setShowIconPicker(false) }}
            className="opacity-0 group-hover:opacity-100 text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
            aria-label="Change status"
          >
            {task.status}
          </button>
          {showStatusPicker && (
            <div className="absolute z-10 top-full right-0 mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded shadow-lg py-1 w-40">
              {statuses.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { updateTask(task._id, { status: s }); setShowStatusPicker(false) }}
                  className={`w-full text-left px-3 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 ${s === task.status ? 'font-semibold' : ''}`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Delete button */}
        <button
          type="button"
          onClick={handleDelete}
          className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 dark:hover:text-red-300 text-sm"
          aria-label="Delete task"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

export default TaskCard
