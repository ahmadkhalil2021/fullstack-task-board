// BoardPage.jsx — Board view at "/board/:boardId"
// Issue #6: renders the board with columns and tasks.
// Fetches the board on mount if it's not already loaded.

import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useBoardStore } from '../store/useBoardStore.js'
import BoardHeader from '../components/BoardHeader.jsx'
import Column from '../components/Column.jsx'
import EmptyBoard from '../components/EmptyBoard.jsx'

const BoardPage = () => {
  const { boardId } = useParams()
  const board = useBoardStore(s => s.board)
  const isLoading = useBoardStore(s => s.isLoading)
  const error = useBoardStore(s => s.error)
  const fetchBoard = useBoardStore(s => s.fetchBoard)

  // Fetch the board on mount (or when the id changes)
  // We check the current board id to avoid refetching on every render
  useEffect(() => {
    if (board?._id !== boardId) {
      fetchBoard(boardId)
    }
  }, [boardId, board?._id, fetchBoard])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center text-gray-500 dark:text-gray-400">
        Loading...
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    )
  }

  if (!board) {
    return <EmptyBoard message="No board loaded" />
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <BoardHeader />
      <main className="flex-1 p-6 overflow-x-auto">
        {board.statuses.length === 0 ? (
          <EmptyBoard message="No columns defined for this board" />
        ) : (
          <div className="flex gap-4 h-full">
            {board.statuses.map((status) => (
              <Column
                key={status}
                status={status}
                tasks={board.tasks.filter((t) => t.status === status)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default BoardPage
