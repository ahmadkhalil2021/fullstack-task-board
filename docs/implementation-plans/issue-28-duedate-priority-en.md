# Issue #28 — Extend Task schema with dueDate and priority

## 1. Summary

Add optional `dueDate` and `priority` fields to every task, validate and serialize them through the Express API, backfill existing MongoDB documents safely, and expose both fields on the Odoo-style task detail page and task cards. The change keeps the existing Flux flow (`UI → Zustand store → API`), optimistic updates, serverless entry point, and the current `kanban`, `grid`, and `table` surfaces intact. No dependency, calendar view, reminder, or `TaskForm.jsx` is introduced.

## 2. Architecture & Design Decisions

- **Schema:** Add `dueDate: { type: Date, default: null, index: true }` and `priority: { type: String, enum: ['none', 'low', 'medium', 'high'], default: 'none' }` to `server/models/Task.js:8-41`. MongoDB stores dates as BSON dates; Mongoose serializes them as ISO strings in JSON. `null` is the explicit no-date value.
- **Validation boundary:** Validate request types and ISO date parseability in `server/routes/tasks.js:18-55` and `:64-134`, before persistence. Keep `priority` enum validation in both the route (for the established `VALIDATION_ERROR`/400 response) and the schema (`runValidators: true` as defense in depth). Accept only strings that parse to a finite `Date`; accept `null`; reject empty strings, numbers, and invalid dates.
- **Partial update semantics:** In PUT, distinguish an absent `dueDate` from `dueDate: null`; the former leaves the value unchanged and the latter clears it. Include `dueDate` and `priority` in the response exactly as persisted.
- **Migration:** Add `server/scripts/migrate-task-fields.js` as an importable `migrateTaskFields` function plus a CLI entry point. Iterate raw task documents and issue `$set` only for missing fields, log each changed `_id` and the total, and make the second run report zero changes. Do not change `server/dev.js:10-30`: its MongoMemoryServer is process-local and data disappears when the dev process stops. The command is useful against `MONGODB_URI`; document that production execution requires an explicit real database and maintenance/backup decision.
- **Client contract:** Keep `client/src/lib/api.js:35-49` thin and generic, but add JSDoc describing `dueDate` as `YYYY-MM-DD`/ISO input or `null` and `priority` as the four-value enum. `useBoardStore` remains the only caller from UI; preserve the existing snapshot/rollback behavior at `client/src/store/useBoardStore.js:121-184` and `:332-391`.
- **Detail form:** Extend `client/src/pages/TaskDetailPage.jsx:40-101` with local `dueDate` and `priority` state. Use `<input type="date">` with an empty value mapped to `null`; submit date-only values without timezone conversion. Use an accessible `radiogroup` with keyboard-focusable buttons for priority. The existing Save/Discard flow saves these fields; statusbar changes remain immediate.
- **Presentation:** Create `client/src/lib/priority.js` with a shared `priorityColor` token mapping and safe fallback. `TaskCard` gets a date chip and a non-color-only priority indicator. Recommendation: add `Priority` and `Due date` sortable columns to `TableView`, because the issue's “what's due when/most important” goal must be usable without opening each card; retain Created/Updated and make null dates sort last in either direction. This is a product decision (see section 11).
- **Date policy:** Format display with `Intl.DateTimeFormat` and a fixed, documented locale strategy (`en-US`, `month: 'short', day: 'numeric'`) so `2026-08-30` renders consistently as `Aug 30`; parse only valid values and render no chip/cell for `null` or invalid legacy data. Overdue means a valid due date before the current local calendar day; use an additional text/ARIA label and danger token, not color alone.
- **Security and compatibility:** Continue rendering task values as React text (no `dangerouslySetInnerHTML`), validate all new input server-side, avoid query-string execution, and preserve defaults for old and newly created tasks. No new dependency is needed.

## 3. State Machine / Flow

### Detail-page state

```text
Task loaded
  → local dueDate = task.dueDate ? YYYY-MM-DD : ''
  → local priority = task.priority || 'none'
  → user edits date/priority
  → dirty (Save + Discard enabled)
  → Save
      → store snapshot
      → optimistic task patch
      → PUT /api/tasks/:taskId
          → success: replace task with server serialization, Saved state
          → failure: rollback snapshot, show existing error banner, retain editable values
  → Discard → restore task values and clear dirty state
```

### Create and board flow

```text
Add task
  → addTask creates optimistic task with dueDate: null, priority: 'none'
  → POST /api/tasks
      → success: replace temporary task with serialized task
      → failure: rollback board and expose error
```

### Migration flow

```text
npm run migrate:task-fields
  → load dotenv + connectDB (MONGODB_URI)
  → iterate tasks
  → $set only missing dueDate/priority defaults
  → log changed ids and count
  → disconnect
```

## 4. API Contract

Reference implementation: `server/routes/tasks.js:18-134`; response envelope remains `docs/api-contract.md:8-32`.

### `POST /api/tasks`

- **Body:** Existing required `status`, `parentBoardId`; existing optional fields plus `dueDate` (ISO 8601 string or `null`) and `priority` (`none | low | medium | high`).
- **Success:** `201 { data: { task } }`; `task.dueDate` is an ISO JSON date string or `null`, and `task.priority` is always one of the enum values.
- **Errors:** `400 VALIDATION_ERROR` with `dueDate must be a valid ISO date or null` or `priority must be one of: none, low, medium, high`; preserve existing missing-board/status/order messages and `404 NOT_FOUND` for a missing parent board.

### `PUT /api/tasks/:taskId`

- **Body:** Any existing partial fields plus optional `dueDate` and `priority`; `dueDate: null` clears the date.
- **Success:** `200 { data: { task } }` with the same serialization.
- **Errors:** `400 VALIDATION_ERROR` for invalid new values or an empty update; `404 NOT_FOUND` for a missing task/parent board. Mongoose validation failures must continue through the existing error middleware as `VALIDATION_ERROR`/400.

Suggested route validation helper (copyable, no new dependency):

```js
const PRIORITIES = ['none', 'low', 'medium', 'high']

const validateTaskFields = ({ dueDate, priority }) => {
  if (dueDate !== undefined && dueDate !== null) {
    if (typeof dueDate !== 'string' || Number.isNaN(new Date(dueDate).getTime())) {
      throw validationError('dueDate must be a valid ISO date or null')
    }
  }
  if (priority !== undefined && !PRIORITIES.includes(priority)) {
    throw validationError('priority must be one of: none, low, medium, high')
  }
}
```

The route must call this helper for both POST and PUT, include the fields in `Task.create`/`update`, and let `res.json({ data: { task } })` serialize them.

## 5. File Changes

- **Modify** `server/models/Task.js:8-41` — add the indexed nullable date and enum priority defaults.
- **Modify** `server/routes/tasks.js:18-134` — validate and pass fields for POST/PUT; include field changes in activity metadata where the existing route records updates.
- **Create** `server/scripts/migrate-task-fields.js` — exported idempotent migration and executable CLI.
- **Modify** `server/package.json:7-10` — add `"migrate:task-fields": "node scripts/migrate-task-fields.js"`.
- **Modify** `client/src/lib/api.js:35-49` — JSDoc and explicit contract forwarding for `createTask`/`updateTask`.
- **Modify** `client/src/store/useBoardStore.js:121-184,332-391` — carry defaults/new fields through optimistic create/update, rollback, and server replacement.
- **Modify** `client/src/pages/TaskDetailPage.jsx:40-101,236-280` — date input, priority segmented control, dirty/discard/save handling, and accessible validation state.
- **Create** `client/src/lib/priority.js` — enum labels, `priorityColor`, and safe display/date helpers if shared there.
- **Modify** `client/src/components/TaskCard.jsx:37-73` — date chip, overdue state, and priority dot with accessible labels.
- **Modify** `client/src/views/TableView.jsx:11-81,140-201` — product-approved Priority/Due date columns and null/invalid-safe sort/rendering.
- **Modify** `client/tailwind.config.js:29-105` — safelist only if the selected priority tokens are dynamic; reuse existing tokens where possible.
- **Modify** `server/__tests__/tasks.test.js` — endpoint validation and round-trip coverage.
- **Create** `server/__tests__/migrate-task-fields.test.js` — migration defaults, logging, idempotence, and injected-model testability.
- **Modify** `client/src/__tests__/task-detail.test.jsx` — date/priority controls and save/discard/error cases.
- **Create** `client/src/__tests__/use-board-store.test.js` — optimistic round-trip and rollback.
- **Create** `client/src/__tests__/task-card.test.jsx` — chip/dot/overdue and invalid/null rendering.
- **Modify** `client/src/__tests__/table-view.test.jsx` — approved columns, sorting, and sessionStorage compatibility.

## 6. Implementation Steps

1. Update `server/models/Task.js` and `server/routes/tasks.js` with fields, shared validation, POST/PUT forwarding, serialized responses, and activity field diffs.
2. Create `server/scripts/migrate-task-fields.js` and update `server/package.json`; make the migration injectable for tests and safe with both `MONGODB_URI` and the in-memory dev database caveat.
3. Extend `server/__tests__/tasks.test.js` and create `server/__tests__/migrate-task-fields.test.js`; verify the complete server suite before client work.
4. Update `client/src/lib/api.js` and `client/src/store/useBoardStore.js`; add JSDoc, default values for optimistic creates, field-preserving optimistic updates, rollback, and server replacement.
5. Add `client/src/lib/priority.js` and update `client/src/pages/TaskDetailPage.jsx`; implement date normalization, segmented priority control, keyboard/focus behavior, dirty state, Save/Discard, and error handling.
6. Update `client/src/components/TaskCard.jsx` and, after product confirmation, `client/src/views/TableView.jsx` plus `client/tailwind.config.js`; keep Grid/Kanban reuse through `TaskCard` and do not add a separate view component.
7. Extend `client/src/__tests__/task-detail.test.jsx`, add store/card tests, and update table tests; run the full 168-client/50-server baseline plus the new tests and `vite build`.

## 7. Edge Cases & Error Handling

- Missing fields on old documents render as `null`/`none` even before migration; migration makes those values explicit.
- `dueDate: null` clears a date; omitted `dueDate` does not change it; `''`, malformed ISO strings, non-strings, and non-finite dates return `400 VALIDATION_ERROR`.
- HTML date inputs emit `YYYY-MM-DD`; keep that date-only value stable and do not use `new Date('YYYY-MM-DD').toISOString()` for form state because timezone conversion can shift the day.
- `priority` is case-sensitive and enum-bound; invalid values are rejected before update, and schema validation remains a second defense.
- Invalid/null legacy dates never crash rendering, sorting, or `Intl.DateTimeFormat`; hide the chip/cell and sort null/invalid due dates last.
- Overdue is evaluated against the local calendar day, excludes today, and is conveyed with text/ARIA (`Overdue`) as well as a danger token.
- Existing task creation keeps `dueDate: null` and `priority: 'none'`; no API caller should rely on undefined values.
- Save failures follow `docs/error-handling.md:45-59`: restore the previous board snapshot, set the existing error banner, and re-enable controls. The detail form must not claim Saved on failure.
- Rapid Save/status interactions remain blocked by existing `isSaving`/`isStatusSaving`; Discard restores all four local editable values.
- Migration is idempotent and logs zero changes on the second run. It must not silently target the ephemeral MongoMemoryServer; fail clearly when `MONGODB_URI` is absent and log the target context.
- React text rendering remains XSS-safe; no raw HTML or new client dependency is permitted.

## 8. Testing Strategy

### Server (at least 6 new tests; target 9)

In `server/__tests__/tasks.test.js`:

1. `Task` model defaults a new task to `dueDate: null` and `priority: 'none'`.
2. POST accepts a valid ISO `dueDate` and each valid priority and returns both fields.
3. POST accepts `dueDate: null` and applies priority default when omitted.
4. POST rejects malformed/non-string due dates with `400 VALIDATION_ERROR`.
5. POST rejects invalid priority with `400 VALIDATION_ERROR`.
6. PUT round-trips a date and priority, then a second PUT with `dueDate: null` clears the date.
7. PUT rejects malformed dates and invalid priority without changing the task.

In `server/__tests__/migrate-task-fields.test.js`:

8. An injected model migrates documents with missing fields, logs changed IDs/count, and leaves existing values unchanged.
9. Running the migration twice yields zero changes on the second run.

Use the existing Node test runner, `mongodb-memory-server`, and `supertest` setup. Test the migration's exported function with a model/collection injection rather than spawning a process; test the CLI separately only for exit/connect behavior if needed.

### Client (at least 4 new tests; target 8+)

- `client/src/__tests__/task-detail.test.jsx`: renders date input and four priority radios; changes are dirty; Save sends `YYYY-MM-DD` and selected priority; clearing sends `dueDate: null`; keyboard/focus and `aria-checked` work; failed save leaves error/does not show Saved.
- `client/src/__tests__/use-board-store.test.js`: update round-trip preserves date/priority from API; optimistic update is immediate; rejected API restores the exact prior task and sets the error; addTask sends `null`/`none` defaults.
- `client/src/__tests__/task-card.test.jsx`: valid date chip uses `Intl` output; null/invalid dates render safely; overdue has text/ARIA plus danger token; priority dot appears only for non-`none` and exposes its label.
- `client/src/__tests__/table-view.test.jsx`: approved columns render, sort valid values, place null/invalid dates last, preserve existing `aria-sort`, and restore old sessionStorage sort state.

Run the existing 168 client and 50 server tests without modifying their expectations unnecessarily, then run `npm test` in each workspace and `npm run build --workspace=client`/the repository's existing `vite build` command.

## 9. Acceptance Criteria

- [ ] `Task` has indexed nullable `dueDate` and enum `priority` with the specified defaults.
- [ ] POST and PUT validate both fields with established `400 VALIDATION_ERROR` envelopes and round-trip serialized values.
- [ ] `dueDate: null` clears a date, omitted fields remain unchanged, and invalid input cannot mutate a task.
- [ ] `npm run migrate:task-fields` connects through `MONGODB_URI`, logs changed documents/count, is idempotent, and is unit-testable through an exported function.
- [ ] Existing tasks and new tasks render with safe `null`/`none` defaults; in-memory dev DB behavior is documented.
- [ ] `api.createTask`/`api.updateTask` and `useBoardStore.addTask`/`updateTask` carry the fields with JSDoc and optimistic rollback.
- [ ] `TaskDetailPage` replaces the obsolete `TaskForm` scope with a date input and accessible keyboard-operable priority segmented control.
- [ ] Save/Discard, immediate status saves, validation, network errors, and rollback behave consistently with existing UX.
- [ ] `TaskCard` displays safe date and priority surfaces, including an accessible overdue state.
- [ ] The product decision on TableView is recorded; if approved, Priority and Due date are sortable and null-safe.
- [ ] At least 6 server and 4 client tests are added; all 168 existing client and 50 existing server tests pass.
- [ ] No new dependency, Calendar view (#29), reminder, notification, or raw HTML rendering is added; client build is clean.

## 10. Out of Scope

- Calendar view (#29), recurring tasks, reminders, notifications, filtering UI, and server-side reminder jobs.
- Authentication/authorization changes, board-status redesign, new persistence technology, or API versioning.
- A `TaskForm.jsx` component: the existing `TaskDetailPage.jsx` is the only task editor.
- Backfilling inferred historical due dates/priorities; migration only applies explicit defaults.
- New npm dependencies or a transaction/maintenance orchestration system beyond documenting the production run decision.

## 11. Risks & Open Questions

### Risks

- A production migration can touch many documents and create an index; take a backup, run against the intended `MONGODB_URI`, observe logs, and use a maintenance window if required. The simple per-document migration is idempotent but is not an all-or-nothing transaction.
- Date-only values can shift day when converted through UTC; keeping `YYYY-MM-DD` in the client and using a local-calendar overdue comparison avoids that UI bug.
- Dynamic Tailwind classes can be purged; use static/safelisted priority tokens and verify the production build.
- Optimistic activity currently records name/description/icon diffs only; adding date/priority diffs must not duplicate server activity or break existing feed consumers.

### Questions for Product

- **TableView:** approve the recommendation to add sortable `Priority` and `Due date` columns? Proposed order: `Name | Status | Priority | Due date | Created | Updated`.
- **Overdue styling:** approve danger styling plus explicit `Overdue` text/ARIA, with today treated as not overdue?
- **Locale:** approve fixed `en-US` `Intl.DateTimeFormat` output (`Aug 30`), or should the browser/user locale be used?
- **Migration operations:** which environment/maintenance window should run `npm run migrate:task-fields`, and is a backup/rollback procedure required by deployment?
- **Activity feed:** should date/priority changes be displayed as activity entries, or only persisted without a new activity type?
