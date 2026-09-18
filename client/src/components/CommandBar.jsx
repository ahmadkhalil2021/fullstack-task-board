// CommandBar.jsx — Cmd/Ctrl+K command bar for board search and status filtering.
// Owns the URL sync (?q= and ?f=) so the store stays router-agnostic, and
// closes on Esc, backdrop click or when focus leaves the panel.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useBoardStore, filterTasks } from '../store/useBoardStore.js'
import { resolveStatusKey, statusKeyFor } from '../lib/statusKey.js'
import { statusColor } from '../lib/statusColor.js'
import { useDebouncedValue } from '../lib/useDebouncedValue.js'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '')

const CommandBar = () => {
  const board = useBoardStore((s) => s.board)
  const query = useBoardStore((s) => s.query)
  const filterStatus = useBoardStore((s) => s.filterStatus)
  const setSearchQuery = useBoardStore((s) => s.setSearchQuery)
  const setFilterStatus = useBoardStore((s) => s.setFilterStatus)
  const clearSearch = useBoardStore((s) => s.clearSearch)

  const [searchParams, setSearchParams] = useSearchParams()
  const [isOpen, setIsOpen] = useState(false)
  const [draft, setDraft] = useState(() => searchParams.get('q') ?? '')
  const debouncedDraft = useDebouncedValue(draft, 150)

  const triggerRef = useRef(null)
  const inputRef = useRef(null)
  const panelRef = useRef(null)
  const wasOpen = useRef(false)
  const didMount = useRef(false)

  const statuses = useMemo(() => board?.statuses ?? [], [board?.statuses])

  // Hydrate the store from the URL on mount, then canonicalize q/f in the URL
  // (trimmed query, resolved status key) so stale links never filter wrongly.
  useEffect(() => {
    const urlQuery = (searchParams.get('q') ?? '').trim()
    const rawFilter = searchParams.get('f')
    const resolved = resolveStatusKey(rawFilter, statuses)

    setSearchQuery(urlQuery)
    setFilterStatus(resolved)
    if (urlQuery || resolved) setIsOpen(true)

    const next = new URLSearchParams(searchParams)
    if (urlQuery) next.set('q', urlQuery)
    else next.delete('q')
    const canonical = resolved ? statusKeyFor(resolved, statuses) : null
    if (canonical) next.set('f', canonical)
    else next.delete('f')
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Debounced input becomes the effective store query.
  useEffect(() => {
    setSearchQuery(debouncedDraft.trim())
  }, [debouncedDraft, setSearchQuery])

  // Keep the URL in sync with the effective filter state. The mount run is
  // skipped because the hydration effect above already canonicalized the URL.
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true
      return
    }
    const next = new URLSearchParams(searchParams)
    if (query) next.set('q', query)
    else next.delete('q')
    const canonical = filterStatus ? statusKeyFor(filterStatus, statuses) : null
    if (canonical) next.set('f', canonical)
    else next.delete('f')
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filterStatus, statuses])

  // Browser navigation and deep links re-apply the URL without pushing history.
  useEffect(() => {
    const urlQuery = (searchParams.get('q') ?? '').trim()
    const urlStatus = resolveStatusKey(searchParams.get('f'), statuses)
    if (urlQuery !== query || urlStatus !== filterStatus) {
      setDraft(urlQuery)
      setSearchQuery(urlQuery)
      setFilterStatus(urlStatus)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // A renamed or removed status must not leave a filter pointing at nothing.
  useEffect(() => {
    if (filterStatus && !statuses.includes(filterStatus)) setFilterStatus(null)
  }, [statuses, filterStatus, setFilterStatus])

  // Global shortcut. The bar stays mounted while closed.
  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setIsOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Move focus into the panel on open, back to the trigger on close.
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
      wasOpen.current = true
      return
    }
    if (wasOpen.current) {
      wasOpen.current = false
      triggerRef.current?.focus()
    }
  }, [isOpen])

  // "Focus leaves" closes the bar.
  useEffect(() => {
    if (!isOpen) return
    const onFocusIn = (event) => {
      if (!panelRef.current?.contains(event.target)) setIsOpen(false)
    }
    document.addEventListener('focusin', onFocusIn)
    return () => document.removeEventListener('focusin', onFocusIn)
  }, [isOpen])

  const queryMatchedTasks = useMemo(
    () => filterTasks(board?.tasks, query, null),
    [board?.tasks, query]
  )

  const filteredTasks = useMemo(
    () => filterTasks(board?.tasks, query, filterStatus),
    [board?.tasks, query, filterStatus]
  )

  const counts = useMemo(() => {
    const map = new Map()
    queryMatchedTasks.forEach((task) =>
      map.set(task.status, (map.get(task.status) ?? 0) + 1)
    )
    return map
  }, [queryMatchedTasks])

  if (!board) return null

  const isFiltering = query !== '' || filterStatus !== null
  const noMatches = isFiltering && filteredTasks.length === 0

  const close = () => setIsOpen(false)

  const handleClear = () => {
    setDraft('')
    clearSearch()
  }

  const handleDialogKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      close()
      return
    }
    if (event.key !== 'Tab' || !panelRef.current) return
    const nodes = panelRef.current.querySelectorAll(FOCUSABLE_SELECTOR)
    if (!nodes.length) return
    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <>
      <div className="px-4 sm:px-6 pt-4">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Search tasks"
          aria-keyshortcuts="Control+K Meta+K"
          className="flex w-full sm:w-96 items-center gap-2 px-3 py-2 rounded-card border border-surface-border bg-surface-raised text-left text-surface-text-subtle hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle transition-colors duration-200"
        >
          <span aria-hidden="true">🔍</span>
          <span className="text-sm">Search tasks...</span>
          <kbd className="ml-auto text-xs font-sans border border-surface-border rounded px-1.5 py-0.5">
            {IS_MAC ? '⌘K' : 'Ctrl K'}
          </kbd>
        </button>
      </div>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="command-bar-title"
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[10vh] animate-fade-in"
          onClick={(event) => {
            if (event.target === event.currentTarget) close()
          }}
          onKeyDown={handleDialogKeyDown}
        >
          <div
            ref={panelRef}
            className="w-full max-w-xl rounded-card border border-surface-border bg-surface-overlay shadow-card-hover"
          >
            <h2 id="command-bar-title" className="sr-only">
              Board search
            </h2>

            <div className="flex items-center gap-2 border-b border-surface-border p-4">
              <span aria-hidden="true">🔍</span>
              <input
                ref={inputRef}
                type="text"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                aria-label="Search tasks"
                placeholder="Search by name or description..."
                className="min-w-0 flex-1 bg-transparent text-surface-text placeholder:text-surface-text-subtle focus:outline-none"
              />
              <kbd className="text-xs font-sans text-surface-text-subtle border border-surface-border rounded px-1.5 py-0.5">
                Esc
              </kbd>
            </div>

            <div className="flex flex-wrap gap-2 p-4">
              <button
                type="button"
                onClick={() => setFilterStatus(null)}
                aria-pressed={filterStatus === null}
                className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle ${
                  filterStatus === null
                    ? 'border-primary bg-primary-muted text-primary-muted-text'
                    : 'border-surface-border bg-surface-raised text-surface-text-muted hover:bg-surface-muted'
                }`}
              >
                All
                <span className="text-xs text-surface-text-subtle">
                  {queryMatchedTasks.length}
                </span>
              </button>
              {statuses.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() =>
                    setFilterStatus(filterStatus === status ? null : status)
                  }
                  aria-pressed={filterStatus === status}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle ${
                    filterStatus === status
                      ? 'border-primary bg-primary-muted text-primary-muted-text'
                      : 'border-surface-border bg-surface-raised text-surface-text-muted hover:bg-surface-muted'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`inline-block h-2 w-2 shrink-0 rounded-full bg-status-${statusColor(status)}`}
                  />
                  {status}
                  <span className="text-xs text-surface-text-subtle">
                    {counts.get(status) ?? 0}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-surface-border px-4 py-3">
              <p aria-live="polite" className="text-sm text-surface-text-subtle">
                {filteredTasks.length}{' '}
                {filteredTasks.length === 1 ? 'task' : 'tasks'} match
              </p>
              {isFiltering && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="rounded px-2 py-1 text-sm text-primary hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle transition-colors duration-200"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {noMatches && (
        <div className="px-4 sm:px-6 pt-4">
          <div
            role="status"
            className="flex items-center justify-between gap-4 rounded-card border border-surface-border bg-surface-raised px-4 py-3 text-sm text-surface-text-muted"
          >
            <span>No tasks match</span>
            <button
              type="button"
              onClick={handleClear}
              className="rounded px-2 py-1 text-sm text-primary hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle transition-colors duration-200"
            >
              Clear filters
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default CommandBar
