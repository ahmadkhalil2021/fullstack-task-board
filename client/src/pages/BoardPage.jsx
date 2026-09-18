// BoardPage.jsx — Board shell for "/board/:boardId" (Kanban) and
// "/board/:boardId/list" (List). Owns board loading, the shared header and
// search, view selection, the filter banner and the task modal.

import { useEffect, useMemo } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useBoardStore, filterTasks } from '../store/useBoardStore.js'
import { useView } from '../lib/useView.js'
import BoardHeader from '../components/BoardHeader.jsx'
import ErrorBanner from '../components/ErrorBanner.jsx'
import ViewSwitcher from '../components/ViewSwitcher.jsx'
import KanbanBoard from '../views/KanbanBoard.jsx'
import ListView from '../views/ListView.jsx'
import GridView from '../views/GridView.jsx'
import TableView from '../views/TableView.jsx'
import EmptyBoard from '../components/EmptyBoard.jsx'

const BoardPage = () => {
  const { boardId } = useParams()
  const board = useBoardStore(s => s.board)
  const isLoading = useBoardStore(s => s.isLoading)
  const fetchBoard = useBoardStore(s => s.fetchBoard)
  const query = useBoardStore(s => s.query)
  const filterStatus = useBoardStore(s => s.filterStatus)
  const clearSearch = useBoardStore(s => s.clearSearch)
  const view = useView()
  const navigate = useNavigate()
  const location = useLocation()

  // Tasks open their dedicated page; `from` preserves the exact view + filters.
  const openTask = (task) =>
    navigate(`/board/${boardId}/task/${task._id}`, {
      state: { from: location.pathname + location.search },
    })

  useEffect(() => {
    if (board?._id !== boardId) {
      fetchBoard(boardId)
    }
  }, [boardId, board?._id, fetchBoard])

  // Derived once for the shared filter banner; each view derives its own set
  // so it stays self-contained.
  const visibleTasks = useMemo(
    () => filterTasks(board?.tasks, query, filterStatus),
    [board?.tasks, query, filterStatus]
  )
  const isFiltering = query !== '' || filterStatus !== null

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-subtle flex flex-col">
        <div className="flex gap-4 p-6 overflow-x-auto" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex flex-col rounded-card p-3 min-w-[280px] flex-1 bg-surface-muted animate-pulse"
            >
              <div className="flex items-center justify-between px-2 py-1 mb-2">
                <div className="h-4 w-24 rounded bg-surface-border-strong" />
                <div className="h-5 w-8 rounded-full bg-surface-border-strong" />
              </div>
              <div className="flex flex-col gap-2">
                <div className="h-24 rounded-card bg-surface-border" />
                <div className="h-24 rounded-card bg-surface-border" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-subtle flex flex-col">
      <ErrorBanner />

      {!board ? (
        <EmptyBoard message="No board loaded" />
      ) : (
        <>
          <BoardHeader />

          {isFiltering && visibleTasks.length === 0 && (
            <div className="px-4 sm:px-6 pt-4">
              <div
                role="status"
                className="mx-auto flex max-w-xl items-center justify-between gap-4 rounded-card border border-surface-border bg-surface-raised px-4 py-3 text-sm text-surface-text-muted"
              >
                <span>No tasks match</span>
                <button
                  type="button"
                  onClick={clearSearch}
                  className="rounded px-2 py-1 text-sm text-primary hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle transition-colors duration-200"
                >
                  Clear filters
                </button>
              </div>
            </div>
          )}

          {board.statuses.length === 0 ? (
            <EmptyBoard message="No columns defined for this board" />
          ) : (
            <>
              <div className="flex justify-end px-4 sm:px-6 pt-4">
                <ViewSwitcher />
              </div>
              {view === 'kanban' ? (
                <KanbanBoard key={board._id} onTaskClick={openTask} />
              ) : (
                <main className="flex-1 p-4 sm:p-6">
                  {view === 'list' && <ListView key={board._id} onTaskClick={openTask} />}
                  {view === 'grid' && <GridView key={board._id} onTaskClick={openTask} />}
                  {view === 'table' && <TableView key={board._id} onTaskClick={openTask} />}
                </main>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

export default BoardPage
