// statusKey.js — Map arbitrary board statuses to stable URL filter keys.
// Boards define their own statuses (ADR-0007), so filter keys are derived
// from the label instead of being hard-coded to the three default columns.

const ALIASES = {
  progress: ['in-progress', 'inprogress', 'progress'],
  inprogress: ['in-progress', 'inprogress', 'progress'],
  completed: ['completed', 'done'],
  done: ['completed', 'done'],
  'wont-do': ['wont-do', 'won-t-do', 'wontdo'],
  wontdo: ['wont-do', 'won-t-do', 'wontdo'],
}

export const toStatusKey = (status) => {
  if (typeof status !== 'string') return ''
  return status
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Two labels can normalize to the same key ("Done" / "done!"). When that
// happens every colliding status gets a numbered key (`done-1`, `done-2`) and
// the plain base key is rejected on read, so an ambiguous URL can never filter
// one of the colliding statuses by accident.
export const buildStatusKeyMap = (statuses = []) => {
  const statusToKey = new Map()
  const keyToStatus = new Map()
  const keyTotals = new Map()
  const keySeen = new Map()

  statuses.forEach((status) => {
    const base = toStatusKey(status)
    if (!base) return
    keyTotals.set(base, (keyTotals.get(base) ?? 0) + 1)
  })

  statuses.forEach((status) => {
    const base = toStatusKey(status)
    if (!base) return
    const occurrence = (keySeen.get(base) ?? 0) + 1
    keySeen.set(base, occurrence)
    const key = keyTotals.get(base) > 1 ? `${base}-${occurrence}` : base
    statusToKey.set(status, key)
    keyToStatus.set(key, status)
  })

  return { statusToKey, keyToStatus }
}

// Resolve an incoming `?f=` value to a current board status. Unknown, stale
// and ambiguous keys resolve to null so a filter never hides the wrong tasks.
export const resolveStatusKey = (value, statuses = []) => {
  if (typeof value !== 'string' || !value.trim()) return null
  const key = toStatusKey(value)
  const { keyToStatus } = buildStatusKeyMap(statuses)
  if (keyToStatus.has(key)) return keyToStatus.get(key)
  for (const candidate of ALIASES[key] ?? []) {
    if (keyToStatus.has(candidate)) return keyToStatus.get(candidate)
  }
  return null
}

export const statusKeyFor = (status, statuses = []) =>
  buildStatusKeyMap(statuses).statusToKey.get(status) ?? null
