// priority.js — Priority values, labels, ranking and color tokens.

export const PRIORITY_VALUES = ['none', 'low', 'medium', 'high']

export const PRIORITY_LABELS = {
  none: 'None',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

// Higher rank = more important, used for table sorting.
export const PRIORITY_RANK = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
}

export const priorityLabel = (priority) => PRIORITY_LABELS[priority] ?? 'None'

// Returns a token suffix for `bg-priority-{...}`, or null for no priority.
export const priorityColor = (priority) =>
  priority && priority !== 'none' ? priority : null
