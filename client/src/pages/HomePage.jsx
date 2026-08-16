// HomePage.jsx — Landing page at "/". Auto-creates a board and redirects.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBoardStore } from '../store/useBoardStore.js'

const HomePage = () => {
  const navigate = useNavigate()
  const createBoard = useBoardStore((s) => s.createBoard)
  const [status, setStatus] = useState('creating')
  const [error, setError] = useState(null)
  const hasStarted = useRef(false)
  const isMounted = useRef(true)

  const create = useCallback(async () => {
    if (hasStarted.current) return
    hasStarted.current = true
    setStatus('creating')
    setError(null)
    try {
      const boardId = await createBoard()
      if (!isMounted.current) return
      navigate(`/board/${boardId}`, { replace: true })
    } catch (err) {
      if (!isMounted.current) return
      setStatus('error')
      setError(err?.message || 'Could not create board. Please try again.')
    }
  }, [createBoard, navigate])

  useEffect(() => {
    // StrictMode re-runs effects in dev, so re-assert "mounted" here — otherwise
    // the simulated unmount would suppress the redirect once createBoard resolves.
    isMounted.current = true
    create()
    return () => {
      isMounted.current = false
    }
  }, [create])

  const handleRetry = () => {
    hasStarted.current = false
    create()
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-surface-subtle text-surface-text flex flex-col items-center justify-center gap-4 animate-fade-in">
        <h1 className="text-xl font-semibold">Couldn't create your board</h1>
        <p role="alert" className="text-danger-text">{error}</p>
        <button
          onClick={handleRetry}
          className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle transition-colors duration-200"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-subtle text-surface-text flex flex-col items-center justify-center gap-4 animate-fade-in">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      <p role="status" aria-live="polite" className="text-surface-text-muted">Creating your board…</p>
    </div>
  )
}

export default HomePage
