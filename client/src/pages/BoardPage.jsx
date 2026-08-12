// BoardPage.jsx — Board view at "/board/:boardId"
// Click a task to open the edit modal. Drag a task to:
// - Another column → change status
// - Same column → reorder (with @dnd-kit/sortable)

import { useEffect, useRef, useState } from 'react'
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
import { SortableContext, sortableKeyboardCoordinates, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
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
  const clearError = useBoardStore(s => s.clearError)
  const fetchBoard = useBoardStore(s => s.fetchBoard)
  const updateTask = useBoardStore(s => s.updateTask)
  const reorderTasksInColumn = useBoardStore(s => s.reorderTasksInColumn)
  const addTask = useBoardStore(s => s.addTask)

  const [editingTask, setEditingTask] = useState(null)
  const [draggingTask, setDraggingTask] = useState(null)
  const [isAddingTask, setIsAddingTask] = useState(false)
  // Synchronous guard so two rapid clicks can't both start a create before
  // the `isAddingTask` state re-render disables the button.
  const hasStarted = useRef(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    if (board?._id !== boardId) {
      fetchBoard(boardId)
    }
  }, [boardId, board?._id, fetchBoard])

  // Find the column a task belongs to
  const findColumnOfTask = (taskId) => {
    if (!board) return null
    return board.tasks.find((t) => t._id === taskId)?.status
  }

  // Resolve the over.id (which could be a column name or a task id) to a column
  const findColumnFromOver = (overId) => {
    if (!board) return null
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
    if (!over || !board) return

    const sourceStatus = findColumnOfTask(active.id)
    const targetStatus = findColumnFromOver(over.id)
    if (!sourceStatus || !targetStatus) return

    // Case 1: cross-column drag — change status
    if (sourceStatus !== targetStatus) {
      updateTask(active.id, { status: targetStatus })
      return
    }

    // Case 2: same column — reorder
    // Get the current sorted list of task IDs in this column
    const sortedIds = board.tasks
      .filter((t) => t.status === sourceStatus)
      .sort((a, b) => a.order - b.order)
      .map((t) => t._id)

    const oldIndex = sortedIds.indexOf(active.id)
    const newIndex = sortedIds.indexOf(over.id)
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return

    const newSortedIds = arrayMove(sortedIds, oldIndex, newIndex)
    reorderTasksInColumn(sourceStatus, newSortedIds)
  }

  const handleAddTask = async () => {
    if (!board || !board.statuses?.length) return
    if (hasStarted.current) return
    hasStarted.current = true
    setIsAddingTask(true)
    try {
      const realTask = await addTask(board.statuses[0])
      setEditingTask(realTask)
    } catch {
      // The store already rolled back and set `error`; the existing error UI displays it.
    } finally {
      hasStarted.current = false
      setIsAddingTask(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center text-gray-500 dark:text-gray-400">
        Loading...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      {error && (
        <div role="alert" className="bg-red-100 dark:bg-red-900 border-b border-red-300 dark:border-red-700 px-6 py-3 text-red-800 dark:text-red-100">
          <div className="flex items-center justify-between">
            <p>{error}</p>
            <button onClick={clearError} aria-label="Dismiss error">×</button>
          </div>
        </div>
      )}

      {!board ? (
        <EmptyBoard message="No board loaded" />
      ) : (
        <>
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
                  {board.statuses.map((status, index) => {
                    const columnTasks = board.tasks
                      .filter((t) => t.status === status)
                      .sort((a, b) => a.order - b.order)
                    return (
                      <SortableContext
                        key={status}
                        items={columnTasks.map((t) => t._id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <Column
                          status={status}
                          tasks={columnTasks}
                          onTaskClick={setEditingTask}
                          onAddTask={index === 0 ? handleAddTask : undefined}
                          isAddingTask={isAddingTask}
                        />
                      </SortableContext>
                    )
                  })}
                </div>
              )}
            </main>

            <DragOverlay>
              {draggingTask ? <TaskCard task={draggingTask} /> : null}
            </DragOverlay>
          </DndContext>

          {editingTask && (
            <TaskForm task={editingTask} onClose={() => setEditingTask(null)} />
          )}
        </>
      )}
    </div>
  )
}

export default BoardPage
