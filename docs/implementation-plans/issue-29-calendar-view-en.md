# Issue #29 — Calendar view (timeline by dueDate)

## 1. Summary

Add a fifth, route-backed Calendar view that presents the filtered board tasks in a UTC-safe month grid, keeps tasks without a `dueDate` in an unscheduled tray, and lets users reschedule tasks through optimistic drag-and-drop or a keyboard move mode. The view complements the existing Kanban, Grid, and Table views without changing the server contract, preserves the existing task detail navigation, and remains usable in light and dark themes with full keyboard and screen-reader support.

## 2. Architecture & Design Decisions

- **Route and view identity:** Add the exact `/board/:boardId/calendar` route in `client/src/App.jsx:13-20` and add `calendar` to the exact-path mapping in `client/src/lib/useView.js:8-16`. Do not make `useView` infer a view from a prefix; malformed paths must still return `null`.
- **Switcher:** Extend `client/src/components/ViewSwitcher.jsx:7-48` with a fifth icon-only link labelled `Calendar`, preserving `location.search`. Recommended order is Kanban, Grid, Table, Calendar: it preserves the current order and appends the temporal view described by this issue. The inline SVG must be hidden from assistive technology while the link exposes `aria-label="Calendar"`, `title="Calendar"`, and `aria-current="page"` when active.
- **Current detail navigation:** A chip must call `BoardPage.openTask`, not open a modal or a removed `TaskForm`. `BoardPage.openTask` already writes `location.pathname + location.search` to `location.state.from` (`client/src/pages/BoardPage.jsx:29-33`), so returning from `TaskDetailPage` preserves both the calendar month route and filters.
- **Month model:** Use a Monday–Sunday grid. This is the conventional planning week for a task board; labels can still be rendered in the existing en-US product context as `Mon` through `Sun`. Render complete weeks containing the first and last day of the month, including adjacent-month cells as visually muted, non-editable cells. No calendar library or new dependency is needed.
- **Date correctness:** Treat `dueDate` as a date-only value represented by UTC midnight. Add a pure `toDateKey` helper to `client/src/lib/dueDate.js` and group by UTC year/month/day, never by `Date#toDateString()` or local `getDate()`. Derive the user’s “today” key from local calendar parts (`getFullYear()`, `getMonth() + 1`, `getDate()`) rather than `toISOString()`, while parsing stored due dates with UTC parts. A date key passed to an update is `YYYY-MM-DD`; the API/store converts it to the existing accepted representation as already supported by `TaskDetailPage` and `updateTask`.
- **Derived state:** Do not add a `tasksByDay` selector returning a new `Map` to Zustand. Zustand v5 selectors must have stable snapshots, and the codebase already derives filtered arrays with `useMemo` (`client/src/store/useBoardStore.js:26-37`, `client/src/views/TableView.jsx:84-98`). Keep `filterTasks` as the only filtering operation, select `board.tasks`, `query`, and `filterStatus`, then call `filterTasks` once and derive a `Map` with a pure `groupTasksByDate` helper inside `CalendarView` via `useMemo`. This prevents a second filter and avoids an unstable store snapshot.
- **Filtering:** The calendar receives exactly the #25 filtered set. An unscheduled task is shown in the tray only if it survives `filterTasks`; counts, chips, side-panel contents, and empty states use that same set. The shared BoardPage “No tasks match” banner remains authoritative when the filtered set is empty.
- **Tray ordering:** Sort unscheduled tasks deterministically by priority descending (`high`, `medium`, `low`, `none`), then `createdAt` descending, then `_id` ascending. They are draggable into cells, but there is no persisted manual tray order because the Task model has no unscheduled-order field. Expose this rule in the tray label/help text rather than adding another state slice.
- **DnD model:** Use one `DndContext`, `PointerSensor` with a small activation distance, and `KeyboardSensor`. Date cells use `useDroppable({ id: `day:${dateKey}` })`; task chips and tray items use `useDraggable({ id: `task:${task._id}` })`; `DragOverlay` renders a compact chip. On a valid drop, resolve the task from the full board task list (not the filtered list), compare the old key with the target key, and call `updateTask(taskId, { dueDate: targetDateKey })`. A drop into the unscheduled tray calls `{ dueDate: null }` and is optional only if the tray is made a droppable target; the required direction is tray-to-day.
- **Keyboard alternative:** Keep the DnD `KeyboardSensor` for standard activator support, and provide a deterministic non-pointer alternative on every chip: focus the chip and press `m` to enter move mode, use `ArrowLeft`/`ArrowRight` to preview one calendar day backward/forward (with `Home` returning to the current date key), `Enter` to commit, and `Escape` to cancel. The chip exposes `aria-keyshortcuts="m"` and a visible/screen-reader move instruction. Commit uses the same `updateTask` action and rollback path as pointer DnD, so no user needs a mouse.
- **Side panel:** Clicking a cell opens an inline side panel (not a modal and not a new route) containing every filtered task for that day. The panel has a labelled heading, close button, focus return to the originating cell, and a focus boundary implemented with normal DOM controls; opening moves focus to the close button. Chip activation in the panel navigates to the detail page.
- **Theme and styling:** Use utility classes and existing `surface`, `primary`, `danger`, `status`, and `priority` tokens from `client/index.css:6-47` and `client/tailwind.config.js:18-53`. Do not add component CSS or dynamic classes that Tailwind cannot discover.

## 3. State Machine / Flow

```text
URL /board/:boardId/calendar?q=...&f=...
  -> BoardPage loads board and derives filterTasks(board.tasks, query, filterStatus)
  -> CalendarView sets visible month = current month
  -> useMemo: filtered tasks -> UTC date-key Map + unscheduled list
  -> render grid, counts, chips, and tray

Cell click -> selectedDay = dateKey -> side panel opens -> focus close button
Chip click/Enter -> BoardPage.openTask(task) -> /task/:taskId with exact from URL
View link click -> same query string copied to the target view

Pointer drag or keyboard move
  -> identify task + target date key
  -> updateTask(taskId, { dueDate: targetDateKey })
  -> optimistic store update -> re-group and render immediately
  -> API success: replace task with server response
  -> API failure: restore previous board + error banner + announcement
```

Month navigation changes only local `visibleMonth`; `<` and `>` move one month and `Heute` sets the current month. If today is outside the visible month, the header keeps a `Today` action/badge; it must not silently jump the user while browsing history.

## 4. API Contract

No backend or new endpoint is required. The existing store/API contract remains the boundary:

| Method | Path | Body | Response | Reference |
|---|---|---|---|---|
| `PUT` | `/api/tasks/:taskId` | `{ "dueDate": "2026-09-03" }` or `{ "dueDate": null }` | Existing task response, unwrapped by `client/src/lib/api.js` | Existing `updateTask` used by `client/src/store/useBoardStore.js:121-197`; server route under `server/routes/tasks.js` |
| `GET` | `/api/boards/:boardId` | none | Existing board with `tasks[]` including `dueDate` | `client/src/store/useBoardStore.js:64-73`; board route under `server/routes/boards.js` |

The UI must never call `fetch` or `api.js` directly. It calls `useBoardStore(s => s.updateTask)`, consistent with `docs/state-management.md:3-27`. Invalid dates, missing task IDs, and authorization/validation failures are surfaced through the existing error banner and rollback behavior; no server changes are in scope.

UTC helper to add in `client/src/lib/dueDate.js`:

```js
export const toDateKey = (iso) => {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()]
    .map((part, index) => index === 0 ? String(part).padStart(4, '0') : String(part).padStart(2, '0'))
    .join('-')
}
```

Use the same key format when creating a dropped date from UTC calendar parts; do not construct a local-midnight ISO string and then extract local parts.

## 5. File Changes

- **Modify** `client/src/App.jsx:13-20` — register `/board/:boardId/calendar` before the board-root route.
- **Modify** `client/src/lib/useView.js:8-16` — recognize the exact `calendar` segment.
- **Modify** `client/src/components/ViewSwitcher.jsx:7-79` — add the Calendar icon/link in the agreed order and preserve query strings.
- **Modify** `client/src/pages/BoardPage.jsx:5-15,108-115` — import and render `CalendarView` and keep `openTask` as its navigation callback.
- **Create** `client/src/views/CalendarView.jsx` — month grid, navigation, filtering derivation, chips, tray, side panel, DnD, keyboard move mode, and announcements.
- **Modify** `client/src/lib/dueDate.js:1-40` — export `toDateKey` and retain UTC-safe existing helpers.
- **Do not modify** `client/src/store/useBoardStore.js` — reuse `filterTasks` and existing optimistic `updateTask`; no second selector/filter.
- **Do not modify** `client/src/pages/TaskDetailPage.jsx:395-472` — existing `from` handling already works for the calendar URL.
- **Modify** `client/src/__tests__/use-view.test.jsx` and `client/src/__tests__/routing.test.jsx` — calendar route/view coverage.
- **Modify** `client/src/__tests__/view-switcher.test.jsx` — fifth icon, order, query preservation, and accessible name coverage.
- **Modify** `client/src/__tests__/due-date.test.js` — UTC date-key cases.
- **Create** `client/src/__tests__/calendar-view.test.jsx` — at least 15 focused UI/interaction tests.
- **Modify** `client/src/__tests__/use-board-store.test.js` only if needed to add a dedicated due-date failure assertion; existing rollback behavior should be reused.
- **No changes** to `server/`, `client/package.json`, `client/index.css`, or `client/tailwind.config.js` unless implementation discovers a pre-existing token gap; no new dependency is permitted.

## 6. Implementation Steps

1. Update `client/src/lib/dueDate.js` with `toDateKey`, add UTC edge-case tests in `client/src/__tests__/due-date.test.js`, and verify existing `toDateInputValue`, `formatDueDate`, and `isOverdue` behavior remains unchanged.
2. Register the exact calendar route in `client/src/App.jsx` and update `client/src/lib/useView.js`; extend `client/src/__tests__/use-view.test.jsx` and `client/src/__tests__/routing.test.jsx` with positive and malformed-path cases.
3. Add the inline Calendar SVG, append the Calendar entry to `VIEWS`, and update `client/src/__tests__/view-switcher.test.jsx` for active state, target paths, query preservation, order, and icon-only accessibility.
4. Import `CalendarView` in `client/src/pages/BoardPage.jsx` and render it for `view === 'calendar'`, passing `onTaskClick={openTask}` exactly like the other views.
5. Create `client/src/views/CalendarView.jsx` with pure helpers for month boundaries, Monday-first cell generation, UTC date keys, and grouping; derive filtered tasks once with `useMemo` from the three store values.
6. In `client/src/views/CalendarView.jsx`, implement the header `<`/`Heute`/`>` controls, live month/count announcement, today highlight, adjacent-month styling, per-cell labels, counts, three-chip limit, and `+N more` affordance.
7. In the same view, add the selected-day side panel, close/focus-return behavior, all-task listing, chip-to-`onTaskClick` navigation, and explicit empty states for no tasks in the month, no scheduled tasks, and no filtered tasks.
8. Add the unscheduled tray with priority/createdAt/id ordering and the DnD context: Pointer + Keyboard sensors, `useDraggable` chips, `useDroppable` day cells, full-board task lookup, `DragOverlay`, and target-key resolution.
9. Wire drops and keyboard move mode to `updateTask`; catch rejected promises only to keep local interaction stable because the store sets the global error and rolls back, and announce success/failure without duplicating rollback state in the view.
10. Add `client/src/__tests__/calendar-view.test.jsx` and adjust route/switcher tests; run the complete client and server test suites, `npm run build` in `client`, and lint without changing unrelated files.

Core grouping snippet for `CalendarView.jsx`:

```js
const groupTasksByDate = (tasks) => {
  const groups = new Map()
  tasks.forEach((task) => {
    const key = toDateKey(task.dueDate)
    if (!key) return
    const dayTasks = groups.get(key) ?? []
    groups.set(key, [...dayTasks, task])
  })
  return groups
}

const filteredTasks = useMemo(
  () => filterTasks(board?.tasks, query, filterStatus),
  [board?.tasks, query, filterStatus]
)
const tasksByDay = useMemo(() => groupTasksByDate(filteredTasks), [filteredTasks])
const unscheduledTasks = useMemo(
  () => filteredTasks
    .filter((task) => !toDateKey(task.dueDate))
    .sort(compareUnscheduledTasks),
  [filteredTasks]
)
```

## 7. Edge Cases & Error Handling

- **No board/loading:** Return `null` while the existing BoardPage loading/empty shell controls the experience; never dereference `board` before it exists.
- **No tasks at all:** Show a friendly calendar empty state and “Drag tasks here to schedule them” guidance in/near the tray; do not show a misleading no-match message when no filter is active.
- **No filtered tasks:** Let BoardPage show “No tasks match”; CalendarView must not display stale chips from the unfiltered board.
- **No tasks in visible month:** Show the month grid and a localized empty message, while still showing any filtered unscheduled tray tasks.
- **No scheduled tasks:** Keep the grid empty and show “No scheduled tasks yet — drag tasks here to schedule them”; the tray remains available.
- **Unscheduled-only filtered result:** Render the tray and empty month cells; counts remain zero.
- **Past/future months:** Navigation can show any month representable by JavaScript dates; past tasks remain visible and today highlighting appears only when the current date key is in the visible grid.
- **Adjacent-month cells:** They are visible for week continuity but are not valid drop targets and do not open a panel; navigation is required to edit that month.
- **Invalid/null dueDate:** `toDateKey` returns `null`; the task belongs in the tray, never in an “Invalid” day.
- **Timezone:** All grouping and generated keys use UTC parts. Month display labels may use a fixed en-US formatter, but they must be based on an explicit UTC date or numeric year/month, not a local parse of `YYYY-MM-DD`.
- **Drop on same day:** No API call and no announcement beyond optional “Task already scheduled for this day.”
- **Drop while filtered:** Resolve `active.id` against `board.tasks`, not only visible tasks, and only permit visible draggable chips; this prevents a filter from corrupting another task.
- **Failed update:** `updateTask` already restores the previous board and sets `error` (`client/src/store/useBoardStore.js:182-197`). Await it in the drop/move handler, leave the view derived from the rolled-back store, and announce “Could not reschedule task; change reverted.”
- **Rapid repeated moves:** Disable a chip’s move controls while its update is pending, or track the task ID in a local pending set, to avoid stale responses overwriting a later date. Pointer and keyboard handlers must not issue duplicate commits.
- **Side-panel lifecycle:** Escape and close return focus to the originating cell; if the originating cell unmounts after navigation, focus the calendar heading instead. Do not trap focus in a modal because the panel is not a modal.
- **Long names/counts:** Chips truncate visually but expose the full task name in their accessible label; `+N more` is a button with an explicit count.
- **XSS/security:** Render task names as React text, never `dangerouslySetInnerHTML`; use the existing store validation/API boundary and do not introduce direct URL interpolation beyond the existing task ID route.
- **Dark mode/responsive layout:** Use token utilities, ensure the side panel stacks below the grid on narrow screens, and keep visible focus rings in both themes.

## 8. Testing Strategy

Create `client/src/__tests__/calendar-view.test.jsx` with at least these 18 cases (the exact count may grow):

1. Renders the current month by default with seven Monday-first weekday headings.
2. Generates complete calendar weeks spanning a month boundary.
3. Groups UTC-midnight due dates under the correct day without a local timezone shift.
4. Shows the day count and at most three chips.
5. Shows `+N more` and opens the side panel with all tasks for that day.
6. Cell `aria-label` includes the formatted date and task count.
7. Clicking/pressing Enter on a chip calls the supplied task navigation callback.
8. Calendar navigation moves previous/next month and updates the `aria-live` announcement.
9. `Heute` returns to the current month and today has the highlight/badge.
10. A month outside today’s month shows no today highlight but retains the Today action.
11. Filters remove tasks from cells, counts, panel, and tray using the same `filterTasks` result.
12. No-match and no-scheduled-task empty states are distinct.
13. Unscheduled tray includes only null/invalid due dates and follows priority/createdAt/id order.
14. Pointer drag from tray to a day calls `updateTask(taskId, { dueDate: 'YYYY-MM-DD' })`.
15. Dragging a scheduled chip to another day uses the full-board task and target key.
16. A same-day drop does not call `updateTask`.
17. A rejected update leaves the rendered task on its original day and announces rollback/error.
18. Keyboard move mode supports `m`, ArrowLeft/ArrowRight, Enter commit, and Escape cancel, including an `aria-live` announcement.
19. Side-panel close returns focus to the selected cell.
20. `DragOverlay` is rendered while a chip is active and adjacent-month cells are not droppable.

Update `client/src/__tests__/use-view.test.jsx`, `routing.test.jsx`, and `view-switcher.test.jsx` for route/switcher behavior, and `due-date.test.js` for `toDateKey` with valid, null, invalid, and timezone-boundary values. Preserve the current 184 client and 61 server test baseline; run `npm test` from the relevant workspaces, `npm run build --workspace=client`, and lint. Mock `useBoardStore`/`updateTask` and use Testing Library `userEvent`; do not rely on real time by injecting a fixed “today” or using fake timers.

## 9. Acceptance Criteria

- [ ] `/board/:boardId/calendar` renders `CalendarView` and unknown board sub-paths still resolve to 404.
- [ ] `useView` recognizes only the exact calendar path, and `ViewSwitcher` presents Kanban, Grid, Table, Calendar in that order with icon-only accessible links.
- [ ] Every switcher link preserves `location.search`, and task detail navigation returns to the exact calendar URL including filters.
- [ ] The current month is shown by default with Monday–Sunday cells, complete weeks, previous/Today/next controls, and today highlighting.
- [ ] Tasks are grouped by UTC-safe `YYYY-MM-DD` due date; past and navigated months remain visible.
- [ ] Each day shows a count and at most three chips plus `+N more`; cell clicks expose all filtered tasks in an accessible side panel.
- [ ] Chips navigate to `TaskDetailPage`, not a modal or `TaskForm`.
- [ ] Null/invalid due dates appear in “Unscheduled · N”, ordered by the documented deterministic rule, and can be dragged into a day.
- [ ] DnD uses existing dnd-kit only, with PointerSensor, KeyboardSensor, `useDraggable`, `useDroppable`, and `DragOverlay`.
- [ ] Pointer drops and keyboard move mode call optimistic `updateTask` with the target date and visibly recover on rollback.
- [ ] Filter #25 affects cells, counts, side panel, tray, and empty states exactly once.
- [ ] Keyboard grid navigation, chip movement, focus return, cell labels, live announcements, visible focus, and light/dark parity are implemented.
- [ ] At least 15 new calendar tests pass; all existing 184 client and 61 server tests remain green; client build and lint are clean.
- [ ] No backend files or dependencies are added or changed.

## 10. Out of Scope

- Backend schema, route, controller, or API changes.
- New npm dependencies or a calendar component library.
- Multi-month or week/time-slot views, time-of-day scheduling, iCal export, recurring tasks, or collaboration.
- Persisted custom ordering for the unscheduled tray.
- Replacing the existing TaskDetailPage with a modal or reintroducing `TaskForm.jsx`.
- Moving tasks by clicking adjacent-month cells without navigating to that month.

## 11. Risks & Open Questions

- **Risk — DnD hit testing:** Small cells and dense chips can make pointer drops unreliable. Mitigate with full-cell droppable targets, `closestCenter`/`rectIntersection` testing, an obvious over-state, and DragOverlay.
- **Risk — keyboard parity:** dnd-kit keyboard coordinates do not naturally model a two-dimensional calendar. Mitigate with the explicit `m` move mode and test it independently; keep KeyboardSensor for the native DnD path.
- **Risk — timezone regressions:** Local parsing can shift dates. Mitigate with `toDateKey`, UTC-only grouping, and tests run with a non-UTC timezone in CI where possible.
- **Risk — Zustand v5 loops:** A selector returning a fresh `Map` can cause unstable snapshots. Keep grouping in `useMemo` in the view and add no `tasksByDay` store selector.
- **Risk — concurrent optimistic responses:** Two rapid moves can resolve out of order. Disable repeated commit for the active task or add a per-task pending guard; verify with a deferred-promise test.
- **Risk — test baseline discrepancy:** Issue text mentions 71 existing tests, while the current repository baseline is 184 client and 61 server tests. The implementation must preserve the current repository baseline, not remove tests to match the issue description.
- **Product decision:** Confirm that Monday–Sunday is acceptable for the en-US product context; recommendation is Monday-first for planning semantics.
- **Product decision:** Confirm the documented unscheduled ordering (priority descending, createdAt descending, `_id` ascending) versus a user-selectable sort; recommendation is deterministic fixed ordering for this scope.
- **Product decision:** Confirm keyboard move shortcut `m` and ArrowLeft/ArrowRight semantics; recommendation is to retain them because they are discoverable, testable, and avoid pretending a 2D keyboard drag is equivalent to pointer hit testing.
- **Product decision:** Confirm whether dropping onto the tray to unschedule is desired. Recommendation is to support tray-to-day now and leave day-to-tray as an optional symmetric enhancement only if product requires it.
