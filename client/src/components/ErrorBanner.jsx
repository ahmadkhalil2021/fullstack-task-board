// ErrorBanner.jsx — Global error banner reading the store's error state.
// Shared by the board shell and the task detail page.

import { useBoardStore } from '../store/useBoardStore.js'

const ErrorBanner = () => {
  const error = useBoardStore(s => s.error)
  const clearError = useBoardStore(s => s.clearError)

  if (!error) return null

  return (
    <div role="alert" className="bg-danger-muted border-b border-danger-muted-strong text-danger-text">
      <div className="flex items-center justify-between px-6 py-3">
        <p>{error}</p>
        <button
          onClick={clearError}
          aria-label="Dismiss error"
          className="min-h-[44px] min-w-[44px] p-3 flex items-center justify-center rounded hover:bg-danger-muted-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle transition-colors duration-200"
        >
          ×
        </button>
      </div>
    </div>
  )
}

export default ErrorBanner
