// EmptyBoard.jsx — Shown when no board is loaded yet
const EmptyBoard = ({ message = 'No board loaded' }) => {
  return (
    <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
      <p>{message}</p>
    </div>
  )
}

export default EmptyBoard
