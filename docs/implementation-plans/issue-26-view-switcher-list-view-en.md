# Issue #26 — View Switcher + List View Implementation Plan

## 1. Summary

Build a URL-driven Kanban/List view switcher for board users. `/board/:boardId` remains the default Kanban route and `/board/:boardId/list` renders a grouped, collapsible List view. The existing `useBoardStore` state, `filterTasks` helper, optimistic task actions, `TaskForm`, and design tokens remain the single source of truth; no backend endpoint or dependency is needed. The refactor extracts the current drag-and-drop surface into `KanbanBoard`, keeps the shared header/search/filter empty state in `BoardPage`, and makes deep links and browser history work naturally.

## 2. Architecture & Design Decisions

### Routing and active view

- Add `{ path: '/board/:boardId/list', element: <BoardPage /> }` before the existing `/board/:boardId` route in `client/src/App.jsx:12-16`. Keep the routes flat, matching `docs/route-design.md:48-54`; the more specific route must be declared first.
- Create `client/src/lib/useView.js` with `useLocation()` as the canonical source. Return `'list'` only for the exact pathname shape `/board/:boardId/list`; return `'kanban'` for `/board/:boardId`. A small hook is preferable to duplicating pathname parsing in `BoardPage` and `ViewSwitcher`; `ViewSwitcher` may still use `useParams()` to build links and `useLocation()`/`useView()` for active state.
- Use `<Link>` rather than imperative navigation. This preserves deep-linkability and browser Back/Forward entries, and retains `location.search` (`q`/`f`) while changing only the pathname.
- Unknown paths continue to match `NotFoundPage`. `/board/:boardId/unknown` must not silently become Kanban; only the exact two supported route patterns render `BoardPage`.

### Composition and state ownership

- `BoardPage` remains responsible for board loading, global error/loading states, shared `BoardHeader` (which already owns `CommandBar` at `client/src/components/BoardHeader.jsx:62-122`), `ViewSwitcher`, the filter banner, and the `TaskForm` modal.
- Extract the current `DndContext`, sensor setup, drag handlers, full-task drag resolution, `SortableContext`s, and `AddTaskButton` behavior from `client/src/pages/BoardPage.jsx:45-229` into `client/src/views/KanbanBoard.jsx`. The page then selects `KanbanBoard` or `ListView` without duplicating task loading or modal logic.
- Keep one composition-boundary callback (`onTaskClick`) from `BoardPage` to each active view so the existing modal remains shared. This is not multi-level prop drilling; view components read board/filter/action state directly from Zustand.
- Both views derive visible tasks with the existing `filterTasks(board?.tasks, query, filterStatus)` from `client/src/store/useBoardStore.js:26-37`. Do not add a second filter implementation or store slice. The filter banner stays in `BoardPage` and therefore applies identically to both views.
- The Kanban drag resolver must always inspect `board.tasks`, never the filtered list. Filtering only changes rendered `SortableContext` items; `findColumnOfTask` and `findColumnFromOver` resolve against the full list.

### List view behavior

- `client/src/views/ListView.jsx` reads `board`, `query`, and `filterStatus` directly from `useBoardStore`, derives filtered tasks with `filterTasks`, and maps `board.statuses` without sorting it. This preserves server/user-defined status order.
- Render a section for each status that has filtered tasks. Its header is a real `<button>` with `aria-expanded` and `aria-controls`; sections start expanded and maintain a local `collapsedStatuses` set. A status with zero filtered tasks has no header or rows, but retains a minimal section containing its status-specific Add button so an empty status can still receive its first task. The page-level “No tasks match” banner handles a zero total filter result.
- Each row contains the task icon, escaped React text task name, `formatRelativeTime(task.updatedAt ?? task.createdAt, now)`, and a decorative chevron. A row click invokes the shared `onTaskClick(task)` and opens the existing `TaskForm`. Keyboard activation is provided by a button (or an equivalent focusable row with complete Enter/Space handling); prefer a button for native semantics.
- Render `AddTaskButton` at the bottom of every rendered status section, and call `useBoardStore.addTask(status)` for that section. Preserve the existing optimistic create flow and guard rapid repeated clicks. After the returned task resolves, pass it to the page callback so `TaskForm` opens; on failure rely on the store error banner and do not open the modal. If a section is collapsed, keep its add button available below the collapsed content.

### Relative time and tokens

- Extract the current helper from `client/src/components/ActivityFeed.jsx:8-20` to `client/src/lib/formatRelativeTime.js`, exporting `formatRelativeTime`. Keep the existing `Intl.RelativeTimeFormat('en', { numeric: 'auto' })` behavior and `(iso, now)` signature so the utility is deterministic in tests. Update `ActivityFeed` to import it; do not duplicate the formatter.
- Use existing tokens such as `bg-surface-raised`, `bg-surface-muted`, `border-surface-border`, `text-surface-text-muted`, `shadow-card`, and `focus-visible:ring-primary`. Add no CSS or token changes unless implementation reveals a missing token. Tailwind utility classes only provide light/dark parity.

### Runnable hook and component examples

```js
// client/src/lib/useView.js
import { useLocation } from 'react-router-dom'

export const useView = () => {
  const { pathname } = useLocation()
  const segments = pathname.split('/').filter(Boolean)
  return segments.length === 3 && segments[0] === 'board' && segments[2] === 'list'
    ? 'list'
    : 'kanban'
}
```

```jsx
// client/src/components/ViewSwitcher.jsx
import { Link, useLocation, useParams } from 'react-router-dom'
import { useView } from '../lib/useView.js'

const ViewSwitcher = () => {
  const { boardId } = useParams()
  const { search } = useLocation()
  const view = useView()
  const items = [
    { key: 'kanban', label: 'Kanban', to: `/board/${boardId}${search}` },
    { key: 'list', label: 'List', to: `/board/${boardId}/list${search}` },
  ]

  return (
    <nav aria-label="Board view" className="flex gap-1 p-1 bg-surface-muted rounded-card">
      {items.map((item) => (
        <Link
          key={item.key}
          to={item.to}
          aria-current={view === item.key ? 'page' : undefined}
          className={`rounded px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${view === item.key ? 'bg-surface-raised shadow-card text-surface-text' : 'text-surface-text-muted hover:bg-surface-raised'}`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}

export default ViewSwitcher
```

## 3. State Machine / Flow

```text
URL /board/:boardId or /board/:boardId/list
        │ React Router matches exact route
        ▼
BoardPage → useView()
        ├── board missing → loading / EmptyBoard / error
        └── board loaded
             ├── BoardHeader (includes CommandBar → Zustand query/filterStatus)
             ├── ViewSwitcher (Link changes pathname, keeps q/f)
             ├── filteredTasks = filterTasks(full board.tasks, query, filterStatus)
             ├── filteredTasks empty while filtering → shared No tasks match banner
             ├── kanban → KanbanBoard (render filtered; drag resolve full list)
             └── list → ListView (status order → rows; local collapse state)
                          ├── row click → BoardPage editingTask → TaskForm
                          └── add click → store.addTask(status) → API → TaskForm
```

```text
View link click → URL history entry → BoardPage re-render → active aria-current updates
Browser Back/Forward → location changes → useView updates → same board/filter state renders
```

The store remains `UI → useBoardStore action → api.js → state update → UI`; view selection and collapsed sections are URL/local UI state, not persisted board state.

## 4. API Contract

There are no new or changed API calls. This is a frontend-only presentation feature.

| Method | Path | Body | Response | Reference |
|---|---|---|---|---|
| GET | `/api/boards/:boardId` | — | Existing board payload, including `statuses` and `tasks` | Existing contract consumed by `client/src/store/useBoardStore.js:64-73`; backend remains in `server/routes/boards.js` |
| POST | `/api/tasks` | Existing `addTask` payload with `parentBoardId`, `status`, `name`, `description`, `icon`, `order` | Existing task payload | Existing contract consumed by `client/src/store/useBoardStore.js:370-386`; backend remains in `server/routes/tasks.js` |
| PUT | `/api/tasks/:taskId` | Existing `TaskForm` update payload | Existing task payload | Existing contract consumed by `client/src/store/useBoardStore.js:169-183`; backend remains in `server/routes/tasks.js` |

List rows and view links must not call `fetch` or `api.js` directly. There are no backend, Mongoose, validation, authentication, or dependency changes.

## 5. File Changes

- **Modify** `client/src/App.jsx:12-16` — add `/board/:boardId/list` before `/board/:boardId`.
- **Modify** `client/src/pages/BoardPage.jsx:6-240` — remove Kanban-only DnD code, use `useView`, render `ViewSwitcher`, choose `KanbanBoard`/`ListView`, retain loading/error/empty/filter banner and shared `TaskForm` state.
- **Create** `client/src/lib/useView.js` — exact URL-to-view hook.
- **Create** `client/src/components/ViewSwitcher.jsx` — token-based pill links and active accessibility state.
- **Create** `client/src/views/KanbanBoard.jsx` — extracted DnD Kanban implementation.
- **Create** `client/src/views/ListView.jsx` — grouped collapsible list, rows, relative times, and per-status add actions.
- **Create** `client/src/lib/formatRelativeTime.js` — shared deterministic relative-time utility.
- **Modify** `client/src/components/ActivityFeed.jsx:5-20` — import shared formatter and remove local helper.
- **Create/modify tests** `client/src/__tests__/view-switcher.test.jsx`, `client/src/__tests__/list-view.test.jsx`, `client/src/__tests__/routing.test.jsx`, `client/src/__tests__/activity-feed.test.jsx` — cover the new route/view behavior and utility import without changing the API.

## 6. Implementation Steps

1. **Routing foundation (2 files):** Add the specific list route in `client/src/App.jsx`; create `client/src/lib/useView.js` with exact `kanban`/`list` mapping and a safe fallback for the board root.
2. **Shared formatter (2 files):** Create `client/src/lib/formatRelativeTime.js` by moving the existing helper unchanged; update `client/src/components/ActivityFeed.jsx` imports and usages.
3. **View switcher (1 file):** Create `client/src/components/ViewSwitcher.jsx` with `<Link>` targets, preserved `location.search`, active token classes, `nav`, `aria-current`, visible focus, and keyboard-native links.
4. **Kanban extraction (1 file):** Move DnD imports, sensors, drag start/end resolution, optimistic add handling, `SortableContext`, `Column`, `DragOverlay`, and full-list resolver into `client/src/views/KanbanBoard.jsx` while preserving existing behavior.
5. **List rendering (1 file):** Create `client/src/views/ListView.jsx`; derive one filtered list through `filterTasks`, group by `board.statuses`, maintain collapsed status UI, render accessible headers/rows, use `formatRelativeTime`, and call `addTask(status)` through the store.
6. **Page composition (1 file):** Refactor `client/src/pages/BoardPage.jsx` to keep fetch/loading/error/empty behavior and shared filter banner, place `ViewSwitcher` above the active view, select by `useView`, and keep `TaskForm` modal ownership at the page boundary.
7. **Tests (3-4 files):** Add the view/list suites, extend routing and ActivityFeed tests for the new route and formatter, and update existing BoardPage test route definitions where required.
8. **Validation:** Run the client test suite, `vite build`, and manually exercise deep links, query/filter links, Back/Forward, unknown paths, keyboard navigation, and light/dark themes.

## 7. Edge Cases & Error Handling

- **Deep-linked list route:** Fetch the board once using `boardId`; render loading and existing not-found/error UX before either view.
- **Query/filter deep link:** `CommandBar` continues to hydrate `q`/`f`; both views consume the same store values and `filterTasks`. `ViewSwitcher` preserves the query string.
- **No matches:** `BoardPage` checks the same filtered result and shows exactly the existing “No tasks match” banner for either view; clear action calls `clearSearch`.
- **Empty board/statuses:** Keep `EmptyBoard` for no board or no defined statuses. A defined status with zero filtered tasks emits no List header or rows, but keeps its status-specific Add button; a fully filtered result is handled by the page banner.
- **Unknown status on a task:** Do not invent a section; it remains absent from the status-ordered view. Existing Kanban behavior is unchanged.
- **Missing/invalid timestamp:** `formatRelativeTime` should safely return a readable fallback (for example `Updated recently`) when the date is invalid; define and test this behavior rather than allowing `Invalid Date` into the UI.
- **Add failure/double click:** Use the existing optimistic `addTask` rollback/error path, a synchronous in-flight guard, and only open `TaskForm` after success. The page’s existing alert remains the user-facing error.
- **Row update/delete failure:** `TaskForm` and store retain current rollback and error behavior; the List view re-renders from Zustand after success or rollback.
- **Collapsed section and filtering:** Keep collapse state local and keyed by status; when a filter changes, visible sections derive afresh and never show a stale task outside the filter. Add buttons remain available for empty statuses.
- **Accessibility:** Buttons have accessible names, headers expose `aria-expanded` and unique `aria-controls`, rows are keyboard operable, focus-visible rings use tokens, and decorative icons/chevrons use `aria-hidden`.
- **Unknown URL:** React Router’s wildcard still renders `NotFoundPage`; do not use a permissive fallback in `useView` to mask malformed routes.

## 8. Testing Strategy

Add at least 10 new focused tests, with existing tests remaining green:

- `client/src/__tests__/view-switcher.test.jsx`: (1) Kanban is active at `/board/b1`, (2) List is active at `/board/b1/list`, (3) links point to both exact paths, (4) `aria-current` follows the route, (5) `?q=docs&f=completed` is preserved, (6) keyboard focus/activation works.
- `client/src/__tests__/list-view.test.jsx`: (7) groups tasks by status, (8) follows non-alphabetical `board.statuses` order, (9) renders icon/name/relative time/chevron, (10) empty sections are silent, (11) header collapse updates `aria-expanded` and hides rows via `aria-controls`, (12) row click calls the page callback and opens `TaskForm` in an integration render, (13) each section’s Add button calls `addTask` with that status, (14) optimistic create opens the modal after resolution, (15) filtered tasks only appear in the list, (16) zero filtered tasks shows the shared banner and clear action.
- `client/src/__tests__/routing.test.jsx`: render both route definitions, assert Kanban/List output, assert `/board/b1/unknown` remains 404, and exercise memory-router Back/Forward.
- `client/src/__tests__/activity-feed.test.jsx`: import/use the extracted formatter behavior for seconds/minutes and ensure ActivityFeed still renders relative timestamps.
- Update `client/src/__tests__/command-bar.test.jsx` integration setup to include the list route where needed and prove the same filter narrows List view, not a second filter.

Use existing Vitest + Testing Library patterns, store/API mocks, `MemoryRouter`/`createMemoryRouter`, and deterministic `now` values. Run:

```bash
npm test --workspace=client
npm run build --workspace=client
```

## 9. Acceptance Criteria

- [ ] `/board/:id` renders Kanban and `/board/:id/list` renders List.
- [ ] View switching uses `<Link>`, highlights the active view, exposes `aria-current`, and preserves `q`/`f`.
- [ ] Deep links and browser Back/Forward select the correct view; unknown board subpaths render 404.
- [ ] Kanban DnD behavior is unchanged and resolves drag targets against the full task list while rendering filtered tasks.
- [ ] List sections follow `board.statuses` order, collapse accessibly, omit empty headers/rows, and retain a status-specific Add button for empty statuses.
- [ ] Every row shows icon, name, relative time, and chevron; row activation opens the existing `TaskForm`.
- [ ] Every visible section has an Add button that creates with that section’s status and opens `TaskForm` after success.
- [ ] #25’s `filterTasks` behavior and shared “No tasks match” banner work identically in both views.
- [ ] Relative-time logic is shared by List view and ActivityFeed, with tests updated.
- [ ] Light and dark token styling, focus states, and keyboard operation meet accessibility expectations.
- [ ] At least 10 new tests pass, all existing tests pass, and `vite build` is clean.
- [ ] No backend files or new dependencies are introduced.

## 10. Out of Scope

- Backend routes, Mongoose schemas, API contract changes, authentication, or new dependencies.
- Grid or Table views (#27).
- Drag-and-drop in List view.
- Persisting a preferred view per board or in Zustand/localStorage; the URL is the source of view selection.
- Replacing the existing `CommandBar`, changing filter semantics, or moving it out of `BoardHeader`.

## 11. Risks & Open Questions

### Risks

- Extracting `BoardPage` can accidentally change the full-list drag resolver or the first-column-only Kanban add behavior; preserve the existing tests and explicitly test drag resolution with an active filter.
- A dynamic `status` class must use the already safelisted status tokens; avoid introducing arbitrary Tailwind classes that the build cannot detect.
- `TaskForm` currently focuses and edits the created task after `addTask`; temporary IDs and API failures must not leave a stale modal.
- Date fields may differ between fixtures/server payloads (`updatedAt`, `createdAt`); the utility needs a documented fallback.

### Open questions for Product/Review

- Should the pill labels be localized now, or remain the current English UI labels (`Kanban`, `List`)?
- What exact fallback copy is desired for a task without a valid timestamp: `Updated recently`, `Updated just now`, or omission?
- Should a collapsed List section stay collapsed when the user changes filters, or should newly visible matching sections expand automatically?
- Should the section Add button remain visible when its section is empty and/or collapsed? This plan assumes yes for every status, including an empty status with no header/rows.

---

## Addendum — 2026-09-18 (Odoo list + task detail page)

Product follow-up after UI review:

- `ListView` renders as an Odoo-style table: `Task | Status | Updated` columns, one group row per status with caret + count, and a per-group `+ Add a line` row. The table layout and Status column replace the card-per-section look.
- The `ViewSwitcher` is right-aligned above the content.
- The shared `TaskForm` modal was removed. Clicking a task in Kanban or List (and creating one from either view) now navigates to the dedicated, fully editable page `/board/:boardId/task/:taskId` (`client/src/pages/TaskDetailPage.jsx`): name, description, icon, status, save feedback, two-step delete, created/updated meta, and a back link that preserves the originating view + filters via `location.state.from`.
- The row-click acceptance criteria now mean “opens the task detail page”.

