// calendarDnd.js — Resolve a calendar drop target to the next dueDate value.
// Returns:
//   string    -> new `YYYY-MM-DD` due date
//   null      -> clear the due date (dropped on the tray)
//   undefined -> no change (same day, unknown or invalid target)

import { toDateKey } from './dueDate.js'

export const resolveDropDate = (currentDueDate, overId) => {
  if (typeof overId !== 'string') return undefined
  if (overId === 'tray') return toDateKey(currentDueDate) ? null : undefined
  if (overId.startsWith('day:')) {
    const targetKey = overId.slice('day:'.length)
    return toDateKey(currentDueDate) === targetKey ? undefined : targetKey
  }
  return undefined
}
