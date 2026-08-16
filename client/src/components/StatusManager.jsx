// StatusManager.jsx — Modal dialog for adding, renaming, removing, and ordering stages.

import { useEffect, useRef, useState } from 'react'
import { useBoardStore } from '../store/useBoardStore.js'

const MAX_STAGE_NAME_LENGTH = 40
const NEW_STAGE_NAME = 'New status'

const CloseIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
)

const SettingsIcon = ({ className = 'h-5 w-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 6h11M4 12h11M4 18h11" />
    <circle cx="18" cy="6" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="18" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="18" cy="18" r="1.6" fill="currentColor" stroke="none" />
  </svg>
)

const PlusIcon = ({ className = 'h-4 w-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

const ArrowUpIcon = ({ className = 'h-4 w-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
)

const ArrowDownIcon = ({ className = 'h-4 w-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 5v14M5 12l7 7 7-7" />
  </svg>
)

const TrashIcon = ({ className = 'h-4 w-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />
  </svg>
)

const LayersIcon = ({ className = 'h-12 w-12' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2 2 7l10 5 10-5-10-5z" />
    <path d="m2 17 10 5 10-5" />
    <path d="m2 12 10 5 10-5" />
  </svg>
)

const createDraft = (statuses = []) => statuses.map((name, index) => ({
  id: `${index}-${name}`,
  name,
  originalName: name,
}))

const validateName = (value, draft, editingId) => {
  const name = value.trim()
  if (!name) return 'Stage name is required'
  if (name.length > MAX_STAGE_NAME_LENGTH) return `Status names must be ${MAX_STAGE_NAME_LENGTH} characters or fewer`
  if (draft.some((stage) => stage.id !== editingId && stage.name.trim().toLowerCase() === name.toLowerCase())) {
    return 'Status names must be unique'
  }
  return null
}

const StatusManager = ({ isOpen, onClose }) => {
  const board = useBoardStore((s) => s.board)
  const updateBoard = useBoardStore((s) => s.updateBoard)
  const updateTask = useBoardStore((s) => s.updateTask)
  const [draft, setDraft] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [editingValue, setEditingValue] = useState('')
  const [confirmingRemove, setConfirmingRemove] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef(null)
  const previousFocus = useRef(null)

  useEffect(() => {
    if (isOpen && board) {
      previousFocus.current = document.activeElement
      setDraft(createDraft(board.statuses))
      setEditingId(null)
      setEditingValue('')
      setConfirmingRemove(null)
      setError(null)
    }
    // Keep the draft stable while tasks update during a save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, board?._id])

  useEffect(() => {
    if (!isOpen) return undefined
    const handleEscape = (event) => {
      if (event.key === 'Escape' && confirmingRemove === null) {
        if (editingId !== null) {
          cancelEdit()
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, confirmingRemove, editingId, onClose])

  useEffect(() => {
    if (!isOpen) previousFocus.current?.focus?.()
  }, [isOpen])

  if (!isOpen || !board) return null

  const taskCountFor = (stageName) => board.tasks.filter((task) => task.status === stageName).length

  const cancelEdit = () => {
    setEditingId(null)
    setEditingValue('')
    setError(null)
  }

  const startEdit = (stage) => {
    setEditingId(stage.id)
    setEditingValue(stage.name)
    setError(null)
  }

  const commitEdit = () => {
    if (editingId === null) return
    const validationError = validateName(editingValue, draft, editingId)
    if (validationError) {
      if (!editingValue.trim()) {
        const original = draft.find((stage) => stage.id === editingId)
        setEditingValue(original?.name || '')
        setEditingId(null)
        setError(null)
        return
      }
      const original = draft.find((stage) => stage.id === editingId)
      if (original) setEditingValue(original.name)
      setError(validationError)
      inputRef.current?.focus()
      return
    }
    setDraft((current) => current.map((stage) => stage.id === editingId ? { ...stage, name: editingValue.trim() } : stage))
    setEditingId(null)
    setEditingValue('')
    setError(null)
  }

  const addStatus = () => {
    if (editingId !== null) {
      setError('Finish editing the current stage first')
      inputRef.current?.focus()
      return
    }
    let name = NEW_STAGE_NAME
    let counter = 2
    const existingNames = new Set(draft.map((stage) => stage.name.toLowerCase()))
    while (existingNames.has(name.toLowerCase())) {
      name = `${NEW_STAGE_NAME} ${counter}`
      counter += 1
    }
    const id = `new-${Date.now()}`
    setDraft((current) => [...current, { id, name, originalName: null }])
    setEditingId(id)
    setEditingValue(name)
    setError(null)
  }

  const moveStatus = (index, direction) => {
    const target = index + direction
    if (target < 0 || target >= draft.length) return
    setDraft((current) => {
      const next = [...current]
      const [stage] = next.splice(index, 1)
      next.splice(target, 0, stage)
      return next
    })
  }

  const requestRemove = (stage) => {
    setConfirmingRemove(stage.id)
    setError(null)
  }

  const confirmRemove = () => {
    if (confirmingRemove === null || draft.length <= 1) return
    setDraft((current) => current.filter((stage) => stage.id !== confirmingRemove))
    setConfirmingRemove(null)
  }

  const save = async () => {
    const editedDraft = editingId === null
      ? draft
      : draft.map((stage) => stage.id === editingId ? { ...stage, name: editingValue.trim() } : stage)
    const validationError = editedDraft.reduce((result, stage) => result || validateName(stage.name, editedDraft, stage.id), null)
    if (validationError || editedDraft.length === 0) {
      setError(validationError || 'Add at least one stage')
      inputRef.current?.focus()
      return
    }

    if (editingId !== null) {
      setDraft(editedDraft)
      setEditingId(null)
      setEditingValue('')
    }
    const nextStatuses = editedDraft.map((stage) => stage.name.trim())
    const taskChanges = []
    board.tasks.forEach((task) => {
      const stage = editedDraft.find((item) => item.originalName === task.status)
      if (stage && stage.name !== task.status) taskChanges.push({ task, status: stage.name })
      if (!stage && !nextStatuses.includes(task.status)) taskChanges.push({ task, status: nextStatuses[0] })
    })

    setSaving(true)
    setError(null)
    try {
      // Update tasks before removing/renaming their stage so no task becomes unreachable.
      // Sequential updates keep Zustand's optimistic snapshots in order.
      for (const { task, status } of taskChanges) {
        await updateTask(task._id, { status })
      }
      await updateBoard({ statuses: nextStatuses })
      onClose()
    } catch (err) {
      setError(err?.message || 'Could not save stages')
      setDraft(createDraft(useBoardStore.getState().board?.statuses ?? board.statuses))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="status-manager-title"
      onClick={() => confirmingRemove === null && editingId === null && !saving && onClose()}
    >
      <div
        className="glass-surface flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/50 bg-white shadow-glass-sm backdrop-blur-xl dark:border-white/10 dark:bg-gray-900 dark:shadow-glass-dark"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200/70 px-6 py-5 dark:border-white/10">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-400/15 dark:text-blue-300">
              <SettingsIcon className="h-5 w-5" />
            </span>
            <div>
              <h2 id="status-manager-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">Manage statuses</h2>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Rename, reorder, or add stages without losing tasks.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close stage manager"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-400 dark:hover:bg-white/10"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {draft.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50/60 px-6 py-10 text-center dark:border-white/10 dark:bg-white/5">
              <span className="text-gray-400 dark:text-gray-500"><LayersIcon /></span>
              <p className="mt-3 font-medium text-gray-800 dark:text-gray-100">No stages yet</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Add a stage to start organizing tasks.</p>
            </div>
          ) : (
            <ul className="space-y-2" aria-label="Stages">
              {draft.map((stage, index) => {
                const isEditing = editingId === stage.id
                const count = taskCountFor(stage.originalName || stage.name)
                const isConfirming = confirmingRemove === stage.id
                return (
                  <li
                    key={stage.id}
                    className={`overflow-hidden rounded-xl border bg-white/70 transition-colors dark:bg-white/5 ${
                      isConfirming
                        ? 'border-red-300/60 ring-1 ring-red-300/40 dark:border-red-400/30 dark:ring-red-400/20'
                        : 'border-gray-200 dark:border-white/10'
                    }`}
                  >
                    {isConfirming ? (
                      <div className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:bg-red-400/15 dark:text-red-300">
                            <TrashIcon />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              Remove “{stage.name}”?
                            </p>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              Tasks in this stage will be reassigned to another stage when you save.
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirmingRemove(null)}
                            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={confirmRemove}
                            className="rounded-lg bg-red-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 px-2 py-1.5">
                        {isEditing ? (
                          <div className="flex w-full flex-col gap-1 px-2 py-1">
                            <input
                              ref={inputRef}
                              type="text"
                              value={editingValue}
                              maxLength={MAX_STAGE_NAME_LENGTH}
                              autoFocus
                              aria-label={`Edit stage: ${stage.name}`}
                              aria-invalid={Boolean(error)}
                              aria-describedby={error ? 'stage-row-error' : undefined}
                              onChange={(event) => { setEditingValue(event.target.value); setError(null) }}
                              onBlur={commitEdit}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') { event.preventDefault(); commitEdit() }
                                if (event.key === 'Escape') { event.preventDefault(); cancelEdit() }
                              }}
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 dark:border-white/15 dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500"
                            />
                            <div className="flex min-h-[1.25rem] items-center justify-between gap-3">
                              <p id="stage-row-error" role="alert" className="truncate text-xs text-red-600 dark:text-red-300">
                                {error || ''}
                              </p>
                              <p className="shrink-0 text-xs tabular-nums text-gray-400 dark:text-gray-500">
                                {editingValue.length}/{MAX_STAGE_NAME_LENGTH}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex min-h-[2.5rem] flex-1 items-center gap-3 pl-2 pr-1">
                            <button
                              type="button"
                              onClick={() => startEdit(stage)}
                              className="min-h-[2.25rem] flex-1 truncate rounded-md px-2 text-left text-sm font-medium text-gray-900 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-100 dark:hover:bg-white/10"
                            >
                              {stage.name}
                            </button>
                            {count > 0 && (
                              <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium tabular-nums text-gray-600 dark:bg-white/10 dark:text-gray-300">
                                {count} {count === 1 ? 'task' : 'tasks'}
                              </span>
                            )}
                          </div>
                        )}
                        {!isEditing && (
                          <div className="flex shrink-0 items-center gap-0.5 pr-1">
                            <button
                              type="button"
                              onClick={() => moveStatus(index, -1)}
                              disabled={index === 0}
                              aria-label={`Move ${stage.name} up`}
                              className="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-30 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-200"
                            >
                              <ArrowUpIcon />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveStatus(index, 1)}
                              disabled={index === draft.length - 1}
                              aria-label={`Move ${stage.name} down`}
                              className="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-30 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-200"
                            >
                              <ArrowDownIcon />
                            </button>
                            <button
                              type="button"
                              onClick={() => requestRemove(stage)}
                              disabled={draft.length <= 1 || count > 0}
                              aria-label={`Remove status: ${stage.name}`}
                              title={
                                draft.length <= 1
                                  ? 'Cannot remove the last status'
                                  : count > 0
                                    ? `Cannot remove: ${count} task(s) in this status`
                                    : 'Remove stage; tasks are reassigned on save'
                              }
                              className="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-30 dark:text-gray-400 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          <button
            type="button"
            onClick={addStatus}
            disabled={saving || editingId !== null}
            aria-label="+ Add status"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-white/40 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:border-blue-400 hover:bg-blue-50/60 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:border-blue-400/60 dark:hover:bg-blue-500/10 dark:hover:text-blue-200"
          >
            <PlusIcon />
            New stage
          </button>
        </div>

        {error && editingId === null && (
          <div role="alert" className="mx-6 mb-4 rounded-xl border border-red-200/80 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-gray-200/70 bg-gray-50/60 px-6 py-4 dark:border-white/10 dark:bg-white/5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default StatusManager
