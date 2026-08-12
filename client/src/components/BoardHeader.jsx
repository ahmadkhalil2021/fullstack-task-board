// BoardHeader.jsx — Top of the board page
// Shows the board name and description as editable fields.
// Persists on blur via the store's optimistic updateBoard action.

import { useEffect, useState } from 'react'
import { useBoardStore } from '../store/useBoardStore.js'
import ThemeToggle from './ThemeToggle.jsx'

const BoardHeader = () => {
  const board = useBoardStore(s => s.board)
  const updateBoard = useBoardStore(s => s.updateBoard)

  const [draftName, setDraftName] = useState('')
  const [draftDescription, setDraftDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

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
    const trimmed = draftName.trim()
    if (!trimmed) {
      setSaveError('Board name is required')
      setDraftName(board.name ?? '')
      return
    }
    if (trimmed === (board.name ?? '') && draftDescription === (board.description ?? '')) return

    setSaving(true)
    setSaveError(null)
    try {
      await updateBoard({ name: trimmed, description: draftDescription })
    } catch (err) {
      setSaveError(err?.message || 'Could not save board')
    } finally {
      setSaving(false)
    }
  }

  return (
    <header className="flex items-start justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
      <div className="flex-1">
        <input
          type="text"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={save}
          disabled={saving}
          className="w-full text-2xl font-bold bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 text-gray-900 dark:text-gray-100"
          placeholder="Board name"
        />
        <input
          type="text"
          value={draftDescription}
          onChange={(e) => setDraftDescription(e.target.value)}
          onBlur={save}
          disabled={saving}
          className="w-full mt-1 text-sm bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 text-gray-600 dark:text-gray-400"
          placeholder="Add a description..."
        />
        {saving && <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Saving...</p>}
        {saveError && <p className="text-red-600 dark:text-red-400 text-sm mt-1">{saveError}</p>}
      </div>
      <ThemeToggle />
    </header>
  )
}

export default BoardHeader
