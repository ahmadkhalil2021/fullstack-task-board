// BoardPage.jsx — Board view at "/board/:boardId"
// Renders the board with columns and tasks. Click a task to open the edit form.

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useBoardStore } from '../store/useBoardStore.js'
import BoardHeader from '../components/BoardHeader.jsx'
import Column from '../components/Column.jsx'
import TaskForm from '../components/TaskForm.jsx'
import EmptyBoard from '../components/EmptyBoard.jsx'

const BoardPage = () => {
  const { boardId } = useParams()
  const board = useBoardStore(s => s.board)
  const isLoading = useBoardStore(s => s.isLoading)
  const error = useBoardStore(s => s.error)
  const fetchBoard = useBoardStore(s => s.fetchBoard)

  // Track which task is being edited (null = no modal open)
  const [editingTask, setEditingTask] = useState(null)

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
                onTaskClick={setEditingTask}
              />
            ))}
          </div>
        )}
      </main>

      {editingTask && (
        <TaskForm task={editingTask} onClose={() => setEditingTask(null)} />
      )}
    </div>
  )
}

export default BoardPage
