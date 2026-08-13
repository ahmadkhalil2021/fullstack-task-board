// __tests__/status-manager.test.jsx — Tests for the status manager modal
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as api from '../lib/api.js'
import StatusManager from '../components/StatusManager.jsx'
import { useBoardStore } from '../store/useBoardStore.js'

vi.mock('../lib/api.js', () => ({
  fetchBoard: vi.fn(),
  createBoard: vi.fn(),
  updateBoard: vi.fn(),
  updateTask: vi.fn(),
  updateTaskOrder: vi.fn(),
  deleteTask: vi.fn(),
  createTask: vi.fn(),
}))

const DEFAULTS = ['Backlog', 'In Progress', 'Completed', "Won't do", 'Blocked']

const makeBoard = (overrides = {}) => ({
  _id: 'b1',
  name: 'Test Board',
  statuses: [...DEFAULTS],
  tasks: [],
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  useBoardStore.setState({ board: null, isLoading: false, error: null })
})

describe('StatusManager', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<StatusManager isOpen={false} onClose={() => {}} />)
    expect(container.firstChild).toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('lists current statuses on open', () => {
    useBoardStore.setState({ board: makeBoard() })
    render(<StatusManager isOpen onClose={() => {}} />)

    expect(screen.getByRole('heading', { name: 'Manage statuses' })).toBeInTheDocument()
    for (const status of DEFAULTS) {
      expect(screen.getByRole('button', { name: status })).toBeInTheDocument()
    }
  })

  it('add status appends a new editable row', async () => {
    const user = userEvent.setup()
    useBoardStore.setState({ board: makeBoard() })
    render(<StatusManager isOpen onClose={() => {}} />)

    await user.click(screen.getByRole('button', { name: '+ Add status' }))

    const input = screen.getByDisplayValue('New status')
    expect(input).toBeInTheDocument()
    expect(input.tagName).toBe('INPUT')
  })

  it('generates unique default names when adding multiple statuses', async () => {
    const user = userEvent.setup()
    useBoardStore.setState({ board: makeBoard() })
    render(<StatusManager isOpen onClose={() => {}} />)

    await user.click(screen.getByRole('button', { name: '+ Add status' }))
    await user.click(screen.getByRole('button', { name: '+ Add status' }))

    expect(screen.getByDisplayValue('New status 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New status' })).toBeInTheDocument()
  })

  it('rename via inline edit commits the new name on blur', async () => {
    const user = userEvent.setup()
    useBoardStore.setState({ board: makeBoard() })
    render(<StatusManager isOpen onClose={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'In Progress' }))
    const input = screen.getByDisplayValue('In Progress')
    await user.clear(input)
    await user.type(input, 'Doing')
    await user.tab()

    expect(screen.getByRole('button', { name: 'Doing' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'In Progress' })).not.toBeInTheDocument()
  })

  it('Escape during inline edit cancels the edit but keeps the modal open', async () => {
    const user = userEvent.setup()
    useBoardStore.setState({ board: makeBoard() })
    const onClose = vi.fn()
    render(<StatusManager isOpen onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'In Progress' }))
    const input = screen.getByDisplayValue('In Progress')
    await user.type(input, '{Escape}')

    expect(screen.getByRole('button', { name: 'In Progress' })).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('cannot remove a status with tasks', () => {
    useBoardStore.setState({
      board: makeBoard({
        tasks: [{ _id: 't1', name: 'Task', status: 'In Progress', order: 0 }],
      }),
    })
    render(<StatusManager isOpen onClose={() => {}} />)

    const trash = screen.getByRole('button', { name: 'Remove status: In Progress' })
    expect(trash).toBeDisabled()
    expect(trash).toHaveAttribute('title', 'Cannot remove: 1 task(s) in this status')
    expect(screen.getByText('1 task')).toBeInTheDocument()
  })

  it('keeps a status non-removable after rename when it still has tasks', async () => {
    const user = userEvent.setup()
    useBoardStore.setState({
      board: makeBoard({
        tasks: [{ _id: 't1', name: 'Task', status: 'In Progress', order: 0 }],
      }),
    })
    render(<StatusManager isOpen onClose={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'In Progress' }))
    const input = screen.getByDisplayValue('In Progress')
    await user.clear(input)
    await user.type(input, 'Doing')
    await user.tab()

    const trash = screen.getByRole('button', { name: 'Remove status: Doing' })
    expect(trash).toBeDisabled()
    expect(trash).toHaveAttribute('title', 'Cannot remove: 1 task(s) in this status')
    expect(screen.getByText('1 task')).toBeInTheDocument()
  })

  it('cannot remove the last status', () => {
    useBoardStore.setState({ board: makeBoard({ statuses: ['Only Status'] }) })
    render(<StatusManager isOpen onClose={() => {}} />)

    const trash = screen.getByRole('button', { name: 'Remove status: Only Status' })
    expect(trash).toBeDisabled()
    expect(trash).toHaveAttribute('title', 'Cannot remove the last status')
  })

  it('removes a status after confirmation', async () => {
    const user = userEvent.setup()
    useBoardStore.setState({ board: makeBoard() })
    render(<StatusManager isOpen onClose={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Remove status: Backlog' }))
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove' }))

    expect(screen.queryByRole('button', { name: 'Backlog' })).not.toBeInTheDocument()
  })

  it('reverts an empty status name on inline edit', async () => {
    const user = userEvent.setup()
    useBoardStore.setState({ board: makeBoard() })
    render(<StatusManager isOpen onClose={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'In Progress' }))
    const input = screen.getByDisplayValue('In Progress')
    await user.clear(input)
    await user.tab()

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'In Progress' })).toBeInTheDocument()
    expect(api.updateBoard).not.toHaveBeenCalled()
  })

  it('rejects a duplicate status name on inline edit', async () => {
    const user = userEvent.setup()
    useBoardStore.setState({ board: makeBoard() })
    render(<StatusManager isOpen onClose={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'In Progress' }))
    const input = screen.getByDisplayValue('In Progress')
    await user.clear(input)
    await user.type(input, 'Backlog')
    await user.tab()

    expect(screen.getByText('Status names must be unique')).toBeInTheDocument()
    expect(screen.getByDisplayValue('In Progress')).toBeInTheDocument()
    expect(api.updateBoard).not.toHaveBeenCalled()
  })

  it('saves the statuses via updateBoard', async () => {
    const user = userEvent.setup()
    const expected = [...DEFAULTS, 'In Review']
    api.updateBoard.mockResolvedValue({ _id: 'b1', statuses: expected, tasks: [] })
    useBoardStore.setState({ board: makeBoard() })
    render(<StatusManager isOpen onClose={() => {}} />)

    await user.click(screen.getByRole('button', { name: '+ Add status' }))
    const input = screen.getByDisplayValue('New status')
    await user.clear(input)
    await user.type(input, 'In Review')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(api.updateBoard).toHaveBeenCalledWith('b1', { statuses: expected })
    })
  })

  it('rolls the draft back when the save fails', async () => {
    const user = userEvent.setup()
    api.updateBoard.mockRejectedValue(new Error('Network error'))
    useBoardStore.setState({ board: makeBoard() })
    render(<StatusManager isOpen onClose={() => {}} />)

    await user.click(screen.getByRole('button', { name: '+ Add status' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(api.updateBoard).toHaveBeenCalled()
    })
    // The added status is gone from the draft; originals are restored.
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'New status' })).not.toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Backlog' })).toBeInTheDocument()
  })

  it('does not close the modal when the backdrop is clicked during remove confirmation', async () => {
    const user = userEvent.setup()
    useBoardStore.setState({ board: makeBoard() })
    const onClose = vi.fn()
    render(<StatusManager isOpen onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'Remove status: Backlog' }))
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('dialog'))

    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()
  })
})
