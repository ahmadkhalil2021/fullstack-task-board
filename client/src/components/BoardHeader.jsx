// BoardHeader.jsx — Top of the board page
// Shows the board name and description as editable fields.
// Persists on blur via the store's optimistic updateBoard action.

import { useEffect, useState } from 'react'
import { useBoardStore } from '../store/useBoardStore.js'
import ThemeToggle from './ThemeToggle.jsx'
import StatusManager from './StatusManager.jsx'
import ActivityFeed from './ActivityFeed.jsx'

const BoardHeader = () => {
  const board = useBoardStore(s => s.board)
  const updateBoard = useBoardStore(s => s.updateBoard)

  const [draftName, setDraftName] = useState('')
  const [draftDescription, setDraftDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [statusManagerOpen, setStatusManagerOpen] = useState(false)
  const [isActivityOpen, setIsActivityOpen] = useState(false)

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
    <header className="flex items-start justify-between gap-4 px-4 sm:px-6 py-4 border-b border-surface-border bg-surface-raised transition-colors duration-200">
      <div className="flex-1 min-w-0 max-w-2xl">
        <input
          type="text"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={save}
          disabled={saving}
          aria-label="Board name"
          className="w-full text-xl sm:text-2xl font-bold bg-transparent border-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle rounded px-1 text-surface-text"
          placeholder="Board name"
        />
        <input
          type="text"
          value={draftDescription}
          onChange={(e) => setDraftDescription(e.target.value)}
          onBlur={save}
          disabled={saving}
          aria-label="Board description"
          className="w-full mt-1 text-sm bg-transparent border-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle rounded px-1 text-surface-text-muted"
          placeholder="Add a description..."
        />
        {(saving || saveError) && (
          <p
            role={saveError ? 'alert' : 'status'}
            aria-live={saveError ? 'assertive' : 'polite'}
            className={`text-sm mt-1 transition-colors duration-200 ${saveError ? 'text-danger' : 'text-surface-text-subtle'}`}
          >
            {saveError || 'Saving...'}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 p-1 rounded-lg bg-surface-muted border border-surface-border shrink-0">
        <button
          type="button"
          onClick={() => setIsActivityOpen(true)}
          aria-label="Show activity feed"
          className="min-h-[40px] min-w-[40px] p-2 rounded text-surface-text-muted hover:bg-surface-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle transition-colors duration-200"
        >
          🕘
        </button>
        <button
          type="button"
          onClick={() => setStatusManagerOpen(true)}
          aria-label="Manage board statuses"
          className="min-h-[40px] min-w-[40px] p-2 rounded text-surface-text-muted hover:bg-surface-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle transition-colors duration-200"
        >
          ⚙
        </button>
        <ThemeToggle />
      </div>

      {statusManagerOpen && (
        <StatusManager isOpen={statusManagerOpen} onClose={() => setStatusManagerOpen(false)} />
      )}
      <ActivityFeed isOpen={isActivityOpen} onClose={() => setIsActivityOpen(false)} />
    </header>
  )
}

export default BoardHeader