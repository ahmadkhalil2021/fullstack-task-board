// __tests__/due-date.test.js — UTC-safe date helpers for task due dates.

import { describe, it, expect } from 'vitest'
import { toDateInputValue, formatDueDate, isOverdue, toDateKey } from '../lib/dueDate.js'

describe('dueDate helpers', () => {
  it('converts stored ISO dates to date-input values without a day shift', () => {
    expect(toDateInputValue('2026-08-30T00:00:00.000Z')).toBe('2026-08-30')
    expect(toDateInputValue(null)).toBe('')
    expect(toDateInputValue('nope')).toBe('')
  })

  it('builds UTC date keys for grouping', () => {
    expect(toDateKey('2026-09-03T00:00:00.000Z')).toBe('2026-09-03')
    expect(toDateKey('2026-01-01T23:59:59.000Z')).toBe('2026-01-01')
    expect(toDateKey(null)).toBeNull()
    expect(toDateKey('nope')).toBeNull()
  })

  it('formats valid dates and ignores invalid ones', () => {
    expect(formatDueDate('2026-08-30T00:00:00.000Z')).toBe('Aug 30')
    expect(formatDueDate(null)).toBeNull()
    expect(formatDueDate('nope')).toBeNull()
  })

  it('compares the stored due day against the local calendar day', () => {
    const now = new Date(2026, 8, 18, 23, 30) // Sep 18 local
    expect(isOverdue('2026-09-17T00:00:00.000Z', now)).toBe(true)
    expect(isOverdue('2026-09-18T00:00:00.000Z', now)).toBe(false) // today is not overdue
    expect(isOverdue('2026-09-19T00:00:00.000Z', now)).toBe(false)
    expect(isOverdue(null, now)).toBe(false)
    expect(isOverdue('nope', now)).toBe(false)
  })
})
