// statusColor.js — Map a board status name to a design token.
// Used by TaskCard's left stripe and Column's top border so each
// status reads as its own color without each component re-inventing the logic.

const RULES = [
  { key: 'inprogress', match: ['progress', 'doing', 'active', 'wip'] },
  { key: 'done', match: ['done', 'complete', 'finish', 'shipped'] },
  { key: 'wontdo', match: ["don't", 'wont', 'wont do', 'skip', 'cancelled', 'canceled'] },
  { key: 'blocked', match: ['block', 'stuck', 'waiting'] },
]

export const statusColor = (status) => {
  const s = (status ?? '').toLowerCase().trim()
  if (!s) return 'todo'
  for (const { key, match } of RULES) {
    if (match.some((needle) => s.includes(needle))) return key
  }
  return 'todo'
}