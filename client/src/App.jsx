// App.jsx — Top-level component that mounts the React Router
// All route definitions live here. Pages are rendered by the router.

import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import HomePage from './pages/HomePage.jsx'
import BoardPage from './pages/BoardPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'

// createBrowserRouter is the modern React Router v6 API.
// It enables data loading and other features down the line.
// Routes are matched top-to-bottom; first match wins.
const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/board/:boardId', element: <BoardPage /> },
  { path: '*', element: <NotFoundPage /> },
])

const App = () => {
  return <RouterProvider router={router} />
}

export default App
