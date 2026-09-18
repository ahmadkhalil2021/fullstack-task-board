# Implementation Plan — Issue #25: Inline search + status filter (Cmd/Ctrl+K command bar)

## 1. Summary

Build a client-only `CommandBar` for `/board/:boardId` that searches task names and descriptions, filters by any board-defined status, persists the effective filters in `?q=` and `?f=`, and supplies the filtered task collection to the current Kanban view (and future views). The feature must remain within the existing Flux boundary: React components dispatch search actions to Zustand, the store derives `filteredTasks`, and no component calls `api.js` directly. PR #30 design tokens are already available; no backend or API contract change is required.

## 2. Architecture & Design Decisions

### Command-bar ownership and keyboard focus

- **Recommendation:** Render `CommandBar` from `BoardPage.jsx:161-163`, but keep its `Cmd/Ctrl+K` listener, open state, input ref, trigger ref, and focus lifecycle inside `CommandBar.jsx`.
- The component remains mounted when closed, so the shortcut works without a BoardPage-level global listener. A `keydown` listener on `window` is attached in an effect and removed on unmount; it calls `preventDefault()` for `event.metaKey || event.ctrlKey` plus `event.key.toLowerCase() === 'k'`.
- The command bar owns a visible search trigger when closed and an open panel when active. Opening focuses the input in `useEffect`; closing restores focus to the trigger. `Esc`, the backdrop, and the explicit close/clear controls use the same close path.
- Because the bar has a backdrop and a `role="dialog"`, implement a small local focus trap rather than adding a dependency: keep the first/last focusable elements, cycle `Tab`/`Shift+Tab`, and close if `focusin` lands outside the dialog. This satisfies the requested “focus leaves” behavior while allowing focus to move between the input and pills. Backdrop clicks are distinguished from panel clicks by checking `event.target === event.currentTarget`.

### URL synchronization stays in the route component

- **Recommendation:** `CommandBar` reads and writes `useSearchParams`; the store must not import `react-router-dom`.
- On mount, read `q` and `f`, resolve them against the current `board.statuses`, and initialize the store. While the user changes filters, `CommandBar` writes the effective debounced query and canonical status key with `setSearchParams(next, { replace: true })`; omit empty values rather than writing `q=` or `f=all`.
- `useSearchParams` is a view/router concern. Keeping it in `CommandBar` preserves the Flux rule (UI → Store → API), keeps the store usable in non-router tests, and avoids coupling a reusable derived selector to browser history. Browser navigation is handled by an effect that re-applies changed URL values to the store without pushing a new history entry.
- The initial URL is authoritative only after `board` is available. Invalid or stale `f` values resolve to no status filter and are removed from the URL. Empty or missing `q` resolves to `''`.

### Search debounce

- **Recommendation:** create `client/src/lib/useDebouncedValue.js` with a `useEffect`/`setTimeout` implementation and a 150 ms delay. No dependency is added.
- The input keeps immediate local text for responsive typing. The debounced value updates the store’s effective `query` and the URL. Status selection is immediate and is combined with the most recent debounced query.

```js
// useDebouncedValue.js — Delay a value without adding a runtime dependency.
import { useEffect, useState } from 'react'

export const useDebouncedValue = (value, delay = 150) => {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delay)
    return () => window.clearTimeout(timeoutId)
  }, [value, delay])

  return debouncedValue
}
```

### Status keys and arbitrary board statuses

- Never assume exactly three statuses. Render one `All` pill plus one pill per `board.statuses` entry, preserving board order and using `statusColor(status)` for the visual token.
- Use a deterministic URL key for every status: trim, Unicode-normalize, lowercase, remove diacritics, replace runs of non-alphanumeric characters with `-`, and trim `-`. The key for `In Progress` is `in-progress`; the key for `Won't do` is `won-t-do` (the apostrophe is intentionally normalized).
- Resolve `f` by first matching the generated key. Also accept explicit semantic aliases for backwards-friendly links: `progress` matches `in-progress`, `inprogress`, or `progress`; `completed` matches `completed` or `done`; `wont-do` matches `wont-do`, `won-t-do`, or `wontdo`. Alias matching is case-insensitive after normalization and only selects an existing board status.
- If two statuses produce the same key, use a deterministic disambiguation (`key-2`, `key-3`) for generated links and treat an ambiguous incoming key as invalid rather than filtering the wrong status. A renamed or removed status therefore clears a stale filter safely.

### Store-derived filtering and counts

- Add a `searchSlice` to `client/src/store/useBoardStore.js:36-47` with `query`, `filterStatus`, `setSearchQuery`, `setFilterStatus`, `clearSearch`, and a `filteredTasks` selector/action.
- `filteredTasks` must be derived from the current `board.tasks`, not stored separately. Search is case-insensitive substring matching against `task.name` OR `task.description`; missing fields are treated as empty strings. Status filtering is an exact match against the board status name.
- Expose the selector as a stable store action such as `getFilteredTasks: () => { ... }` only if existing Zustand usage requires it; components should preferably subscribe through a selector that computes from `s.board`, `s.query`, and `s.filterStatus`. Do not mutate `board.tasks` for filtering.
- `BoardPage` uses the derived set for each `Column` (currently `BoardPage.jsx:174-177`), so column header counts shrink and empty columns remain visible with count `0`. Drag/reorder lookup must continue to use the complete board task list, not the filtered list, so filtering cannot make a task disappear from drag identity resolution.
- Pill counts are calculated from the query-matched set before the selected status is applied: `All` is the query-match count and each status pill is the count for that status. This keeps counts useful while a status is selected and makes them live as the query changes.

### Accessibility and tokens

- Use `role="dialog"`, `aria-modal="true"`, an accessible heading, labelled input, `aria-pressed` on pills, and `aria-live="polite"` for result/count changes. Give the trigger an accessible name and keyboard focus style.
- Use existing `surface-*`, `status-*`, and `ring-primary` utilities from PR #30. Do not add CSS or hard-coded colors. Add no axe dependency in this issue: the repository has no axe package, and the acceptance scan can be performed manually with browser axe DevTools/extension. Adding `axe-core` or `@axe-core/react` would expand dependency and test setup scope without changing production behavior; it is explicitly listed as out of scope, with manual scan evidence required.

## 3. State Machine / Flow

```text
Closed
  ├─ click Search trigger ───────────────► Open (focus input)
  ├─ Cmd/Ctrl+K ─────────────────────────► Open (focus input)
  └─ URL q/f on board load ──────────────► Open only if a valid filter exists

Open
  ├─ input change ─► local draft ──150 ms──► store.query + URL q ─► filteredTasks
  ├─ status pill ─► store.filterStatus + URL f ───────────────────► filteredTasks
  ├─ All/Clear ──► query='' and filterStatus=null + remove q/f ───► all tasks
  ├─ Esc/backdrop/focus outside ────────────────────────────────► Closed + restore trigger focus
  └─ board/status change ─► re-resolve f ─► canonical URL or clear stale filter

BoardPage render flow:
board.tasks + store.query/filterStatus
          └─► filteredTasks
                └─► each status column (including empty columns)
```

## 4. API Contract

This feature makes **no backend request** and changes no method, path, body, or response. The existing board fetch remains the source of `statuses` and `tasks`:

| Method | Path | Body | Response | Reference |
|---|---|---|---|---|
| GET | `/api/boards/:boardId` | none | `200 { data: { board: { statuses, tasks, ... } } }` | `server/routes/boards.js`; client wrapper `client/src/lib/api.js:24-25` |

The URL state is client routing state only: `/board/:boardId?q=login&f=in-progress`. `q` is the debounced substring and `f` is a canonical status key; neither is sent to the server. No changes are planned for `client/src/lib/api.js`, `server/routes/boards.js`, or Mongoose schemas.

## 5. File Changes

- **Create** `client/src/components/CommandBar.jsx` — trigger, dialog, shortcut listener, URL synchronization, search input, status pills, counts, clear/empty state, focus management, and Tailwind presentation.
- **Create** `client/src/lib/useDebouncedValue.js` — dependency-free 150 ms hook.
- **Modify** `client/src/store/useBoardStore.js:36-47` — add search state, actions, and derived filtering helpers; preserve API actions and optimistic update behavior.
- **Modify** `client/src/pages/BoardPage.jsx:6-24, 141-205` — render `CommandBar`, consume filtered tasks for columns, keep drag operations based on full tasks, and render the “No tasks match” state through the bar/page integration.
- **Modify** `client/src/components/Column.jsx:10-47` — only if needed to expose an explicit empty-column presentation while preserving the existing `0` count and drop target.
- **Create** `client/src/__tests__/command-bar.test.jsx` — component, URL, keyboard, debounce, accessibility interaction, and filtering coverage.
- **Create** `client/src/__tests__/search-store.test.js` — pure store filtering, status mapping/count helper, and reset coverage if helpers are exported for testability.
- **Do not modify** `client/src/lib/api.js`, `client/tailwind.config.js`, `client/src/index.css`, or backend files; existing design tokens are sufficient.

## 6. Implementation Steps

1. Add `client/src/lib/useDebouncedValue.js` and pure search/status helpers in `client/src/store/useBoardStore.js` (or a colocated utility section), including normalization, alias resolution, collision handling, and query/status matching.
2. Extend `client/src/store/useBoardStore.js` with the `searchSlice`, reset-safe defaults, setters, and derived filtered-task/count calculations without introducing router imports or API calls.
3. Create `client/src/components/CommandBar.jsx` with the closed trigger, `Cmd/Ctrl+K` listener, 150 ms hook, `useSearchParams` hydration/write-back, pills, counts, and clear behavior.
4. Modify `client/src/pages/BoardPage.jsx` to mount the command bar and replace `board.tasks.filter` in the render path with the derived filtered collection while keeping drag handlers on `board.tasks`.
5. Adjust `client/src/components/Column.jsx` only for an intentional empty-column message/accessible count treatment; use existing Tailwind tokens and keep the drop target active.
6. Add the new Vitest/Testing Library tests, update existing mocked store state only where required by the new initial search fields, then run the full client test suite, `npm run build --workspace=client`, and `npm run lint --workspace=client`.
7. Perform a manual axe scan in light and dark themes at desktop and narrow viewport sizes, record zero critical/serious violations, and verify URL reload/deep-link behavior.

## 7. Edge Cases & Error Handling

- `board` is null or still loading: do not render the command bar; do not read `statuses` or URL values until a board exists.
- Empty `statuses`: render no status-specific pills, keep `All`, and leave Kanban’s existing empty-columns message intact.
- Empty task name/description or missing fields: match safely as `''`; do not render raw HTML, so task text remains XSS-safe through React escaping.
- Query whitespace: preserve the input draft for user feedback but trim only for matching and URL serialization; whitespace-only query clears `q`.
- URL encoding: use `URLSearchParams`; never concatenate query strings manually. Decode malformed percent encoding through the router API and fall back to empty values if necessary.
- Unknown, stale, ambiguous, or removed `f`: show `All`, clear the store filter, and remove `f` with `replace: true`; never invent a status or filter by a similarly named status.
- Status rename while filtered: the store’s exact status no longer exists; clear the filter and canonicalize the URL rather than hiding tasks unexpectedly.
- New status/task arrives through an optimistic store update: derived results and pill counts recalculate automatically; no API request is needed for search.
- A task is dragged while filtered: use the full task list for source/target resolution and preserve the filter after the optimistic update; the task may leave the visible set if its status changes.
- Debounce cleanup: cancel the timeout on unmount and on a subsequent keystroke; do not update an unmounted component.
- Shortcut in an editable context: `Cmd/Ctrl+K` is intentionally reserved for the board command bar, but `preventDefault()` prevents browser bookmark/search behavior. `Esc` first closes the command bar and must not submit or mutate a task form.
- Focus trap and backdrop: clicks/focus inside the dialog do not close it; backdrop click and `focusin` outside close it and return focus to the trigger. If the trigger is no longer mounted, focus `document.body` safely.
- No matching tasks: keep all board columns visible, show `No tasks match` and a `Clear filters` button, and make the clear action reset both store values and URL values.
- No backend error path is introduced. Existing board-fetch errors continue through `BoardPage`’s current `role="alert"` banner and the documented frontend error strategy.

## 8. Testing Strategy

Add at least 12 new tests using Vitest, `@testing-library/react`, `@testing-library/user-event`, fake timers, and a memory router. Suggested minimum cases (14):

1. Closed trigger renders and exposes an accessible name.
2. `Cmd+K` opens the bar and focuses the input.
3. `Ctrl+K` opens the bar on a non-Mac event.
4. `Escape` closes and returns focus to the trigger.
5. Backdrop click closes; panel click does not.
6. Focus cannot tab outside the dialog while open.
7. Typing matches task name case-insensitively after exactly 150 ms.
8. Typing matches description and does not update before the debounce expires.
9. Rapid typing cancels the prior debounce timer.
10. Status pills derive from arbitrary `board.statuses`, not a fixed three-item list.
11. Status selection filters by exact status and updates `?f=` with the canonical key.
12. `All` removes `f`; `Clear filters` removes both `q` and `f`.
13. Initial `?q=...&f=...` hydrates the store and visible tasks after board load.
14. Unknown/alias status keys resolve safely, URL sync uses `replace`, and combined query + status filtering yields the expected result/counts.

Also add store-level tests in `client/src/__tests__/search-store.test.js` for name/description OR matching, missing fields, empty status lists, filtered column counts, and derived recalculation after optimistic task/status changes. Extend the existing `BoardPage`/routing fixtures only where needed. Run all existing tests (the issue reports 71), `npm test --workspace=client`, and `npm run build --workspace=client`. Since axe is not installed, manually run axe DevTools/extension against the open dialog in both themes; do not add `axe-core` or `@axe-core/react` in this issue.

## 9. Acceptance Criteria

- [ ] `Cmd/Ctrl+K` opens the command bar and focuses its input.
- [ ] `Esc`, backdrop click, and focus outside close it; focus returns to the trigger.
- [ ] Search matches `task.name` or `task.description` case-insensitively after a 150 ms dependency-free debounce.
- [ ] Pills contain `All` and every board-defined status, including arbitrary status arrays.
- [ ] `?q=` and canonical `?f=` values survive reload, deep links, and browser navigation without router coupling in Zustand.
- [ ] Status counts are live and based on the current query-matched set; column counts shrink with the visible filtered tasks.
- [ ] `filteredTasks` is derived in Zustand and consumed by Kanban; full tasks remain available to drag logic.
- [ ] No-result state says `No tasks match` and provides a working `Clear filters` button.
- [ ] Dialog semantics, `aria-*`, keyboard behavior, focus handling, and existing `surface-*`/`status-*`/`ring-primary` tokens are implemented.
- [ ] At least 12 new tests (target 14) cover shortcut, debounce, status filtering, URL sync, clear, and combinations; all existing tests pass.
- [ ] `vite build` and client lint pass.
- [ ] Manual axe scan reports no critical or serious violations; no axe dependency is added.
- [ ] No backend, API wrapper, schema, or serverless deployment change is required.

## 10. Out of Scope

- Backend endpoints, server routes, Mongoose schemas, database indexes, or server-side search.
- Saved views, named filters, cross-board search, archived-board search, and Activity Feed filtering (follow-up #21).
- Alternative list/grid/table views from #26/#27; this plan exposes the shared store-derived filter for them to consume later.
- Search highlighting, fuzzy matching, ranking, pagination, or URL history entries for every keystroke.
- Adding `axe-core` or `@axe-core/react`; accessibility is manually verified for this issue.
- New design tokens, a CSS stylesheet, or changes to `client/src/lib/api.js`.

## 11. Risks & Open Questions

- **Status URL compatibility:** Product should confirm whether the documented examples `f=progress` and `f=completed` must remain accepted when a board uses custom labels. Recommendation: accept the aliases above but serialize board-specific canonical slugs.
- **Focus behavior:** Product should confirm that the command bar is modal-like with a backdrop and focus trap. Recommendation: yes, because the issue explicitly requires backdrop close and focus return; focus outside closes it.
- **Counts semantics:** Product should confirm that every pill count is scoped to the text query but not the selected status. Recommendation: this makes alternate statuses discoverable and gives live useful counts.
- **URL typing behavior:** Product should confirm that `q` updates after 150 ms with `replace: true`, not on every keystroke. Recommendation: debounced replace avoids history pollution while keeping shareable state current.
- **Dynamic status collisions:** Two labels can normalize to the same slug. Recommendation: disambiguate generated links and reject ambiguous incoming keys rather than silently selecting one.
- **Future views:** #26/#27 must consume the same store-derived `filteredTasks` contract; they must not reimplement search in components.
- **Accessibility tooling:** The acceptance text asks for an axe scan, but no axe dependency exists. Recommendation: manual axe DevTools/extension now; schedule automated axe integration as a separate quality issue if CI enforcement is required.
