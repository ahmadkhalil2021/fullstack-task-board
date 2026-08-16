# Implementation Plan — Issue #21: Add Board Activity Feed

## 1. Summary

Add a persisted, board-scoped activity feed that records chronological events for task and board mutations. The feed is exposed via a new `GET /api/boards/:boardId/activity` endpoint, stored in a new MongoDB `activities` collection, and rendered as a right-edge slide-in sidebar toggled from `BoardHeader`. Live updates are delivered through optimistic appends in the existing Zustand store so the UI feels instant without websockets.

---

## 2. Architecture & Design Decisions

| # | Decision | Recommended Option | Justification |
|---|----------|-------------------|---------------|
| 1 | Event emission strategy | **A — Backend emits internally inside each route handler** | Keeps the API surface minimal, guarantees audit events are captured regardless of client, and follows the existing API-first / Flux pattern. The frontend never calls a separate activity creation endpoint. |
| 2 | Shape of `changes` | **A — `old` / `new` pair per modified field** | e.g. `{ name: { from: 'X', to: 'Y' } }`. This gives users meaningful context ("what changed?") without storing full snapshots. |
| 3 | Container pattern | **Sidebar** | Preserves board context, matches the issue wording, and is easier to animate than a modal. |
| 4 | Sidebar position | **A — Right edge** | Standard pattern for detail / history panels; least disruptive to the Kanban layout. |
| 5 | Live-update mechanism | **A — Optimistic append in Zustand after each user action** | Consistent with ADR-0005. No polling, no websockets. The store appends a local activity object immediately; the next background API call silently persists it on the server. |
| 6 | Limit defaults | **Default `limit=50`, max `limit=200`, cursor-based pagination via `before` (last `_id`)** | `ObjectId` is monotonic in time, so `_id` is a stable cursor. Prevents duplicates if new events arrive while paginating. "Load more" fetches the next 50 older events. |
| 7 | Relative time library | **A — Manual implementation with `Intl.RelativeTimeFormat`** | Avoids a dependency for one formatter. A small utility (`formatRelativeTime`) covers seconds/minutes/hours/days/months/years and updates via a 60-second re-render trigger in `ActivityFeed`. |
| 8 | State location | **A — New slice in `useBoardStore`** | Keeps the board as the single source of truth and follows the existing 1-store-per-entity rule. Avoids cross-store synchronization. |
| 9 | Cascade-delete on board delete | **Yes — mirror the existing `Board.pre('deleteOne')` hook** | Add `await Activity.deleteMany({ boardId: this._id })` to the same hook that already deletes tasks. Documented as a known pattern. |
| 10 | Initial load timing | **A — On `BoardPage` mount** | The board is already fetched on mount; fetching activity in parallel keeps the first sidebar toggle instant. If analytics later show the feed is rarely opened, lazy loading is a cheap optimization. |

---

## 3. State Machine / Flow

### 3.1 Server-side activity emit flow

```
User request → route handler
                │
                ▼
        Perform primary DB write
        (task/board update/create/delete)
                │
                ▼
        Compare old vs new document
        (when needed for updates)
                │
                ▼
        Build activity payload
        { boardId, type, taskId?, taskName?, changes }
                │
                ▼
        await Activity.create(payload)
        wrapped in try/catch so a failure
        does NOT fail the user's request
                │
                ▼
        Return original response
```

### 3.2 Client-side sidebar flow

```
BoardPage mounts
   ├─ fetchBoard(boardId)
   └─ fetchActivity(boardId) ──► GET /api/boards/:boardId/activity?limit=50
                                       │
                                       ▼
                              store.activity populated
                                       │
User clicks activity icon in BoardHeader
                                       │
                                       ▼
                        setIsActivityOpen(true)
                                       │
                                       ▼
                        <ActivityFeed> renders slide-in sidebar
                        reads activity[] from useBoardStore
                                       │
User mutates a task/board ─────────────┘
   ├─ store action updates board optimistically
   └─ store action appends matching activity object optimistically
        API call persists mutation + server emits real activity
        (server is source of truth; client just renders)
```

---

## 4. API Contract

### `GET /api/boards/:boardId/activity`

| Aspect | Detail |
|--------|--------|
| Method | `GET` |
| Path | `/api/boards/:boardId/activity` |
| Query params | `limit` (number, optional, default `50`, max `200`)<br>`before` (ObjectId string, optional, cursor for pagination) |
| Success response | `200 OK`<br>`{ data: { activities: Activity[], hasMore: boolean } }` |
| Error responses | `400 Bad Request` — invalid `limit` or malformed `before`<br>`404 Not Found` — board does not exist<br>`500 Internal Server Error` — database error |
| Sort order | Newest first (`{ _id: -1 }`) |

### `Activity` JSON shape

```json
{
  "_id": "507f1f77bcf86cd799439011",
  "boardId": "507f1f77bcf86cd799439010",
  "type": "task_moved",
  "taskId": "507f1f77bcf86cd799439012",
  "taskName": "Fix login bug",
  "changes": {
    "status": { "from": "In progress", "to": "In review" }
  },
  "createdAt": "2026-08-13T10:00:00.000Z"
}
```

#### Supported `type` values

- `task_created`
- `task_updated`
- `task_moved`
- `task_deleted`
- `board_updated`
- `status_added`
- `status_renamed`
- `status_removed`

---

## 5. File Changes

### Create

| File | Purpose |
|------|---------|
| `server/models/Activity.js` | Mongoose schema + model for persisted activity events |
| `server/lib/activityEmitter.js` | Thin helper to build and insert activity documents from route handlers |
| `server/routes/activity.js` | `GET /api/boards/:boardId/activity` route (mounted under `/boards`) |
| `client/src/components/ActivityFeed.jsx` | Right-edge slide-in sidebar component |
| `client/src/lib/formatRelativeTime.js` | Relative time formatter using `Intl.RelativeTimeFormat` |

### Modify

| File | Purpose |
|------|---------|
| `server/models/Board.js` | Extend `pre('deleteOne')` hook to cascade-delete activities |
| `server/routes/boards.js` | Emit `board_updated`, `status_added`, `status_renamed`, `status_removed` after `PUT` |
| `server/routes/tasks.js` | Emit `task_created`, `task_updated`, `task_moved`, `task_deleted` after mutations |
| `server/index.js` | Import and mount the new activity route |
| `client/src/lib/api.js` | Add `fetchActivity(boardId, { limit, before })` |
| `client/src/store/useBoardStore.js` | Add activity slice + `fetchActivity` / `addOptimisticActivity` actions |
| `client/src/components/BoardHeader.jsx` | Add activity feed toggle button + sidebar render |

---

## 6. Implementation Steps

### Step 1 — Model + persistence helpers

1. Create `server/models/Activity.js` with schema:
   - `boardId: ObjectId, ref: 'Board', required, index`
   - `type: String, enum`
   - `taskId: ObjectId, ref: 'Task'` (optional)
   - `taskName: String` (optional snapshot for deleted tasks)
   - `changes: mongoose.Schema.Types.Mixed` (optional)
   - `timestamps: true` (provides `createdAt`)
2. Create `server/lib/activityEmitter.js` exporting:
   - `emitActivity(payload)` — wraps `Activity.create` in try/catch and logs failures without throwing.
3. Update `server/models/Board.js` `pre('deleteOne')` hook to also delete activities for the board.

### Step 2 — Backend routes

1. Create `server/routes/activity.js` implementing `GET /api/boards/:boardId/activity`:
   - Validate `boardId` and board existence.
   - Parse `limit` (clamp 1–200, default 50).
   - Parse optional `before` cursor.
   - Query `Activity.find({ boardId, _id: { $lt: before } }).sort({ _id: -1 }).limit(limit + 1)`.
   - Return `{ data: { activities, hasMore } }`.
2. Modify `server/routes/boards.js` `PUT /:boardId`:
   - Load the existing board document before updating.
   - After `findByIdAndUpdate`, compare old vs new `name`, `description`, and `statuses`.
   - Emit one `board_updated` event per changed scalar field.
   - Emit `status_added`, `status_renamed`, and `status_removed` events by diffing the `statuses` arrays.
3. Modify `server/routes/tasks.js`:
   - `POST /` → emit `task_created`.
   - `PUT /:taskId` → load old task, apply update, then emit `task_moved` if `status` changed or `task_updated` for other field changes (or both).
   - `DELETE /:taskId` → capture `taskName`, delete, then emit `task_deleted`.
4. Mount `server/routes/activity.js` in `server/index.js`.

### Step 3 — API layer

1. Add `fetchActivity(boardId, { limit = 50, before } = {})` to `client/src/lib/api.js`.

### Step 4 — Store slice

1. Extend `useBoardStore` state:
   - `activity: []`
   - `activityLoading: false`
   - `activityError: null`
   - `activityHasMore: true`
2. Add actions:
   - `fetchActivity(boardId, { limit, before })` — replaces or appends based on `before`.
   - `addOptimisticActivity(activity)` — prepends a client-side activity object.
   - `clearActivityError()`.
3. Wire optimistic appends into existing actions (`updateTask`, `deleteTask`, `addTask`, `updateBoard`) so that each mutation also produces a matching local activity object.

### Step 5 — UI components

1. Create `client/src/components/ActivityFeed.jsx`:
   - Accepts `isOpen` and `onClose` props.
   - Reads `activity`, `activityLoading`, `activityError`, `activityHasMore` from store.
   - Renders a fixed right-side panel that slides in via Tailwind transform utilities.
   - Lists activity items with icons per type, description text, and relative timestamp.
   - Shows skeleton rows while loading and an empty state when `activity.length === 0`.
   - Implements "Load more" using `before` cursor.
   - Re-renders timestamps once per minute via `setInterval`.
2. Create `client/src/lib/formatRelativeTime.js`.
3. Modify `client/src/components/BoardHeader.jsx`:
   - Add activity toggle button next to the status-manager gear.
   - Manage `isActivityOpen` local state.
   - Render `<ActivityFeed isOpen={isActivityOpen} onClose={...} />`.

---

## 7. Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| Network failure on initial activity load | Store sets `activityError`. `ActivityFeed` displays a retry button that re-calls `fetchActivity`. |
| Empty activity feed | Show friendly empty state illustration / text: "No activity yet — make a move!" |
| Navigation away while sidebar is open | Sidebar is unmounted with the route. Next board fetch resets `activity` in store. |
| Board deleted | Existing `pre('deleteOne')` hook now also deletes activities, avoiding orphaned documents. |
| Activity insert fails on server | Wrapped in try/catch; user action still succeeds. Failure is logged server-side. |
| Invalid `limit` / `before` query | API returns `400` with clear message. Client clamps `limit` before sending. |
| Activity event for a deleted task | `taskName` snapshot is stored on `task_deleted`; older task events keep `taskId` but no join is required. |
| Status rename vs add/remove ambiguity | Diff algorithm treats same-index changes as renames, appended items as added, removed items as removed. Document the heuristic. |
| Very long activity list | Cursor pagination (`before`) keeps queries fast; max `limit=200` prevents huge payloads. |
| Rapid successive actions | Optimistic appends are cheap and order-preserving because `_id` is generated at append time; server events will match order for a single client. |

---

## 8. Testing Strategy

### Server

1. **Model test** — `Activity` validates required `boardId` and `type` enum.
2. **Endpoint test** — `GET /api/boards/:boardId/activity`:
   - Returns activities newest-first.
   - Respects `limit` and `before`.
   - Returns `404` for unknown board.
3. **Route integration tests** — after each mutation endpoint, assert the expected activity document exists in the database:
   - `POST /api/tasks` → `task_created`
   - `PUT /api/tasks/:id` (status change) → `task_moved`
   - `PUT /api/tasks/:id` (name change) → `task_updated`
   - `DELETE /api/tasks/:id` → `task_deleted` with `taskName`
   - `PUT /api/boards/:id` (name/description) → `board_updated`
   - `PUT /api/boards/:id` (statuses) → status events
   - `DELETE /api/boards/:id` → activities removed

### Client

1. **Store tests** — `addOptimisticActivity` prepends to `activity`; `fetchActivity` appends and sets `activityHasMore`.
2. **Component tests** — `ActivityFeed`:
   - Renders skeleton when `activityLoading` is true and `activity` is empty.
   - Renders empty state when no activities.
   - Renders list items with correct descriptions.
   - Calls `fetchActivity` with `before` cursor on "Load more".
3. **Integration test** — Triggering `updateTask` updates the board and appends a matching activity object.

---

## 9. Acceptance Criteria

- [ ] New `Activity` Mongoose model exists with the required schema and indexes.
- [ ] `GET /api/boards/:boardId/activity?limit=N` returns a paginated list of activity events newest-first.
- [ ] Task create/update/move/delete endpoints each emit the correct activity type.
- [ ] Board update endpoint emits `board_updated`, `status_added`, `status_renamed`, and/or `status_removed` as appropriate.
- [ ] Deleting a board deletes all of its activity documents.
- [ ] `client/src/lib/api.js` exposes `fetchActivity`.
- [ ] `useBoardStore` has an `activity` slice and optimistic append logic.
- [ ] `BoardHeader` has a button that toggles the activity sidebar.
- [ ] `ActivityFeed` slides in from the right and shows events with relative timestamps.
- [ ] Empty and skeleton states are implemented.
- [ ] "Load more" fetches older events using cursor pagination.
- [ ] No direct `fetch` calls from components; Flux pattern is preserved.
- [ ] No new runtime dependencies are added for relative time formatting.
- [ ] Out-of-scope items (auth, websockets, retention, comments, email) are not implemented.

---

## 10. Out of Scope

- User authentication / actor attribution
- Real-time websockets or Server-Sent Events
- Activity retention policies or auto-deletion of old events
- Comments on activity items
- Email / push notifications
- Full event-sourcing pattern
- Filtering activity by event type or date range
- Exporting activity history

---

## 11. Risks & Open Questions

| Risk | Impact | Mitigation |
|------|--------|------------|
| Status diff algorithm misclassifies renames | Medium | Keep heuristic simple; document behavior. If statuses are reordered extensively, emit a generic `status_updated` event instead of individual rename events. |
| Activity collection grows unbounded | Medium | Out of scope for this issue, but add a backlog item for retention / archiving. |
| Optimistic client activities can diverge from server events if request fails | Low | Activity is informational only; failed mutations roll back the board state, and the optimistic activity remains harmless (it reflects the attempted action). A future enhancement could roll it back too. |
| Cursor pagination by `_id` assumes monotonic creation time | Low | True for MongoDB ObjectId in a single cluster. Document the assumption. |
| Extra write per request increases latency | Low | Activity creation is fire-and-forget relative to the response; measure in staging. |

### Product clarifications needed

1. Should `task_moved` be emitted when a task is reordered within the same column, or only when `status` changes? **Recommendation:** only on `status` change; reordering creates noise. Document decision.
2. Should board creation emit a `board_created` event? **Recommendation:** not required by issue summary; backlog separately if desired.
3. Should the feed show the user's own actions differently (e.g., "You moved...")? **Recommendation:** keep neutral phrasing ("Task moved...") because there is no auth / actor.
