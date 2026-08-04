// BoardPage.jsx — Board view at "/board/:boardId"
// Issue #5: reads boardId from params and renders a placeholder.
// Issue #6 will replace this with the actual board UI.

import { useParams } from 'react-router-dom'

const BoardPage = () => {
  const { boardId } = useParams()

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-8">
      <h1 className="text-2xl font-bold">Board</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">ID: {boardId}</p>
    </div>
  )
}

export default BoardPage
