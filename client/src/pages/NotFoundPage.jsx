// NotFoundPage.jsx — Shown for any path that doesn't match a route
import { Link } from 'react-router-dom'

const NotFoundPage = () => {
  return (
    <div className="min-h-screen bg-surface-subtle text-surface-text flex flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-surface-text-muted">Page not found</p>
      <Link
        to="/"
        className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle transition-colors duration-200"
      >
        Go home
      </Link>
    </div>
  )
}

export default NotFoundPage
