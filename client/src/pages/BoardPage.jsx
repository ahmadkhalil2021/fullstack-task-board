// BoardPage.jsx — Board view at "/board/:boardId"
// Renders the board with columns and tasks. Click a task to open the edit form.
// Drag a task to another column to change its status.

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragOverlay,
} from '@dnd-kit/core'
import { useBoardStore } from '../store/useBoardStore.js'
import BoardHeader from '../components/BoardHeader.jsx'
import Column from '../components/Column.jsx'
import TaskForm from '../components/TaskForm.jsx'
import TaskCard from '../components/TaskCard.jsx'
import EmptyBoard from '../components/EmptyBoard.jsx'

const BoardPage = () => {
  const { boardId } = useParams()
  const board = useBoardStore(s => s.board)
  const isLoading = useBoardStore(s => s.isLoading)
  const error = useBoardStore(s => s.error)
  const fetchBoard = useBoardStore(s => s.fetchBoard)
  const updateTask = useBoardStore(s => s.updateTask)

  // Track which task is being edited (null = no modal open)
  const [editingTask, setEditingTask] = useState(null)
  // Track which task is being dragged (for the drag overlay)
  const [draggingTask, setDraggingTask] = useState(null)

  // Sensors: pointer (mouse + touch) and keyboard (accessibility)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  )

  useEffect(() => {
    if (board?._id !== boardId) {
      fetchBoard(boardId)
    }
  }, [boardId, board?._id, fetchBoard])

  // Find which column a task belongs to (used to find the source column on drag start)
  const findColumnOfTask = (taskId) => {
    if (!board) return null
    return board.tasks.find((t) => t._id === taskId)?.status
  }

  // Find which column a point is over (for drop targets)
  const findColumnFromOver = (overId) => {
    if (!board) return null
    // The overId is either a column id (e.g. "Backlog") or a task id
    if (board.statuses.includes(overId)) return overId
    return findColumnOfTask(overId)
  }

  const handleDragStart = (event) => {
    const task = board?.tasks.find((t) => t._id === event.active.id)
    if (task) setDraggingTask(task)
  }

  const handleDragEnd = (event) => {
    setDraggingTask(null)
    const { active, over } = event
    if (!over) return

    const sourceStatus = findColumnOfTask(active.id)
    const targetStatus = findColumnFromOver(over.id)
    if (!sourceStatus || !targetStatus || sourceStatus === targetStatus) return

    // Optimistically move the task to the new column
    updateTask(active.id, { status: targetStatus })
  }

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
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
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

        {/* The DragOverlay shows a floating card that follows the cursor while dragging */}
        <DragOverlay>
          {draggingTask ? <TaskCard task={draggingTask} /> : null}
        </DragOverlay>
      </DndContext>

      {editingTask && (
        <TaskForm task={editingTask} onClose={() => setEditingTask(null)} />
      )}
    </div>
  )
}

export default BoardPage
