// __tests__/task-card.test.jsx — Due date chip and priority indicator on TaskCard.

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import TaskCard from '../components/TaskCard.jsx'

const baseTask = {
  _id: 't1',
  name: 'Task',
  description: '',
  icon: '⏰',
  status: 'A',
}

const renderCard = (overrides = {}) =>
  render(<TaskCard task={{ ...baseTask, ...overrides }} onClick={() => {}} />)

describe('TaskCard — due date and priority', () => {
  it('renders a due date chip for a valid date', () => {
    renderCard({ dueDate: '2099-08-30T00:00:00.000Z' })
    expect(screen.getByText('Aug 30')).toBeInTheDocument()
  })

  it('renders no chip for missing or invalid dates', () => {
    const { rerender } = renderCard({ dueDate: null })
    expect(screen.queryByText('📅')).not.toBeInTheDocument()

    rerender(<TaskCard task={{ ...baseTask, dueDate: 'not-a-date' }} onClick={() => {}} />)
    expect(screen.queryByText('📅')).not.toBeInTheDocument()
  })

  it('marks overdue dates with danger styling and an accessible label', () => {
    renderCard({ dueDate: '2000-01-01T00:00:00.000Z' })
    expect(screen.getByText('Jan 1')).toBeInTheDocument()
    expect(screen.getByText(/overdue/i)).toBeInTheDocument()
  })

  it('shows a priority indicator only for non-none priorities', () => {
    const { rerender } = renderCard({ priority: 'high' })
    expect(screen.getByText('High')).toBeInTheDocument()

    rerender(<TaskCard task={{ ...baseTask, priority: 'none' }} onClick={() => {}} />)
    expect(screen.queryByText('High')).not.toBeInTheDocument()
  })

  it('ignores unknown legacy priority values safely', () => {
    renderCard({ priority: 'urgent' })
    expect(screen.queryByText('Urgent')).not.toBeInTheDocument()
    expect(document.querySelector('.bg-priority-urgent')).toBeNull()
  })
})
