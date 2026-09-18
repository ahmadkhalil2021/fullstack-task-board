# Implementation Plan — Issue #27: Grid and sortable Table views

## 1. Summary

Add URL-addressable Grid and Table views to the existing board shell so users can choose a visual card wall or a dense, sortable power-user table without changing the task data flow. Both views consume the filtered tasks from Zustand, use `BoardPage.openTask` as their only navigation source, create tasks through the existing store action, preserve query parameters, and remain compatible with the current detail-page flow from #25/#26. No backend endpoint, schema, or dependency is required.

## 2. Architecture & Design Decisions

### Routing and view identity

- Add explicit routes in `client/src/App.jsx:13-19` for `/board/:boardId/grid` and `/board/:boardId/table`, before the generic `/board/:boardId` route. React Router therefore keeps unknown board sub-paths on `NotFoundPage` rather than silently rendering Kanban.
- Extend `client/src/lib/useView.js:7-13` to return exactly `'kanban' | 'grid' | 'table'` only for the exact three-segment paths `board/:boardId`, `board/:boardId/grid`, and `board/:boardId/table`. A malformed path must not be treated as a valid view; the explicit router remains the 404 authority.
- Extend `client/src/components/ViewSwitcher.jsx:7-39` to `Kanban | Grid | Table`, in that order. Continue using `location.search` verbatim so `?q=` and `?f=` survive every switch. Keep the navigation right-aligned in `BoardPage` and retain `aria-current="page"` on the active link.

### State and navigation

- Keep board tasks, query, and `filterStatus` in `useBoardStore`; derive `visibleTasks` with `filterTasks` in each view, matching `client/src/views/GridView.jsx` and `client/src/views/KanbanBoard.jsx:39-42`.
- Keep `BoardPage.openTask` (`client/src/pages/BoardPage.jsx:28-32`) as the only navigation source. Grid cards, the add flow, and table rows call `onTaskClick`; they never call `useNavigate` or the API.
- Use the existing optimistic `addTask` action (`client/src/store/useBoardStore.js:332-391`) with `board.statuses[0]`, then pass the returned real task to `onTaskClick`. This preserves the detail URL and `location.state.from`.

### Grid design

- Create `client/src/views/GridView.jsx` with `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4`.
- Sort a copied filtered array by `createdAt` descending; invalid or missing dates sort after valid dates and `_id` is a stable tie-breaker.
- Reuse `TaskCard` unchanged for card behavior and drag attributes. Place a shared `StatusBadge` in a positioned Grid wrapper at the top-right, avoiding a second status-color implementation and avoiding changes to Kanban drag behavior.
- Reuse `AddTaskButton` at the top-left. Extend its presentation API only if needed (for example an optional `className`), without changing the existing default column appearance.

### Table design and icon decision

- Create `client/src/views/TableView.jsx` with a semantic `<table>`, `<thead>`, `<tbody>`, and sortable headers for `Name`, `Status`, `Created`, and `Updated`.
- The issue names `Name · Status · Icon · Created · Updated`. Recommendation: render the task icon in the `Name` cell, as the existing board views do, rather than adding a narrow standalone Icon column. The icon is decorative context for the name, a separate column duplicates visual noise, and the integrated cell is more usable on narrow screens. Keep this as a product decision (see section 11); if Product requires a separate Icon column, add it between Status and Created without changing sorting or navigation behavior.
- Use local `useState` for `sortKey` and `sortDir`, `useMemo` for the filtered/sorted rows, and a per-board `sessionStorage` key such as `board-view-table:${boardId}`. Persist only validated values; on malformed JSON, an unknown key, or an invalid direction, use a deterministic default (`createdAt`, `desc`). Storage access must be guarded because browser storage can throw.
- Clicking the active header reverses direction; clicking another sortable header starts ascending. Put a real `button` inside each sortable `<th>`, set `aria-sort="ascending"`/`"descending"` only on the active header and `aria-sort="none"` on the others, and show `▲`/`▼` only for the active key.
- Make each data row keyboard reachable with `tabIndex={0}`, `aria-keyshortcuts="Enter"`, and an `onKeyDown` handler that invokes `onTaskClick(task)` for Enter. Avoid nested interactive controls in a row; header sort buttons are outside the data-row interaction.

### Shared status presentation

- Create `client/src/components/StatusBadge.jsx` with `StatusBadge({ status })`. It renders the status name and a decorative dot using `statusColor(status)` (`client/src/lib/statusColor.js:12-19`), Tailwind token classes, and `aria-hidden="true"` on the dot.
- Use it in Grid and Table. The component must support arbitrary board status strings and the existing light/dark tokens.

## 3. State Machine / Flow

### View selection

```text
URL pathname
    │
    ├── /board/:boardId          → useView() = kanban
    ├── /board/:boardId/grid     → useView() = grid
    ├── /board/:boardId/table    → useView() = table
    └── any unknown path          → router wildcard → NotFoundPage (404)
```

```text
User clicks ViewSwitcher link
        │
        ├── path changes, ?q=/?f= retained
        ▼
BoardPage reads useView()
        │
        ├── renders KanbanBoard / GridView / TableView
        └── keeps shared filter banner and BoardPage.openTask
```

### Grid add and task opening

```text
AddTaskButton
  → guard duplicate click
  → store.addTask(board.statuses[0])
  → optimistic task appears
  → API POST through store
  ├── success → real task replaces temporary task → openTask(realTask)
  └── failure → rollback + existing ErrorBanner; remain on board
```

### Table sorting and navigation

```text
mount(boardId)
  → read board-view-table:${boardId}
  → validate { sortKey, sortDir } or use { createdAt, desc }
  → filterTasks(board.tasks, query, filterStatus)
  → sort with useMemo

header click
  ├── active key → toggle asc/desc
  └── new key    → set asc
  → update aria-sort + ▲/▼ + sessionStorage

row click or Enter → onTaskClick(task) → /board/:boardId/task/:taskId
```

## 4. API Contract

No new API contract or server change is needed. The views consume the board already loaded by `BoardPage` through `client/src/store/useBoardStore.js:64-73` and `client/src/lib/api.js`.

| Method | Path | Body | Response | Reference |
|---|---|---|---|---|
| `GET` | `/api/boards/:boardId` | none | `200 { data: { board: { statuses, tasks, ... } } }` | `server/routes/boards.js`; contract `docs/api-contract.md:38-87` |
| `POST` | `/api/tasks` | `{ name, description, icon, status: board.statuses[0], order, parentBoardId: board._id }` | `201 { data: { task } }` | `server/routes/tasks.js`; contract `docs/api-contract.md:178-222` |

The UI calls neither endpoint directly. `BoardPage` calls `fetchBoard` via the store, and Grid/Table call the store's `addTask`; this preserves UI → Zustand → API and existing optimistic rollback/error handling (`docs/state-management.md:3-27`, `docs/error-handling.md:45-59`).

## 5. File Changes

- **Modify** `client/src/App.jsx:13-19` — register exact Grid/Table routes before the board-root route.
- **Modify** `client/src/lib/useView.js:7-13` — map exact paths to the four-view union without weakening 404 behavior.
- **Modify** `client/src/components/ViewSwitcher.jsx:7-39` — add two pills, preserve query strings and `aria-current`.
- **Modify** `client/src/pages/BoardPage.jsx:1-119` — import and select Grid/Table while retaining the shared banner and `openTask`.
- **Modify** `client/src/components/AddTaskButton.jsx:1-14` — only if an optional placement/style prop is needed; preserve current callers.
- **Create** `client/src/components/StatusBadge.jsx` — shared status token/name presentation.
- **Create** `client/src/views/GridView.jsx` — responsive, filtered, newest-first card wall and add/empty states.
- **Create** `client/src/views/TableView.jsx` — filtered sortable table, keyboard rows, and session persistence.
- **Create** `client/src/__tests__/grid-view.test.jsx` — at least 10 Grid cases.
- **Create** `client/src/__tests__/table-view.test.jsx` — at least 10 Table cases.
- **Modify** `client/src/__tests__/routing.test.jsx:34-109` — cover `/grid` and `/table` and retain unknown-subpath 404 coverage.
- **Modify** `client/src/__tests__/view-switcher.test.jsx:8-41` — cover the view links, active state, order, and query preservation.
- **Modify** `client/src/__tests__/use-view.test.jsx` — direct exact-path mapping coverage.

## 6. Implementation Steps

1. Modify `client/src/App.jsx:13-19` and `client/src/lib/useView.js:7-13` to register and recognize the two exact routes while retaining wildcard 404 semantics.
2. Modify `client/src/components/ViewSwitcher.jsx:7-39` and `client/src/pages/BoardPage.jsx:1-119` to expose all board views, keep the switcher right-aligned, and route view selection through `useView`.
3. Create `client/src/components/StatusBadge.jsx` and modify `client/src/components/AddTaskButton.jsx:1-14` only as required for reusable Grid placement; keep Tailwind-only styling and decorative icons hidden from assistive technology.
4. Create `client/src/views/GridView.jsx` using store selectors, `filterTasks`, `TaskCard`, `StatusBadge`, `AddTaskButton`, newest-first sorting, guarded add flow, and filtered/empty states.
5. Create `client/src/views/TableView.jsx` with validated per-board session storage, `useMemo` sorting, header buttons, `aria-sort`, `▲`/`▼`, focus styles, and Enter navigation through `onTaskClick`.
6. Create `client/src/views/TableView.jsx` add affordances and `client/src/__tests__/use-view.test.jsx` exact-path coverage.
7. Modify `client/src/__tests__/routing.test.jsx:34-109` and `client/src/__tests__/view-switcher.test.jsx:8-41` for route, active-pill, order, query, and 404 coverage.
8. Create `client/src/__tests__/grid-view.test.jsx` and `client/src/__tests__/table-view.test.jsx`, then run the existing test suite and `vite build`.

## 7. Edge Cases & Error Handling

- **Unknown board sub-path:** only the four explicit board paths match; `/board/:boardId/unknown` remains `NotFoundPage`.
- **Trailing slash or extra segment:** do not broaden `useView`; React Router's exact route behavior remains authoritative. If trailing slash normalization is required by the router, test it explicitly rather than treating arbitrary segments as Kanban.
- **Board loading/not found/no statuses:** `BoardPage` retains its existing loading, `ErrorBanner`, and `EmptyBoard` branches. Views return `null` when no board is available and are not rendered when statuses are empty.
- **No tasks:** Grid displays centered `Add your first task`; Table displays an accessible empty row and still provides its add affordance. A filtered zero-result list does not replace the shared `No tasks match` banner in `BoardPage`.
- **Filter changes:** both views recalculate from `filterTasks`; sorting applies after filtering. Clearing the shared filter immediately restores rows/cards.
- **Rapid add clicks/API failure:** use a synchronous ref plus disabled state, as in `GridView` (`client/src/views/GridView.jsx`); rely on store rollback and `ErrorBanner`.
- **Missing/invalid dates:** use a stable fallback ordering and display `formatRelativeTime`'s `recently` fallback (`client/src/lib/formatRelativeTime.js:7-17`). Never throw during render.
- **Unknown status names:** `statusColor` returns `todo`; `StatusBadge` must still render the original name.
- **Malformed or unavailable sessionStorage:** catch reads/writes, validate keys and directions, and continue with the default sort without blocking rendering.
- **Same sort values:** use `_id` as a deterministic tie-breaker so order does not jump between renders.
- **Keyboard interaction:** Enter opens exactly once; sort buttons stop their own event from opening a row. Decorative task/status icons use `aria-hidden="true"`.
- **Light/dark mode:** use existing `surface-*`, `status-*`, `primary`, and `shadow-card` tokens; do not introduce hard-coded colors or a new CSS dependency.

## 8. Testing Strategy

### Grid tests — `client/src/__tests__/grid-view.test.jsx` (minimum 10)

1. Renders one card per board task and the responsive grid class.
2. Sorts newest `createdAt` first.
3. Uses stable fallback ordering for missing/invalid dates.
4. Renders `StatusBadge` with the task status at the card top-right.
5. Calls `onTaskClick` when a card is activated.
6. Filters by the shared store query.
7. Filters by `filterStatus`.
8. Shows `Add your first task` for an unfiltered empty board.
9. Shows the filtered empty state without duplicating/replacing the BoardPage `No tasks match` banner.
10. Adds in `board.statuses[0]`, calls the mocked API through the store, and opens the returned task detail.
11. Disables/guards the add action during a pending request.
12. Rolls back the optimistic add and surfaces the store error on rejection.

### Table tests — `client/src/__tests__/table-view.test.jsx` (minimum 10)

1. Renders the semantic table and the agreed column headers.
2. Verifies the icon is decorative in the Name cell (or the approved standalone Icon column if Product chooses that option).
3. Uses the default `createdAt desc` order.
4. Clicking the active header toggles direction.
5. Clicking a new sortable header starts ascending.
6. Renders `▲`/`▼` only for the active key.
7. Sets `aria-sort="ascending"` and `"descending"` correctly and `"none"` on inactive headers.
8. Persists sort state under the board-specific `sessionStorage` key.
9. Restores valid persisted state and falls back for malformed/invalid state.
10. Keeps board A and board B sort state isolated.
11. Applies query and status filters before sorting.
12. Opens the detail route on mouse click and on Enter from a focused row.
13. Exposes `aria-keyshortcuts="Enter"` and visible focus styling.
14. Shows the empty state and add affordance for an empty board.

### Existing regression tests

- Extend `client/src/__tests__/routing.test.jsx:34-109` for both routes, active rendered views, and unknown sub-path 404 behavior.
- Extend `client/src/__tests__/view-switcher.test.jsx:8-41` for four links, exact hrefs, order, active `aria-current`, and `?q=`/`?f=` retention.
- Keep all existing tests passing.
- Run `npm test` (or the repository's configured Vitest command) and `npm run build --workspace=client`; verify `vite build` is clean.

## 9. Acceptance Criteria

- [ ] `/board/:id/grid` renders a filtered responsive card wall with 1/2/3/4 columns at the specified breakpoints.
- [ ] Grid cards are newest-first, show a top-right `StatusBadge`, reuse `TaskCard`, and expose `AddTaskButton` at the top-left.
- [ ] Grid empty state says `Add your first task` and creates/open tasks in the first board status.
- [ ] `/board/:id/table` renders a semantic sortable table with the approved icon-column decision.
- [ ] Table sorting supports new-column ascending, active-column direction toggling, `▲`/`▼`, and correct `aria-sort`.
- [ ] Table sort state persists per board ID in `sessionStorage` and safely falls back for invalid values.
- [ ] Table rows are keyboard reachable; Enter and pointer activation use `BoardPage.openTask` and open the detail page.
- [ ] Both views respect query/status filtering and the shared `No tasks match` banner.
- [ ] ViewSwitcher exposes exactly `Kanban | Grid | Table`, keeps query parameters, marks the active view with `aria-current`, and remains right-aligned.
- [ ] Unknown board sub-paths still render 404; browser back/forward moves naturally between views.
- [ ] Light and dark themes have parity; decorative icons use `aria-hidden="true"` and focus states are visible.
- [ ] No backend files or new dependencies are added.
- [ ] At least 10 Grid and 10 Table tests are added; all existing tests pass and `vite build` is clean.

## 10. Out of Scope

- Backend routes, MongoDB schemas, migrations, or API changes.
- Inline Table cell editing.
- Column show/hide preferences.
- Saved views beyond per-board `sessionStorage`.
- New dependencies, drag-and-drop behavior changes, or changes to the task detail page.
- Reintroducing the removed `TaskForm` modal.
- A separate icon column unless Product explicitly chooses it.

## 11. Risks & Open Questions

### Risks

- Reusing `TaskCard` means its dnd-kit sortable hooks remain active in Grid. This is consistent with the existing component contract, but Grid must not introduce a second drag context or corrupt ordering.
- Tailwind dynamic status classes require existing safelisted `bg-status-*` tokens; `StatusBadge` must use the same finite token mapping and not create arbitrary class names.
- `sessionStorage` can be unavailable or throw in privacy/test environments; guarded access and default sorting are mandatory.
- The issue text references `TaskForm`, but #25/#26 replaced it with `TaskDetailPage`; the plan deliberately follows the current detail-page architecture.

### Open questions / decisions for Product

1. Approve the recommendation to place the task icon inside the `Name` cell, or require a separate `Icon` column between `Status` and `Created`?
2. Should the Table default sort be `Created desc` (recommended for consistency with Grid/newest-first), or should Product prefer `Name asc` for scanning?
3. Is `Add your first task` required only for an unfiltered empty board, with the existing shared `No tasks match` banner for filtered emptiness (recommended)?
4. Should Grid keep `TaskCard`'s existing keyboard/dnd-kit behavior exactly as-is, or should Grid use a non-sortable presentation wrapper in a future follow-up?

---

## Addendum — 2026-09-18 (List view removed, icon-only switcher)

Product follow-up after review:

- The List view referenced throughout this plan was removed: the sortable Table view supersedes it. `/board/:boardId/list` falls through to `NotFoundPage`, `client/src/views/ListView.jsx` and `client/src/__tests__/list-view.test.jsx` are deleted, and `useView` returns only `kanban | grid | table`.
- The view switcher renders icon-only links (inline SVG) with `aria-label` accessible names instead of visible text labels.

