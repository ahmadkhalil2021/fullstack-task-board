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
      <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col items-center justify-center gap-4">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button
          onClick={handleRetry}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col items-center justify-center gap-4">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-600 dark:text-gray-400">Creating your board…</p>
    </div>
  )
}

export default HomePage
