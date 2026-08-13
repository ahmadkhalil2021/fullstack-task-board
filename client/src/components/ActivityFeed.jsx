// ActivityFeed.jsx — Right-edge slide-in panel showing a board's activity.
// Reads the activity slice from the store (Flux: no direct API calls here).
// Timestamps re-render once per minute via a local tick.

import { useEffect, useState } from 'react'
import { useBoardStore } from '../store/useBoardStore.js'

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

// Manual relative-time formatter — avoids a dependency for one use case.
const formatRelativeTime = (iso, now) => {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 60) return rtf.format(seconds, 'second')
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour')
  if (abs < 2592000) return rtf.format(Math.round(seconds / 86400), 'day')
  if (abs < 31536000) return rtf.format(Math.round(seconds / 2592000), 'month')
  return rtf.format(Math.round(seconds / 31536000), 'year')
}

const ICONS = {
  task_created: '➕',
  task_updated: '✏️',
  task_moved: '↔️',
  task_deleted: '🗑️',
  board_updated: '📝',
  status_added: '➕',
  status_renamed: '✏️',
  status_removed: '🗑️',
}

const describeActivity = (item) => {
  const task = item.taskName || 'a task'
  const status = item.changes?.status
  switch (item.type) {
    case 'task_created':
      return `Task created: ${task}`
    case 'task_updated':
      return `Task updated: ${task}`
    case 'task_moved':
      return status?.from && status?.to
        ? `Moved "${task}" from ${status.from} to ${status.to}`
        : `Task moved: ${task}`
    case 'task_deleted':
      return `Task deleted: ${task}`
    case 'board_updated':
      if (item.changes?.name) {
        return `Board renamed from "${item.changes.name.from}" to "${item.changes.name.to}"`
      }
      if (item.changes?.description) return 'Board description updated'
      return 'Board updated'
    case 'status_added':
      return `Status added: ${status?.to ?? ''}`
    case 'status_renamed':
      return `Status renamed from "${status?.from ?? ''}" to "${status?.to ?? ''}"`
    case 'status_removed':
      return `Status removed: ${status?.from ?? ''}`
    default:
      return item.type
  }
}

const ActivityFeed = ({ isOpen, onClose }) => {
  const board = useBoardStore((s) => s.board)
  const activity = useBoardStore((s) => s.activity)
  const activityLoading = useBoardStore((s) => s.activityLoading)
  const activityError = useBoardStore((s) => s.activityError)
  const activityHasMore = useBoardStore((s) => s.activityHasMore)
  const fetchActivity = useBoardStore((s) => s.fetchActivity)
  const clearActivityError = useBoardStore((s) => s.clearActivityError)

  // Re-render once per minute so relative timestamps stay fresh.
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(id)
  }, [])

  // Fetch the feed once per board (in parallel with the board load).
  useEffect(() => {
    if (board && activity.length === 0 && !activityLoading && !activityError) {
      fetchActivity(board._id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board?._id])

  const loadMore = () => {
    if (!board) return
    const oldest = activity[activity.length - 1]
    if (oldest) fetchActivity(board._id, { before: oldest._id })
  }

  const retry = () => {
    if (!board) return
    clearActivityError()
    fetchActivity(board._id)
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        aria-hidden="true"
        onClick={onClose}
      />
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-80 max-w-[85vw] transform flex-col border-l border-gray-200 bg-white shadow-xl transition-transform duration-300 dark:border-gray-700 dark:bg-gray-900 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        role="complementary"
        aria-label="Activity feed"
        aria-hidden={!isOpen}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Activity</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close activity feed"
            className="min-h-[44px] min-w-[44px] rounded p-2 text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {activityLoading && activity.length === 0 && (
            <div role="status" aria-label="Loading activity" className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-3 w-2/3 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!activityLoading && activity.length === 0 && !activityError && (
            <div className="flex h-full flex-col items-center justify-center py-16 text-center text-gray-500 dark:text-gray-400">
              <p className="text-2xl" aria-hidden="true">📭</p>
              <p className="mt-2 text-sm">No activity yet — make a move!</p>
            </div>
          )}

          {activityError && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                Could not load activity: {activityError}
              </p>
              <button
                type="button"
                onClick={retry}
                className="rounded bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                Retry
              </button>
            </div>
          )}

          {activity.length > 0 && (
            <ul className="space-y-4">
              {activity.map((item) => (
                <li key={item._id} className="flex items-start gap-3">
                  <span className="mt-0.5 text-lg leading-none" aria-hidden="true">
                    {ICONS[item.type] || '•'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      {describeActivity(item)}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {formatRelativeTime(item.createdAt, now)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {activity.length > 0 && activityHasMore && !activityLoading && (
            <button
              type="button"
              onClick={loadMore}
              className="mt-4 w-full rounded px-4 py-2 text-sm text-blue-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-400 dark:hover:bg-gray-800"
            >
              Load more
            </button>
          )}
        </div>
      </aside>
    </>
  )
}

export default ActivityFeed
