// CommandBar.jsx — Odoo-style board search bar in the header.
// Focus the input to get filter suggestions, type for a quick-search option,
// and apply filters as removable facet chips. Applied state stays in the
// store and is mirrored to ?q= / ?f= without coupling the store to the router.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useBoardStore, filterTasks } from '../store/useBoardStore.js'
import { resolveStatusKey, statusKeyFor } from '../lib/statusKey.js'
import { statusColor } from '../lib/statusColor.js'

const CommandBar = () => {
  const board = useBoardStore((s) => s.board)
  const query = useBoardStore((s) => s.query)
  const filterStatus = useBoardStore((s) => s.filterStatus)
  const setSearchQuery = useBoardStore((s) => s.setSearchQuery)
  const setFilterStatus = useBoardStore((s) => s.setFilterStatus)

  const [searchParams, setSearchParams] = useSearchParams()
  const [draft, setDraft] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const didMount = useRef(false)

  const statuses = useMemo(() => board?.statuses ?? [], [board?.statuses])

  // Hydrate the store from the URL on mount, then canonicalize q/f in the URL
  // (trimmed query, resolved status key) so stale links never filter wrongly.
  useEffect(() => {
    const urlQuery = (searchParams.get('q') ?? '').trim()
    const resolved = resolveStatusKey(searchParams.get('f'), statuses)

    setSearchQuery(urlQuery)
    setFilterStatus(resolved)

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

  // Keep the URL in sync with the applied filters. The mount run is skipped
  // because the hydration effect above already canonicalized the URL.
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
      setSearchQuery(urlQuery)
      setFilterStatus(urlStatus)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // A renamed or removed status must not leave a filter pointing at nothing.
  useEffect(() => {
    if (filterStatus && !statuses.includes(filterStatus)) setFilterStatus(null)
  }, [statuses, filterStatus, setFilterStatus])

  // Global shortcut: jump into the search bar.
  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setIsOpen(true)
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Close the suggestion list on any click outside the bar.
  useEffect(() => {
    if (!isOpen) return
    const onMouseDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [isOpen])

  const trimmedDraft = draft.trim()

  // Restart keyboard navigation at the top whenever the options change.
  useEffect(() => {
    setActiveIndex(0)
  }, [trimmedDraft, isOpen])

  const queryMatchedTasks = useMemo(
    () => filterTasks(board?.tasks, query, null),
    [board?.tasks, query]
  )

  const counts = useMemo(() => {
    const map = new Map()
    queryMatchedTasks.forEach((task) =>
      map.set(task.status, (map.get(task.status) ?? 0) + 1)
    )
    return map
  }, [queryMatchedTasks])

  const statusOptions = useMemo(
    () => statuses.map((status, index) => ({ id: `command-bar-status-${index}`, status })),
    [statuses]
  )

  if (!board) return null

  const options = trimmedDraft
    ? [{ id: 'command-bar-quick-search', type: 'search' }, ...statusOptions.map((option) => ({ ...option, type: 'status' }))]
    : statusOptions.map((option) => ({ ...option, type: 'status' }))

  const safeIndex = Math.min(activeIndex, Math.max(options.length - 1, 0))
  const activeOption = options[safeIndex]

  const facets = []
  if (query) {
    facets.push({
      key: 'query',
      label: `Search: ${query}`,
      remove: () => setSearchQuery(''),
    })
  }
  if (filterStatus) {
    facets.push({
      key: 'status',
      label: filterStatus,
      dot: statusColor(filterStatus),
      remove: () => setFilterStatus(null),
    })
  }

  const applyOption = (option) => {
    if (!option) return
    if (option.type === 'search') {
      setSearchQuery(trimmedDraft)
      setDraft('')
    } else {
      setFilterStatus(filterStatus === option.status ? null : option.status)
    }
    setIsOpen(false)
    inputRef.current?.focus()
  }

  const removeLastFacet = () => {
    if (filterStatus) setFilterStatus(null)
    else if (query) setSearchQuery('')
  }

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
        return
      }
      setActiveIndex((index) => Math.min(index + 1, options.length - 1))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
      return
    }
    if (event.key === 'Enter') {
      if (!isOpen) return
      event.preventDefault()
      applyOption(activeOption)
      return
    }
    if (event.key === 'Escape') {
      if (isOpen) {
        event.preventDefault()
        setIsOpen(false)
      } else if (draft) {
        setDraft('')
      }
      return
    }
    if (event.key === 'Backspace' && draft === '') {
      removeLastFacet()
    }
  }

  const renderOption = (option, index) => (
    <div
      key={option.id}
      id={option.id}
      role="option"
      aria-selected={index === safeIndex}
      onMouseDown={(event) => {
        event.preventDefault()
        applyOption(option)
      }}
      onMouseEnter={() => setActiveIndex(index)}
      className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${
        index === safeIndex ? 'bg-surface-muted text-surface-text' : 'text-surface-text-muted'
      }`}
    >
      {option.type === 'search' ? (
        <>
          <span aria-hidden="true">🔍</span>
          <span>
            Name or description contains &quot;<strong>{trimmedDraft}</strong>&quot;
          </span>
        </>
      ) : (
        <>
          <span
            aria-hidden="true"
            className={`inline-block h-2 w-2 shrink-0 rounded-full bg-status-${statusColor(option.status)}`}
          />
          <span className="flex-1">{option.status}</span>
          <span className="text-xs text-surface-text-subtle">
            {counts.get(option.status) ?? 0}
          </span>
          {filterStatus === option.status && (
            <span aria-hidden="true" className="text-primary">
              ✓
            </span>
          )}
        </>
      )}
    </div>
  )

  return (
    <div
      ref={rootRef}
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false)
      }}
    >
      <div className="flex flex-wrap items-center gap-1 rounded-card border border-surface-border bg-surface-raised px-2 py-1.5 transition-colors duration-200 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/40">
        <span aria-hidden="true" className="px-1 text-surface-text-subtle">
          🔍
        </span>
        {facets.map((facet) => (
          <span
            key={facet.key}
            className="inline-flex items-center gap-1 rounded-md bg-primary-muted px-2 py-0.5 text-sm text-primary-muted-text"
          >
            {facet.dot && (
              <span
                aria-hidden="true"
                className={`inline-block h-2 w-2 shrink-0 rounded-full bg-status-${facet.dot}`}
              />
            )}
            {facet.label}
            <button
              type="button"
              aria-label={`Remove filter: ${facet.label}`}
              onClick={() => {
                facet.remove()
                inputRef.current?.focus()
              }}
              className="rounded p-0.5 leading-none hover:bg-primary/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label="Search tasks"
          aria-expanded={isOpen}
          aria-controls="command-bar-listbox"
          aria-autocomplete="list"
          aria-activedescendant={isOpen && activeOption ? activeOption.id : undefined}
          placeholder="Search..."
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onClick={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="min-w-[6rem] flex-1 bg-transparent text-sm text-surface-text placeholder:text-surface-text-subtle focus:outline-none"
        />
      </div>

      {isOpen && (
        <div
          id="command-bar-listbox"
          role="listbox"
          aria-label="Search suggestions"
          className="absolute left-0 right-0 top-full z-40 mt-1 max-h-80 overflow-y-auto rounded-card border border-surface-border bg-surface-overlay shadow-card-hover"
        >
          {trimmedDraft && (
            <>
              <div
                role="presentation"
                className="border-b border-surface-border px-3 pt-2 pb-1 text-xs uppercase tracking-wide text-surface-text-subtle"
              >
                Search
              </div>
              {renderOption(options[0], 0)}
            </>
          )}
          <div
            role="presentation"
            className="border-b border-surface-border px-3 pt-2 pb-1 text-xs uppercase tracking-wide text-surface-text-subtle"
          >
            Filters
          </div>
          {statusOptions.map((option, index) =>
            renderOption(
              { ...option, type: 'status' },
              index + (trimmedDraft ? 1 : 0)
            )
          )}
        </div>
      )}
    </div>
  )
}

export default CommandBar
