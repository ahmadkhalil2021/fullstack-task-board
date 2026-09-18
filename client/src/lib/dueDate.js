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

// `YYYY-MM-DD` key from UTC parts, or null for empty/invalid values.
// Used for grouping and comparisons so a date never shifts a day.
export const toDateKey = (iso) => {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const year = String(date.getUTCFullYear()).padStart(4, '0')
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

// A due date is overdue once its calendar day is before the user's local day.
// Date-only values are stored as UTC midnight, so the due calendar day comes
// from UTC parts while "today" comes from local parts.
export const isOverdue = (iso, now = new Date()) => {
  if (!iso) return false
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return false
  const due = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return due < today
}
