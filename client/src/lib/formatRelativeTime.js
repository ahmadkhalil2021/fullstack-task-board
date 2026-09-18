// formatRelativeTime.js — Relative "2 hours ago" labels with a safe fallback.
// Shared by the ActivityFeed and the List view; the `(iso, now)` signature
// keeps it deterministic in tests.

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

export const formatRelativeTime = (iso, now = Date.now()) => {
  const timestamp = new Date(iso).getTime()
  if (Number.isNaN(timestamp)) return 'recently'
  const seconds = Math.round((timestamp - now) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 60) return rtf.format(seconds, 'second')
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour')
  if (abs < 2592000) return rtf.format(Math.round(seconds / 86400), 'day')
  if (abs < 31536000) return rtf.format(Math.round(seconds / 2592000), 'month')
  return rtf.format(Math.round(seconds / 31536000), 'year')
}
