// BoardHeader.jsx — Top of the board page
// Shows the board name and description as editable fields.
// Issue #6: editing is local state only (no persistence). Saving will come later.

import { useState } from 'react'
import { useBoardStore } from '../store/useBoardStore.js'

const BoardHeader = () => {
  const name = useBoardStore(s => s.board?.name ?? '')
  const description = useBoardStore(s => s.board?.description ?? '')

  // Local state for in-progress edits. We don't save these yet.
  const [draftName, setDraftName] = useState(name)
  const [draftDescription, setDraftDescription] = useState(description)

  return (
    <header className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
      <input
        type="text"
        value={draftName}
        onChange={(e) => setDraftName(e.target.value)}
        className="w-full text-2xl font-bold bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 text-gray-900 dark:text-gray-100"
        placeholder="Board name"
      />
      <input
        type="text"
        value={draftDescription}
        onChange={(e) => setDraftDescription(e.target.value)}
        className="w-full mt-1 text-sm bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 text-gray-600 dark:text-gray-400"
        placeholder="Add a description..."
      />
    </header>
  )
}

export default BoardHeader
