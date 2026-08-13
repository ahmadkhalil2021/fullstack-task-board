# Implementation Plan — GitHub Issue #8: Implement Add New Task functionality

**Status**: Implemented on feature branch (not yet merged)
**Component scope**: `client/src/components/AddTaskButton.jsx`, `Column.jsx`, `BoardPage.jsx`, `useBoardStore.js`
**Bug fix included**: `useBoardStore.addTask` was missing `parentBoardId` — deployment-blocking

---

## 1. Summary

Add an **"+ Add new task"** button at the bottom of the first column of the board. Clicking it creates a new task in `board.statuses[0]`, the new task appears at the top of that column, and the existing `TaskForm` modal opens with the name input focused and selected so the user can rename it immediately. The work also fixes a deployment-blocking bug in `useBoardStore.addTask`: the previous implementation called `api.createTask({ status })` but the server requires `parentBoardId` in the body (`server/routes/tasks.js:21-23`). All changes follow the Flux pattern (UI → Zustand Store → API), use optimistic updates with rollback, and reuse the established `TaskForm` component.

---

## 2. Architecture & Design Decisions

### Open Decisions — Recommendations

1. **Where does the button live?**
   **Recommendation**: Option A — at the bottom of the first column only.
   **Why**: Issue #8 scopes creation to "the first column". A per-column button (Option B) or floating button (Option C) expands scope and creates UX ambiguity. Placing it at the bottom of the first column follows the kanban convention (e.g., Trello's "Add a card") and clearly associates the action with the target column. It is rendered inside `Column.jsx` only when `BoardPage` provides an `onAddTask` callback.

2. **How does auto-focus for editing work?**
   **Recommendation**: Option A — reuse the existing `TaskForm` modal.
   **Why**: `TaskForm.jsx:49-52` already focuses and selects the name input on mount. Reusing it keeps the codebase DRY and consistent with Issue #9's conventions. The modal opens only after the API returns the real task, so the focused input edits the persisted task.

3. **What is the default task name?**
   **Recommendation**: `"New Task"`.
   **Why**: Matches the existing default in `useBoardStore.js:182` and `Task.js`. Because the modal opens immediately for editing, the default is only a transient placeholder.

4. **Position in column?**
   **Recommendation**: Top of the first column.
   **Why**: New backlog items are most visible at the top and match the "newest first" mental model. Implementation sets `newOrder = min(existing orders in column) - 1` (default `0` for empty columns) so it sorts first. Existing `reorderTasksInColumn` flow normalizes back to `0..n-1`.

5. **Where does the `parentBoardId` fix go?**
   **Recommendation**: In the store action `addTask`.
   **Why**: Per the Flux pattern, the store owns API calls and has access to `board._id`. Passing `parentBoardId` from a component would leak API contract details into the UI.

### Action Flow

1. User clicks the **+ Add new task** button at the bottom of column 1.
2. `BoardPage` (which owns the modal state) disables the button and calls `addTask(board.statuses[0])`.
3. `useBoardStore.addTask` saves `previousBoard`, creates an optimistic temp task with `order = min - 1`, appends it to `board.tasks`, and calls `api.createTask({ ..., parentBoardId: board._id })`.
4. API creates the task and returns the persisted task.
5. Store replaces the temp task with the real task and returns the real task.
6. `BoardPage` receives the real task and calls `setEditingTask(realTask)`.
7. `TaskForm` mounts, auto-focuses the name input, and selects the text.

---

## 3. State Machine / Flow

```
[Idle] ──click Add new task──> [Creating]
  ↑                               │
  │                               ▼
[Error] <────API failure──── [API in flight]
  │  (rollback board to previousBoard)
  │
  └──user can retry────────> [Idle]

[API in flight] ──success──> [Editing]
  │                            │
  │                            ▼
  │                    TaskForm modal open
  │                    name input focused
  │                            │
  │                            ▼
  │                    [Idle] after Save/Cancel
  └───API error────> [Error]
```

### Optimistic Update & Rollback

- On click, the store immediately appends a temp task into `board.tasks` with `_id = temp-${Date.now()}-${rand}`.
- If the API fails, `set({ board: previousBoard, error: err.message })` restores the previous state.
- The thrown error propagates to `BoardPage`, which keeps the modal closed and re-enables the button.

### Focus Management After Creation

- Focus is handled by `TaskForm.jsx:49-52` via `nameRef.current?.focus()` and `.select()` in a mount `useEffect`.
- `BoardPage` opens the modal only after the real task is returned, so `TaskForm` receives a stable persisted task.

---

## 4. API Contract

### `POST /api/tasks`

- **Path**: `/api/tasks`
- **Method**: `POST`
- **Required body fields**: `status`, `parentBoardId` (`server/routes/tasks.js:21-26`)
- **Optional body fields**: `name`, `description`, `icon`, `order`
- **Request body example**:
  ```json
  {
    "name": "New Task",
    "description": "",
    "icon": "⏰",
    "status": "Backlog",
    "order": -1,
    "parentBoardId": "64b2f1a..."
  }
  ```
- **Success response `201`**:
  ```json
  {
    "data": {
      "task": {
        "_id": "64b2f1e...",
        "name": "New Task",
        "description": "",
        "icon": "⏰",
        "status": "Backlog",
        "order": -1,
        "parentBoardId": "64b2f1a...",
        "createdAt": "...",
        "updatedAt": "..."
      }
    }
  }
  ```
- **Validation** (`server/routes/tasks.js:21-38`): requires `parentBoardId` and `status`, verifies the parent board exists, checks that `status` is in `board.statuses`, and (since the implementation) verifies that `order` is a finite number if provided.

### Server-side change included

`POST /api/tasks` now **accepts and persists `order`** (`server/routes/tasks.js:27-29,41`). The original implementation silently dropped `order`, which would have caused new tasks to default to `order: 0` and break the "appears at the top" requirement.

---

## 5. File Changes

**Modify**

- `client/src/store/useBoardStore.js` — Fix `addTask`: include `parentBoardId`, compute top `order`, return created task, throw when no board loaded.
- `client/src/components/Column.jsx` — Render `AddTaskButton` at the bottom when `onAddTask` prop provided; accept `isAddingTask` for disabled state.
- `client/src/pages/BoardPage.jsx` — Add `handleAddTask`, pass `onAddTask`/`isAddingTask` to the first `Column` only, guard against double clicks via `hasStarted` ref.
- `server/routes/tasks.js` — Accept and validate `order` in `POST /api/tasks`.
- `server/__tests__/tasks.test.js` — Add tests for `order` persistence and validation.
- `docs/api-contract.md` — Add the `POST /api/tasks` section.

**Create**

- `client/src/components/AddTaskButton.jsx` — Presentational dashed-border button.
- `client/src/__tests__/add-task.test.jsx` — 8 unit tests covering the full flow.

---

## 6. Implementation Steps

1. **Fix the store action.**
   - Edit `client/src/store/useBoardStore.js:165-217`.
   - Compute `newOrder` so the task sorts at the top of the target column.
   - Pass `parentBoardId: previousBoard._id` to `api.createTask`.
   - Return the persisted task from the action.

2. **Create the button component.**
   - Add `client/src/components/AddTaskButton.jsx`.
   - Accept `onClick` and `disabled` props.
   - Style with Tailwind as a full-width dashed button.

3. **Wire the button into the first column.**
   - Edit `client/src/components/Column.jsx`.
   - Accept optional `onAddTask` and `isAddingTask` props.
   - Render `<AddTaskButton ... />` after the task list only when `onAddTask` is defined.

4. **Connect the board page.**
   - Edit `client/src/pages/BoardPage.jsx`.
   - Add `isAddingTask` state and a `hasStarted` ref for double-click protection.
   - Implement `handleAddTask` that awaits `addTask(board.statuses[0])` and then calls `setEditingTask`.
   - Pass `onAddTask={handleAddTask}` and `isAddingTask={isAddingTask}` only to the first column (`index === 0`).

5. **Make the server accept `order`.**
   - Edit `server/routes/tasks.js:19,27-29,41` to parse and validate `order`.

6. **Document the API contract.**
   - Edit `docs/api-contract.md` and add the `POST /api/tasks` section.

7. **Add unit tests.**
   - Create `client/src/__tests__/add-task.test.jsx` with 8 tests.
   - Add 2 server tests in `server/__tests__/tasks.test.js`.

8. **Verify.**
   ```bash
   npm run test --workspace=client
   npm run test --workspace=server
   npm run lint --workspace=client
   npm test
   ```

---

## 7. Edge Cases & Error Handling

- **API failure → optimistic rollback**: `addTask` saves `previousBoard`, applies the optimistic update, and restores `previousBoard` on any API error. `BoardPage` catches the thrown error and does not open the modal. The store's `error` is displayed by the existing error UI in `BoardPage`.
- **Double click / rapid clicks**: `hasStarted` ref in `BoardPage` (mirroring the pattern from Issue #9) combined with `isAddingTask` state that disables the button. Return early from `handleAddTask` if already in flight.
- **User navigates away mid-creation**: Zustand `set` is safe regardless of mount state. `setEditingTask` on an unmounted component is harmless in React 18.
- **React StrictMode double invocation**: The `hasStarted` ref prevents the same handler from running twice concurrently. The ref is reset in `finally` after the async operation completes.
- **Modal dismissed without saving**: The persisted task keeps the default name. Acceptable; the user can reopen it via the task card.
- **Server validation error (missing `parentBoardId` / invalid `status` / non-numeric `order`)**: API returns `400 VALIDATION_ERROR`, store rolls back, `BoardPage` leaves the modal closed.
- **Empty first column**: `newOrder` defaults to `0` when no tasks exist in the column.
- **Temp ID collision**: Use `temp-${Date.now()}-${Math.random().toString(36).slice(2)}` to avoid collisions if two tasks are created in the same millisecond.

---

## 8. Testing Strategy

### Unit Tests (`client/src/__tests__/add-task.test.jsx`)

Mock `../lib/api.js` via `vi.mock`, reset the Zustand store in `beforeEach`.

1. **Button renders** in the first column with text "+ Add new task".
2. **Button does NOT render** in other columns (`getAllByText('+ Add new task')` returns exactly one element).
3. **Click creates a task** — `api.createTask` called with `parentBoardId` and `status: 'Backlog'`.
4. **Position in column** — `order = min(existing) - 1`, task appears first when sorted by `order`.
5. **Empty-column default** — `order = 0` when no tasks exist.
6. **Focus opens edit modal** — after click, `document.activeElement` is the name input.
7. **API error rolls back** — board task list length unchanged, `error` set, modal not open.
8. **Double-click guard** — `fireEvent.click()` twice with a never-resolving promise; `api.createTask` called exactly once.

### Server Tests (`server/__tests__/tasks.test.js`)

1. **Persists the `order` field** when provided in `POST /api/tasks`.
2. **Rejects non-numeric `order`** with `400 VALIDATION_ERROR`.

### Manual Test Checklist

1. Load a board. Verify the first column shows **+ Add new task**.
2. Verify the other columns do **not** show the button.
3. Click the button. A new task card appears at the top of the first column immediately.
4. After the API call, the `TaskForm` modal opens with the name field focused and selected.
5. Type a new name and save. The modal closes and the card shows the new name.
6. Close the modal without saving. The card remains with the default `"New Task"` name.
7. Throttle network to "Slow 3G" and click the button repeatedly. Only one API call is made and the button is disabled while loading.
8. Force `POST /api/tasks` to return `400`. The temp card disappears and the board returns to its previous state.

---

## 9. Acceptance Criteria

- [ ] An "+ Add new task" button is visible at the bottom of the first column only.
- [ ] Clicking the button creates a new task in the first column (`board.statuses[0]`).
- [ ] The new task appears at the top of the first column.
- [ ] After the task is persisted, the `TaskForm` modal opens with the task name auto-focused and selected.
- [ ] The task persists to MongoDB via `POST /api/tasks`.
- [ ] `useBoardStore.addTask` passes `parentBoardId` to `api.createTask`, fixing the deployment-blocking bug.
- [ ] Server accepts and persists the `order` field in `POST /api/tasks`.
- [ ] Optimistic update is applied immediately; API failure rolls back the store.
- [ ] Rapid clicks are guarded and do not create duplicate tasks.
- [ ] All unit tests (8 client + 2 server) pass.
- [ ] Linter passes.
- [ ] No component calls `api.js` or `fetch` directly; all API access goes through `useBoardStore`.

---

## 10. Out of Scope

- Inline editing of task names on the card.
- "Add new task" buttons on other columns or a floating board-level button.
- Drag-and-drop behavior for tasks that are still being created.
- Server-side normalization of `order` values across the board.
- Board name or description persistence (tracked in Issue #10).
- New a11y features (tracked separately as follow-ups).
- Dark mode improvements (existing Tailwind `dark:` classes are sufficient).
- Changes to the default board creation logic or column names.

---

## 11. Risks & Open Questions

### Risks

- **`order` field semantics**: The client now sends `order` (potentially negative) to the server. Supported by the Task model, but introduces negative values until a reorder normalizes them. **Mitigation**: verify sorting and reorder tests pass.
- **Modal race on temp cards**: If the user clicks the optimistic temp card before the API returns, they might open a modal for a temp ID that will soon be replaced. **Mitigation**: the modal opens only after API success, so this race is currently rare. Consider disabling `TaskCard` clicks for temp IDs as a follow-up.
- **Focus in tests**: `document.activeElement` checks can be flaky with StrictMode. **Mitigation**: use `@testing-library/user-event` and `waitFor`.

### Open Questions

- Should the new task be inserted at the top or the bottom of the first column? **Decision**: top (newest-first kanban convention).
- Should the default name be `"New Task"` or something else? **Decision**: `"New Task"` (matches existing defaults).