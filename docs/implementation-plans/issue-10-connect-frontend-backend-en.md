# Implementation Plan: Issue #10 — Connect frontend to backend API

## Summary

Issue #10 closes the remaining gaps between the React frontend and the Express backend. The API wrapper (`client/src/lib/api.js`) and Zustand store actions (`useBoardStore.js`) already handle tasks and board fetching; the remaining work is to make the board name and description in `BoardHeader.jsx` persist via the existing `updateBoard` action, to make the API base URL configurable for production via a Vite environment variable, and to surface API errors visibly in the UI instead of leaving them as silent promise rejections.

## Architecture & Design Decisions

### 1. When should board name/description save? — **Option A: onBlur**

**Decision:** Persist the board name and description when the input loses focus (`onBlur`).

**Justification:**
- It is the simplest upgrade from the current local-state-only implementation in `BoardHeader.jsx`.
- It avoids introducing a debounce timer and extra cleanup logic.
- It creates a clear "commit" moment for the user, matching native form behavior.
- It minimizes API traffic compared with per-keystroke saves.

### 2. Production API base URL mechanism? — **Option A: `import.meta.env.VITE_API_URL`**

**Decision:** Read the API base URL from `import.meta.env.VITE_API_URL` and fall back to `/api`.

**Justification:**
- The project is built with Vite, so `import.meta.env.VITE_*` is the idiomatic convention.
- A fallback to `/api` preserves the current dev experience and supports Vercel same-origin rewrites without extra configuration.
- It allows developers to point the frontend at a different backend (e.g., a preview deployment or local server on a custom port) by changing only `.env`.

### 3. Error display UI? — **Option A: Banner at top of the board page**

**Decision:** Render a dismissible error banner at the top of `BoardPage.jsx` that reads `error` from the Zustand store.

**Justification:**
- The store already maintains an `error` string for every failed API call, so a banner reuses that single source of truth.
- It is accessible and does not require adding a toast library.
- It keeps errors visible until the user dismisses them or a subsequent successful action clears them.

### 4. Reset behavior on validation error? — **Option B: Keep user's text, show error**

**Decision:** On a failed save, keep the user's edited text in the input and display the error. Do not roll back the input value.

**Justification:**
- Preserving the user's text prevents data loss and lets them fix the problem (e.g., a too-long name) without retyping.
- The Zustand store still rolls back the *server-side* optimistic update, so the persisted model stays consistent.
- This separates the optimistic server state from the in-progress draft UI state.

## State Machine / Flow

```text
[User types in name/description input]
            |
            v
[Local draft state updates (draftName / draftDescription)]
            |
            v
[Input loses focus -> onBlur]
            |
            v
[Call useBoardStore.getState().updateBoard({ name, description })]
            |
            +---> [Optimistic update: board.name/board.description updated in store]
            |
            v
[PUT /api/boards/:boardId]
            |
            +---> Success: store replaced with server board (idempotent)
            |
            +---> Error: store rolled back to previousBoard, error state set
            |
            v
[BoardPage reads error state and renders banner]
            |
            v
[User dismisses banner -> clearError() action clears error state]
```

## API Contract

### `PUT /api/boards/:boardId`

**Method:** `PUT`

**Path:** `/api/boards/:boardId`

**Body:**

```json
{
  "name": "string | undefined",
  "description": "string | undefined"
}
```

**Validation rules (server-side):**
- At least one field must be provided (`name`, `description`, or `statuses`).
- `name` and `description` must be strings if provided.
- Empty strings are allowed (the UI treats them as "clear the value").

**Response (200 OK):**

```json
{
  "data": {
    "board": {
      "_id": "ObjectId",
      "name": "string",
      "description": "string",
      "statuses": ["string"],
      "tasks": [...]
    }
  }
}
```

**Error responses:**
- `400 Bad Request` — missing fields or validation failure.
- `404 Not Found` — board ID does not exist.
- `500 Internal Server Error` — database or unexpected server error.

## File Changes

- `client/src/lib/api.js`
  - Replace hardcoded `const BASE = '/api'` with environment-aware base URL.
- `client/src/store/useBoardStore.js`
  - Add `clearError` action to reset `error` state.
  - Ensure `updateBoard` normalizes partial updates correctly (already implemented).
- `client/src/components/BoardHeader.jsx`
  - Wire `onBlur` handlers to call `updateBoard`.
  - Keep local draft state for typing, but sync to store on blur.
- `client/src/pages/BoardPage.jsx`
  - Render error banner using `error` from store.
  - Provide dismiss button that calls `clearError`.
- `client/.env.example`
  - Add `VITE_API_URL=/api` as the default.
- `client/.env` (if tracked locally)
  - Add `VITE_API_URL=/api` for development.

## Implementation Steps

1. **Update API base URL**
   - In `client/src/lib/api.js`, change:
     ```js
     const BASE = '/api'
     ```
     to:
     ```js
     const BASE = import.meta.env.VITE_API_URL || '/api'
     ```

2. **Add `clearError` action to the store**
   - In `client/src/store/useBoardStore.js`, add:
     ```js
     clearError: () => set({ error: null }),
     ```

3. **Persist board header fields**
   - In `client/src/components/BoardHeader.jsx`:
     - Read `updateBoard` from `useBoardStore`.
     - Add an `onBlur` handler to each input that calls `updateBoard` with `{ name: draftName }` or `{ description: draftDescription }`.
     - Only call the API if the draft value differs from the current store value to avoid no-op requests.

4. **Display API errors**
   - In `client/src/pages/BoardPage.jsx`:
     - Read `error` from `useBoardStore`.
     - Render a banner when `error` is truthy.
     - Add a dismiss button calling `clearError`.

5. **Document environment variable**
   - Add `VITE_API_URL=/api` to `client/.env.example`.

6. **Manual smoke test**
   - Edit board name/description, blur, and verify network request and persisted reload.
   - Simulate an offline/error condition and verify banner appears.
   - Verify `VITE_API_URL` override works by pointing to a different port.

## Edge Cases & Error Handling

| Scenario | Behavior |
|---|---|
| **Network error / offline** | `updateBoard` catches the error, rolls back the store, sets `error`, and re-throws so the component can optionally react. Banner appears. |
| **Validation error (400)** | Server message displayed in banner. Input keeps user's text. Store rolled back. |
| **Race condition: two rapid edits** | Each `onBlur` triggers its own `updateBoard`. Because they target different fields or happen sequentially, the last successful response wins. The store replaces the whole board object, so eventual consistency is maintained. |
| **Concurrent edits by another user** | Last write wins on the server. The optimistic update may be overwritten by the next `fetchBoard`. Out of scope for real-time sync. |
| **Empty name/description** | Allowed. Server accepts empty strings. UI shows placeholder if value is empty. |
| **Board not found (404)** | Error banner shows "Board not found". Store rolled back. |

## Testing Strategy

### Unit tests

- `useBoardStore.updateBoard`:
  - Applies optimistic update immediately.
  - Calls `api.updateBoard` with correct payload.
  - Rolls back and sets error on failure.
- `api.js`:
  - Uses `import.meta.env.VITE_API_URL` when present.
  - Falls back to `/api` when variable is absent.

### Manual test checklist

- [ ] Change board name, press Tab/click outside → `PUT /api/boards/:boardId` fires with `{ name: "..." }`.
- [ ] Change description, blur → `PUT` fires with `{ description: "..." }`.
- [ ] Refresh page → changes are still present.
- [ ] Disconnect network, edit name, blur → error banner appears, input retains edited text.
- [ ] Dismiss banner → banner disappears.
- [ ] Set `VITE_API_URL=http://localhost:4000/api`, restart dev server → requests go to port 4000.

## Acceptance Criteria

- [ ] Editing the board name and description in `BoardHeader.jsx` persists after page reload.
- [ ] Persistence uses the existing `updateBoard` Zustand action and `PUT /api/boards/:boardId`.
- [ ] The API base URL is configurable via `VITE_API_URL` and defaults to `/api`.
- [ ] API errors are surfaced in the UI via a dismissible banner.
- [ ] Failed saves do not silently discard user input.
- [ ] No prop drilling: `BoardHeader` and `BoardPage` read directly from the Zustand store.
- [ ] No component calls `api.js` or `fetch` directly.

## Out of Scope

- Real-time collaboration or conflict resolution for concurrent edits.
- Validation rules beyond what the server already enforces.
- Inline field-level error messages (only global error banner).
- Debounced auto-save (future enhancement).
- Changing board statuses from the header (statuses are still managed elsewhere).

## Risks & Open Questions

| Risk | Mitigation |
|---|---|
| **Multiple rapid `onBlur` calls could create race conditions** | Acceptable because each call is independent and the server is the source of truth; if needed later, add request deduplication or a loading flag in `updateBoard`. |
| **Environment variable not set in production** | Fallback to `/api` ensures the app still works on Vercel with same-origin rewrites. |
| **Error banner may push layout** | Keep banner compact and absolutely positioned or with minimal height to reduce layout shift. |
| **Open question:** Should the header show a loading indicator while saving? | Not required for MVP; `updateBoard` is optimistic and fast. Can be added later if UX testing shows a need. |
