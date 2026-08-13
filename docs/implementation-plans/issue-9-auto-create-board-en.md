# Implementation Plan — Issue #9: Auto-create board on first visit

> **Status:** Implemented and merged in PR #15 (merge commit `0688eab`)  
> **Language:** English  
> **Related:** `docs/route-design.md`, `docs/state-management.md`, `docs/error-handling.md`

---

## 1. Summary

Issue #9 introduces a landing-page flow that automatically creates a new task board when a user visits the root path `/`. The `HomePage` component triggers the existing `createBoard` Zustand action on mount, waits for the backend to return the new board, and then redirects the browser to `/board/:boardId` using `replace: true`. If creation fails, the component surfaces the raw error message and offers a **Try again** button. The board state is stored in `useBoardStore`, so `BoardPage` does not need to re-fetch on arrival.

---

## 2. Architecture & Design Decisions

| Decision | Justification |
|----------|---------------|
| **Landing page at `/` creates the board** | Keeps the public URL simple (`/`) while still giving every visitor a unique board at `/board/:boardId`. Matches the product requirement "auto-creates a board on first visit". |
| **Redirect with `replace: true`** | Removes `/` from the browser history stack, so pressing *Back* from the board does not re-trigger creation. This was a locked-in decision. |
| **Flux pattern: component → store → API** | `HomePage` calls `useBoardStore.createBoard()`, which calls `api.createBoard()`. The UI never touches `fetch` directly, preserving the architecture rule from `docs/state-management.md`. |
| **Rely on Zustand store, no re-fetch in `BoardPage`** | `createBoard` stores the full board in the store. `BoardPage` reads `board` from the store on first render, avoiding a redundant `GET /api/boards/:boardId`. Locked-in decision. |
| **Local `status` + `error` state in `HomePage`** | The store already has `isLoading`/`error`, but a local state machine gives the page precise control over the `creating \| error` UI and retry logic without polluting global state. |
| **Raw `err.message` displayed to user** | Error-code mapping in `api.js` was declared out of scope for this issue. The fallback string is shown only when the error has no message. |

---

## 3. State Machine / Flow

`HomePage` tracks its own lifecycle with the following states:

```
┌──────┐   mount/useEffect   ┌───────────┐
│ idle │ ──────────────────► │ creating  │
└──────┘                     └─────┬─────┘
                                   │
              createBoard resolves │
                                   ▼
                    ┌──────────────────────┐
                    │       success        │ ──► navigate(`/board/${id}`, { replace: true })
                    └──────────────────────┘
                                   │
              createBoard rejects  │
                                   ▼
                              ┌─────────┐
                              │  error  │ ──► render error + "Try again" button
                              └────┬────┘
                                   │
              user clicks retry    │
              hasStarted = false   │
                                   ▼
                              ┌───────────┐
                              │ creating  │ (loop)
                              └───────────┘
```

*Notes:*
- `idle` is only the initial render instant; `useEffect` immediately transitions to `creating`.
- `success` is transient: the redirect unmounts the component before the user sees it.
- A `hasStarted` Ref guards against double invocation under React 18 StrictMode.

---

## 4. API Contract

### `POST /api/boards`

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/boards` |
| **Body** | `{}` (empty object — defaults are server-side) |
| **Response** | `201 Created`  
```json
{
  "data": {
    "board": {
      "_id": "...",
      "name": "My Task Board",
      "description": "",
      "statuses": ["Backlog", "Ready", "In progress", "In review", "Done"],
      "tasks": [ /* one default task per status */ ],
      "createdAt": "...",
      "updatedAt": "..."
    }
  }
}
``` |

**Implementation details from `server/routes/boards.js`:**
- Accepts optional `name`, `description`, and `statuses`.
- Validates `statuses` if provided.
- Creates one default task per status via `Task.insertMany`.
- Creates the board with the new task IDs.
- Re-fetches with `populate('tasks')` before returning the response.

---

## 5. File Changes

```
client/src/pages/HomePage.jsx                 # new — landing page + auto-create flow
client/src/__tests__/home-page.test.jsx       # new — 5 unit tests for HomePage
client/src/__tests__/routing.test.jsx         # updated — add route test for "/" redirect
client/src/App.jsx                            # updated — register HomePage at "/"
client/src/store/useBoardStore.js             # existing createBoard action reused
client/src/lib/api.js                         # existing createBoard() helper reused
server/routes/boards.js                       # existing POST /api/boards reused
server/models/Board.js                        # existing defaults reused
```

---

## 6. Implementation Steps

1. **Add the route in `client/src/App.jsx`.**
   - Register `{ path: '/', element: <HomePage /> }` as the first route.

2. **Create `client/src/pages/HomePage.jsx`.**
   - Import `useNavigate`, `useBoardStore`, and React hooks.
   - Initialize local state: `status = 'creating'`, `error = null`.
   - Add `hasStarted` Ref (`false`) and `isMounted` Ref (`true`).
   - Define `create` callback:
     - Guard with `hasStarted.current`.
     - Set status to `'creating'` and clear error.
     - Call `createBoard()` from the store.
     - On success, check `isMounted.current`, then `navigate(`/board/${boardId}`, { replace: true })`.
     - On failure, check `isMounted.current`, then set `status = 'error'` and `error = err?.message \|\| fallback`.
   - In `useEffect`:
     - Re-assert `isMounted.current = true` (required for React 18 StrictMode; see deviation note below).
     - Call `create()`.
     - Cleanup sets `isMounted.current = false`.
   - Render:
     - `status === 'error'`: error message + **Try again** button.
     - Otherwise: spinner + "Creating your board…".

3. **Wire up the store action.**
   - `useBoardStore.createBoard` already calls `api.createBoard({})` and stores the board.
   - No changes needed to `client/src/store/useBoardStore.js`.

4. **Verify the backend endpoint.**
   - `POST /api/boards` already exists and returns the populated board.
   - No changes needed to `server/routes/boards.js` or `server/models/Board.js`.

5. **Add unit tests in `client/src/__tests__/home-page.test.jsx`.**
   - Mock `react-router-dom/useNavigate`.
   - Mock `../lib/api.js`.
   - Reset the Zustand store before each test.
   - Cover: loading state, success redirect, error UI, retry, StrictMode single creation.

6. **Update `client/src/__tests__/routing.test.jsx`.**
   - Add a test that visits `/`, mocks `createBoard`, and asserts that `BoardPage` renders with the new board name.

---

## 7. Edge Cases & Error Handling

| Edge Case | Handling |
|-----------|----------|
| **Network failure / server error** | `createBoard` throws; `HomePage` catches, sets `status = 'error'`, displays `err.message`, and shows a retry button. |
| **React 18 StrictMode double mount** | `hasStarted` Ref ensures `createBoard` is invoked exactly once even when the effect runs twice in development. |
| **Component unmount during request** | `isMounted` Ref is checked before `navigate` and before `setState`, preventing updates on an unmounted component. |
| **StrictMode simulated unmount/remount** | `isMounted.current = true` is re-asserted at the top of the effect. Without this, the cleanup from the simulated unmount would leave `isMounted = false` and suppress the redirect when the second setup resolves. **This is a documented implementation deviation.** |
| **User presses browser Back from board** | `replace: true` removes `/` from history, so Back lands on whatever page was visited before the app (or the browser's default). No duplicate board is created. |
| **Retry after failure** | `handleRetry` resets `hasStarted.current = false` and calls `create()` again, allowing a new request. |

---

## 8. Testing Strategy

### New unit tests: `client/src/__tests__/home-page.test.jsx`

1. **Loading state** — while `createBoard` is pending, the spinner text "Creating your board…" is visible.
2. **Success redirect** — when `createBoard` resolves, `navigate('/board/board-123', { replace: true })` is called.
3. **Error UI** — when `createBoard` rejects with `new Error('Board creation failed')`, the message and a **Try again** button appear.
4. **Retry flow** — clicking **Try again** calls `createBoard` a second time and redirects to the new board.
5. **StrictMode single creation** — rendering inside `<StrictMode>` still calls `createBoard` exactly once and redirects.

### Updated routing test: `client/src/__tests__/routing.test.jsx`

6. **`/` renders `HomePage` and redirects to the new board** — mock `createBoard` to return a board, render at `/`, and assert the board name appears (proving the redirect and store update worked).

---

## 9. Acceptance Criteria

- [ ] Visiting `/` creates a new board automatically.
- [ ] On success, the browser is redirected to `/board/:boardId`.
- [ ] The root path `/` is replaced in history (`replace: true`).
- [ ] `BoardPage` renders the new board without an additional network request.
- [ ] On failure, an error message and a **Try again** button are shown.
- [ ] Clicking **Try again** re-attempts board creation.
- [ ] Under React 18 StrictMode, only one board is created.
- [ ] All 6 tests pass.

---

## 10. Out of Scope

- **Error-code mapping / translation in `api.js`** — raw `err.message` is shown.
- **Optimistic UI for board creation** — the page shows a spinner until the API responds; no fake board is rendered.
- **Offline queue / retry-on-reconnect** — retry is manual only.
- **Rate-limit handling** — 429 responses surface as generic errors.
- **Analytics / logging** — no events are emitted.

---

## 11. Risks & Open Questions

| Risk | Mitigation / Note |
|------|-------------------|
| **StrictMode guard complexity** | The combination of `hasStarted` + `isMounted` Refs is correct for development, but future developers may find it non-obvious. The inline comment explains *why* it is needed. |
| **History replacement hides the landing page** | Users cannot return to `/` via Back. This is intentional, but it assumes `/board/:boardId` is the primary destination. |
| **Store vs. re-fetch assumption** | If `BoardPage` later decides to always re-fetch, the redirect flow still works but the optimization becomes redundant. |
| **Raw error messages** | Server messages are shown unchanged; if they are too technical, UX suffers. Mapping them to friendly text is tracked separately. |
| **Duplicate boards on rapid revisits** | Each visit to `/` creates a board. There is no "first visit" detection (e.g., localStorage) by design. |
