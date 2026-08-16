// ActivityFeed.jsx — Right-edge slide-in panel showing a board's activity.
// Reads the activity slice from the store (Flux: no direct API calls here).
// Timestamps re-render once per minute via a local tick.

import { useEffect, useId, useState } from 'react'
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

const ActivityIcon = ({ className = 'h-5 w-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 12h4l3-9 4 18 3-9h4" />
  </svg>
)

const CloseIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
)

// Small inline SVG set per activity type. `Fallback` is shown when the type is unknown.
const ICONS = {
  task_created: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  task_updated: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  ),
  task_moved: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h13M17 7l-4-4M17 7l-4 4" />
      <path d="M20 17H7M7 17l4-4M7 17l4 4" />
    </svg>
  ),
  task_deleted: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  ),
  board_updated: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 4h16v4H4zM4 12h10v4H4zM4 20h7" />
    </svg>
  ),
  status_added: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12h6M3 6h12M3 18h9" />
      <path d="M18 12v6M15 15h6" />
    </svg>
  ),
  status_renamed: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h10M4 12h10M4 17h7" />
      <path d="M17 10l4 4-4 4M21 14h-7" />
    </svg>
  ),
  status_removed: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12h6M3 6h12M3 18h9" />
      <path d="M17 8v8M21 8v8" />
    </svg>
  ),
}

const FallbackIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </svg>
)

const EmptyIllustration = () => (
  <svg className="h-14 w-14 text-gray-300 dark:text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
)

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

const ActivityFeed = ({ id, isOpen, onClose }) => {
  const board = useBoardStore((s) => s.board)
  const activity = useBoardStore((s) => s.activity)
  const activityLoading = useBoardStore((s) => s.activityLoading)
  const activityError = useBoardStore((s) => s.activityError)
  const activityHasMore = useBoardStore((s) => s.activityHasMore)
  const fetchActivity = useBoardStore((s) => s.fetchActivity)
  const clearActivityError = useBoardStore((s) => s.clearActivityError)
  const headingId = useId()

  // Re-render once per minute so relative timestamps stay fresh.
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(id)
  }, [])

  // Fetch the feed once per board (in parallel with the board load).
  useEffect(() => {
    if (isOpen && board && activity.length === 0 && !activityLoading && !activityError) {
      fetchActivity(board._id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board?._id, isOpen])

  useEffect(() => {
    if (!isOpen) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

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
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        aria-hidden="true"
        onClick={onClose}
      />
      <aside
        id={id}
        className={`glass-surface fixed inset-x-0 bottom-0 top-auto z-50 flex max-h-[85vh] w-full transform flex-col rounded-t-2xl rounded-b-none border border-white/50 bg-white shadow-glass-sm backdrop-blur-xl transition-transform duration-300 dark:border-white/10 dark:bg-gray-900 dark:shadow-glass-dark md:inset-y-4 md:right-4 md:left-auto md:top-4 md:w-[26rem] md:max-w-[calc(100vw-2rem)] md:rounded-2xl ${isOpen ? 'translate-y-0 md:translate-x-0 md:translate-y-0' : 'translate-y-full md:translate-x-full md:translate-y-0'}`}
        role="dialog"
        aria-label="Activity feed"
        aria-labelledby={headingId}
        aria-modal="true"
        aria-hidden={!isOpen}
        inert={!isOpen}
      >
        <div className="flex items-center justify-between gap-3 border-b border-gray-200/70 px-5 py-4 dark:border-white/10">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-400/15 dark:text-blue-300">
              <ActivityIcon />
            </span>
            <h2 id={headingId} className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">Activity</h2>
            {activity.length > 0 && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium tabular-nums text-gray-600 dark:bg-white/10 dark:text-gray-300">
                {activity.length}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close activity feed"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-400 dark:hover:bg-white/10"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="max-h-[calc(85vh-5rem)] flex-1 overflow-y-auto scrollbar-hide px-4 py-4 md:max-h-none">
          {activityLoading && activity.length === 0 && (
            <div role="status" aria-label="Loading activity" className="space-y-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl border border-gray-200/70 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5">
                  <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!activityLoading && activity.length === 0 && !activityError && (
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <EmptyIllustration />
              <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-200">No activity yet</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">No activity yet — make a move!</p>
            </div>
          )}

          {activityError && (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-red-200/80 bg-red-50/80 p-6 text-center dark:border-red-400/30 dark:bg-red-500/10">
              <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-200">
                Could not load activity
              </p>
              {activityError && (
                <p className="text-xs text-red-600/80 dark:text-red-300/80">{activityError}</p>
              )}
              <button
                type="button"
                onClick={retry}
                className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                Retry
              </button>
            </div>
          )}

          {activity.length > 0 && (
            <ul className="space-y-2">
              {activity.map((item) => (
                <li
                  key={item._id}
                  tabIndex={0}
                  className="group flex items-start gap-3 rounded-xl border border-gray-200/70 bg-white/70 p-3 outline-none transition-colors hover:border-gray-300 hover:bg-white focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20 dark:hover:bg-white/10"
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:bg-blue-400/15 dark:text-blue-300">
                    {ICONS[item.type] || <FallbackIcon />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-5 text-gray-900 dark:text-gray-100">
                      {describeActivity(item)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
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
              className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
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
