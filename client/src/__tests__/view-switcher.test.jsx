// __tests__/view-switcher.test.jsx — Active state and link targets of the view switcher.

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ViewSwitcher from '../components/ViewSwitcher.jsx'

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/board/:boardId" element={<ViewSwitcher />} />
        <Route path="/board/:boardId/list" element={<ViewSwitcher />} />
        <Route path="/board/:boardId/grid" element={<ViewSwitcher />} />
        <Route path="/board/:boardId/table" element={<ViewSwitcher />} />
      </Routes>
    </MemoryRouter>
  )

describe('ViewSwitcher', () => {
  it('marks Kanban active at the board root', () => {
    renderAt('/board/b1')
    expect(screen.getByRole('link', { name: 'Kanban' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'List' })).not.toHaveAttribute('aria-current')
  })

  it('marks List active on the list route', () => {
    renderAt('/board/b1/list')
    expect(screen.getByRole('link', { name: 'List' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Kanban' })).not.toHaveAttribute('aria-current')
  })

  it('marks Grid active on the grid route', () => {
    renderAt('/board/b1/grid')
    expect(screen.getByRole('link', { name: 'Grid' })).toHaveAttribute('aria-current', 'page')
  })

  it('marks Table active on the table route', () => {
    renderAt('/board/b1/table')
    expect(screen.getByRole('link', { name: 'Table' })).toHaveAttribute('aria-current', 'page')
  })

  it('links to all four exact paths', () => {
    renderAt('/board/b1')
    expect(screen.getByRole('link', { name: 'Kanban' })).toHaveAttribute('href', '/board/b1')
    expect(screen.getByRole('link', { name: 'List' })).toHaveAttribute('href', '/board/b1/list')
    expect(screen.getByRole('link', { name: 'Grid' })).toHaveAttribute('href', '/board/b1/grid')
    expect(screen.getByRole('link', { name: 'Table' })).toHaveAttribute('href', '/board/b1/table')
  })

  it('preserves the query string in every link', () => {
    renderAt('/board/b1?q=docs&f=completed')
    expect(screen.getByRole('link', { name: 'Kanban' })).toHaveAttribute('href', '/board/b1?q=docs&f=completed')
    expect(screen.getByRole('link', { name: 'List' })).toHaveAttribute('href', '/board/b1/list?q=docs&f=completed')
    expect(screen.getByRole('link', { name: 'Grid' })).toHaveAttribute('href', '/board/b1/grid?q=docs&f=completed')
    expect(screen.getByRole('link', { name: 'Table' })).toHaveAttribute('href', '/board/b1/table?q=docs&f=completed')
  })

  it('exposes the switcher as a labelled navigation', () => {
    renderAt('/board/b1')
    expect(screen.getByRole('navigation', { name: 'Board view' })).toBeInTheDocument()
  })
})
