// BoardHeader.jsx — Top of the board page
// Shows the board name and description as editable fields.
// Persists on blur via the store's optimistic updateBoard action.

import { useEffect, useState } from 'react'
import { useBoardStore } from '../store/useBoardStore.js'
import ThemeToggle from './ThemeToggle.jsx'
import StatusManager from './StatusManager.jsx'

const BoardHeader = () => {
  const board = useBoardStore(s => s.board)
  const updateBoard = useBoardStore(s => s.updateBoard)

  const [draftName, setDraftName] = useState('')
  const [draftDescription, setDraftDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [statusManagerOpen, setStatusManagerOpen] = useState(false)

  // Sync only on board identity change: syncing on name/description would
  // clobber the user's in-progress edits when the store rolls back after a failed save.
  useEffect(() => {
    if (board) {
      setDraftName(board.name ?? '')
      setDraftDescription(board.description ?? '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board?._id])

  const save = async () => {
    if (!board) return
    const trimmedName = draftName.trim()
    const trimmedDescription = draftDescription.trim()
    if (!trimmedName) {
      setSaveError('Board name is required')
      setDraftName(board.name ?? '')
      return
    }
    if (trimmedName === (board.name ?? '') && trimmedDescription === (board.description ?? '')) return

    setSaving(true)
    setSaveError(null)
    try {
      await updateBoard({ name: trimmedName, description: trimmedDescription })
    } catch (err) {
      setSaveError(err?.message || 'Could not save board')
      useBoardStore.getState().clearError() // suppress duplicate global banner
      // Sync drafts back to rolled-back values so the next blur is a no-op
      const current = useBoardStore.getState().board
      if (current) {
        setDraftName(current.name ?? '')
        setDraftDescription(current.description ?? '')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <header className="flex items-start justify-between px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 transition-colors duration-150">
      <div className="flex-1">
        <input
          type="text"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={save}
          disabled={saving}
          aria-label="Board name"
          className="w-full text-xl sm:text-2xl font-bold bg-transparent border-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-1 text-gray-900 dark:text-gray-100"
          placeholder="Board name"
        />
        <input
          type="text"
          value={draftDescription}
          onChange={(e) => setDraftDescription(e.target.value)}
          onBlur={save}
          disabled={saving}
          aria-label="Board description"
          className="w-full mt-1 text-sm bg-transparent border-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-1 text-gray-600 dark:text-gray-400"
          placeholder="Add a description..."
        />
        {(saving || saveError) && (
          <p
            role={saveError ? 'alert' : 'status'}
            aria-live={saveError ? 'assertive' : 'polite'}
            className={`text-sm mt-1 transition-colors duration-150 ${saveError ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}
          >
            {saveError || 'Saving...'}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setStatusManagerOpen(true)}
          aria-label="Manage board statuses"
          className="min-h-[44px] min-w-[44px] p-2 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors duration-150"
        >
          ⚙
        </button>
        <ThemeToggle />
      </div>

      {statusManagerOpen && (
        <StatusManager isOpen={statusManagerOpen} onClose={() => setStatusManagerOpen(false)} />
      )}
    </header>
  )
}

export default BoardHeader
