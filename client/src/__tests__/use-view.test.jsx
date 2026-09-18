// __tests__/use-view.test.jsx — Exact URL-to-view mapping of the useView hook.

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useView } from '../lib/useView.js'

const Probe = () => {
  const view = useView()
  return <span data-testid="view">{String(view)}</span>
}

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Probe />
    </MemoryRouter>
  )

describe('useView', () => {
  it.each([
    ['/board/b1', 'kanban'],
    ['/board/b1/list', 'list'],
    ['/board/b1/grid', 'grid'],
    ['/board/b1/table', 'table'],
  ])('maps %s to %s', (path, expected) => {
    renderAt(path)
    expect(screen.getByTestId('view')).toHaveTextContent(expected)
  })

  it.each([
    ['/board/b1/unknown'],
    ['/board/b1/task/t1'],
    ['/board/b1/list/extra'],
    ['/board'],
    ['/'],
  ])('returns null for %s', (path) => {
    renderAt(path)
    expect(screen.getByTestId('view')).toHaveTextContent('null')
  })
})
