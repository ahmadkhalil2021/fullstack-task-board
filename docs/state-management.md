# State Management Guide

## The Pattern: Flux

All UI components communicate with a single central store (`useBoardStore`). The store is the only place that talks to the API.

```
┌──────────┐  calls action  ┌──────────┐  calls API  ┌──────────┐
│   UI     │ ─────────────► │  Store   │ ──────────► │   API    │
│ (React)  │                │ (Zustand)│             │(fetch)   │
└────▲─────┘                └────┬─────┘             └────┬─────┘
     │                           │                        │
     │                           │                        │
     └───────────────────────────┴────────────────────────┘
                    state updates → re-render
```

## The Rule

> **UI knows the Store. Store knows the API. UI never knows the API.**

| Layer | Can call | Cannot call |
|-------|----------|-------------|
| **Component** | `useBoardStore` | `api.js`, `fetch` |
| **Store action** | `api.js` | `fetch` directly |
| **api.js** | `fetch` | `useBoardStore`, React |

## How to Add a New Feature

Suppose you want to add "rename board" functionality.

### 1. Add the API call (if not already there)

In `client/src/lib/api.js`:
```js
export const updateBoard = (boardId, data) =>
  request(`/boards/${boardId}`, { method: 'PUT', body: JSON.stringify(data) })
    .then((res) => res.data.board)
```

### 2. Add the store action

In `client/src/store/useBoardStore.js`:
```js
updateBoard: async (data) => {
  const board = get().board
  if (!board) return
  const updated = await api.updateBoard(board._id, data)
  set({ board: updated })
}
```

### 3. Use it from any component

In any `.jsx` file:
```js
const BoardHeader = () => {
  const updateBoard = useBoardStore(s => s.updateBoard)
  const name = useBoardStore(s => s.board?.name)

  const handleRename = (newName) => {
    updateBoard({ name: newName })
  }

  return <input value={name} onChange={e => handleRename(e.target.value)} />
}
```

## Reading State from Components

Always use a **selector** to pick what you need. This prevents unnecessary re-renders.

```js
// Bad: re-renders on every state change
const state = useBoardStore()

// Good: re-renders only when `board` changes
const board = useBoardStore(s => s.board)

// Even better: re-renders only when the task list length changes
const taskCount = useBoardStore(s => s.board?.tasks.length)
```

## Common Mistakes

| Mistake | Why it's wrong |
|---------|----------------|
| Calling `api.foo()` from a component | Bypasses the store. Other components won't update. |
| Storing derived values in state | Just compute them: `const count = board.tasks.length` |
| Calling `useBoardStore()` without a selector | Re-renders on every state change. Slow. |
| Multiple stores for one entity | Splits truth. Just use one store per entity. |

## When to Use Optimistic Updates

Per ADR-0005, update the store **first**, sync to API **second**. This makes the UI feel instant.

```js
// Pattern:
updateTask: async (taskId, data) => {
  const previousBoard = get().board           // 1. save current state
  set({                                       // 2. apply optimistically
    board: {
      ...previousBoard,
      tasks: previousBoard.tasks.map(t =>
        t._id === taskId ? { ...t, ...data } : t
      )
    }
  })
  try {
    const task = await api.updateTask(taskId, data)   // 3. sync to API
    set({ board: { ...get().board, tasks: get().board.tasks.map(t => t._id === taskId ? task : t) } })
  } catch (err) {
    set({ board: previousBoard })             // 4. rollback on error
    set({ error: err.message })
  }
}
```

## Related

- ADR-0001: Zustand for state management
- ADR-0005: Optimistic UI updates
- ADR-0008: Flux architecture pattern
- `client/src/store/useBoardStore.js` — the store
- `client/src/lib/api.js` — the API layer
