// __tests__/board-header-persistence.test.jsx — Tests for board name/description persistence
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import * as api from '../lib/api.js'
import BoardHeader from '../components/BoardHeader.jsx'
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

beforeEach(() => {
  vi.clearAllMocks()
  useBoardStore.setState({ board: null, isLoading: false, error: null })
})

const getNameInput = () => screen.getByPlaceholderText('Board name')
const getDescriptionInput = () => screen.getByPlaceholderText('Add a description...')

describe('BoardHeader persistence', () => {
  it('renders empty drafts when no board is loaded', () => {
    render(<BoardHeader />)
    expect(getNameInput()).toHaveValue('')
    expect(getDescriptionInput()).toHaveValue('')
  })

  it('syncs drafts from the store when the board loads', () => {
    useBoardStore.setState({ board: { _id: 'b1', name: 'My Board', description: 'A description' } })
    render(<BoardHeader />)
    expect(getNameInput()).toHaveValue('My Board')
    expect(getDescriptionInput()).toHaveValue('A description')
  })

  it('saves the board name and description on blur', async () => {
    api.updateBoard.mockResolvedValue({ _id: 'b1', name: 'New Name', description: 'New desc' })
    useBoardStore.setState({ board: { _id: 'b1', name: 'Old Name', description: '' } })
    render(<BoardHeader />)

    fireEvent.change(getNameInput(), { target: { value: 'New Name' } })
    fireEvent.blur(getNameInput())

    await waitFor(() => {
      expect(api.updateBoard).toHaveBeenCalledWith('b1', { name: 'New Name', description: '' })
    })
  })

  it('rejects an empty name without calling the API', () => {
    useBoardStore.setState({ board: { _id: 'b1', name: 'Old Name', description: '' } })
    render(<BoardHeader />)

    fireEvent.change(getNameInput(), { target: { value: '   ' } })
    fireEvent.blur(getNameInput())

    expect(screen.getByText('Board name is required')).toBeInTheDocument()
    expect(api.updateBoard).not.toHaveBeenCalled()
  })

  it('reverts the draft to the saved name when blur is fired with empty value', () => {
    api.updateBoard.mockResolvedValue({ _id: 'b1', name: 'Original', description: '' })
    useBoardStore.setState({ board: { _id: 'b1', name: 'Original', description: '' }, isLoading: false, error: null })
    render(<BoardHeader />)

    fireEvent.change(getNameInput(), { target: { value: '' } })
    fireEvent.blur(getNameInput())

    expect(getNameInput()).toHaveValue('Original')
    expect(screen.getByRole('alert')).toHaveTextContent(/required/i)
    expect(api.updateBoard).not.toHaveBeenCalled()
  })

  it('surfaces a save error from the API', async () => {
    api.updateBoard.mockRejectedValue(new Error('Network error'))
    useBoardStore.setState({ board: { _id: 'b1', name: 'Old Name', description: '' } })
    render(<BoardHeader />)

    fireEvent.change(getNameInput(), { target: { value: 'New Name' } })
    fireEvent.blur(getNameInput())

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })

  it('does not call the API when drafts are unchanged', () => {
    useBoardStore.setState({ board: { _id: 'b1', name: 'My Board', description: 'A description' } })
    render(<BoardHeader />)

    fireEvent.blur(getNameInput())

    expect(api.updateBoard).not.toHaveBeenCalled()
  })
})
