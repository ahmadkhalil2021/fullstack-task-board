// dueDate.js — Date-only helpers for task due dates.
// Due dates are stored as UTC midnight ISO strings (from `YYYY-MM-DD`), so
// all conversions use UTC parts to avoid a day shift in western timezones.

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

// Convert a stored ISO date to the `YYYY-MM-DD` value an <input type="date"> expects.
export const toDateInputValue = (iso) => {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// `Aug 30` for a valid date, null for empty/invalid values.
export const formatDueDate = (iso) => {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return dateFormatter.format(date)
}

// A due date is overdue once its UTC calendar day is before today's.
export const isOverdue = (iso, now = new Date()) => {
  if (!iso) return false
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return false
  const due = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return due < today
}
