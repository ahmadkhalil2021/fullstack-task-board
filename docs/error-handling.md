# Error Handling Strategy

## Principles
1. **Errors don't crash the UI** — every async operation has error handling
2. **User sees what happened** — error messages are human-readable, not raw stack traces
3. **Optimistic rollback** — if an optimistic update fails, the previous state is restored

## Layers

### 1. Backend: Express Error Responses

All errors follow the shape defined in `api-contract.md`:
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Human-readable description"
  }
}
```

**Implementation: custom error class + middleware**
- Custom `AppError` class with `statusCode` and `code`
- Express error-handling middleware at the end of the middleware chain
- Mongoose validation errors → `VALIDATION_ERROR` (400)
- CastError (invalid ObjectId) → `NOT_FOUND` (404)
- Everything else → `INTERNAL_ERROR` (500)

### 2. Frontend: API Layer (`client/src/lib/api.js`)

- Thin wrapper around `fetch`
- Throws typed errors with `code` and `message` from the response body
- Network errors (fetch itself fails) → throw with code `NETWORK_ERROR`

```js
// Example
const res = await fetch(`/api/boards/${boardId}`)
if (!res.ok) {
  const { error } = await res.json()
  throw new ApiError(error.code, error.message)
}
return (await res.json()).data
```

### 3. Frontend: Zustand Store

Each mutating action follows this pattern:
```js
updateTask: async (taskId, data) => {
  const previousBoard = get().board        // 1. Save previous state
  set({ board: applyOptimisticUpdate(...) }) // 2. Apply optimistically
  try {
    await api.updateTask(taskId, data)     // 3. Sync to backend
  } catch (err) {
    set({ board: previousBoard })          // 4. Rollback on failure
    set({ error: err.message })            // 5. Surface error to UI
  }
}
```

### 4. Frontend: Components

- `error` slice from Zustand → shown as a toast/banner, auto-dismisses after 5 seconds
- Loading states: `isLoading` slice → shows skeleton UI during initial fetch
- Not-found states: board is `null` after failed fetch → shows "Board not found" message

## Error Code Mapping

| Backend Code | User-Facing Message |
|-------------|-------------------|
| `NOT_FOUND` | "Board not found" / "Task not found" |
| `VALIDATION_ERROR` | The server message directly (describes what's wrong) |
| `NETWORK_ERROR` | "Connection lost. Check your internet." |
| `INTERNAL_ERROR` | "Something went wrong. Please try again." |

## What We Don't Handle (Out of Scope)
- Sentry/error reporting services
- Retry logic for failed requests
- Offline queue (save edits while offline, sync when back online)
- Rate limiting errors (429)
