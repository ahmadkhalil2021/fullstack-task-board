# Implementation Plan — Issue #13: Manage board statuses in the UI

## 1. Summary

Add a status-management UI to `BoardHeader` so board owners can add, rename, and remove board-level statuses. Changes are persisted through the existing `updateBoard` store action, which calls `PUT /api/boards/:boardId`. Removal is blocked when tasks still use the status, and the schema constraint that at least one status must remain is enforced in the UI.

## 2. Architecture & Design Decisions

| # | Decision | Recommended Option | Rationale |
|---|----------|-------------------|-----------|
| 1 | UI container | **B — Modal/dialog opened from a button** | Keeps `BoardHeader` clean; status management is an infrequent power-user action. A dialog also gives room for validation messages without cluttering the board view. |
| 2 | Add new status | **A — "Add status" button at bottom of status list** | Clear, one-click affordance. Simpler than an always-visible inline input and avoids accidental empty rows. |
| 3 | Rename status | **A — Click on status name → inline edit** | Direct manipulation; matches the existing board-name edit pattern in `BoardHeader`. |
| 4 | Remove status | **B — Trash icon button + modal confirmation** | Explicit and safe. Prevents accidental deletion better than a tooltip-only × button. |
| 5 | Validation | **Inline message + disabled remove** | If a status has tasks, show "Move X tasks before removing" and disable the trash button. If it is the last status, disable remove (schema requires ≥1). Empty/duplicate names are invalid. |
| 6 | Reorder support | **Skip for Issue #13** | Out of scope; can be added later without changing the data model because `statuses` is already an ordered array. |

## 3. State Machine / Flow

```
User opens status manager
        │
        ▼
Local draftStatuses initialized from board.statuses
        │
        ▼
┌─────────────────────────────────────┐
│ Add / Rename / Remove (local only)  │
│ • Validate duplicates & empties     │
│ • Block remove if tasks exist       │
│ • Block remove if last status       │
└─────────────────────────────────────┘
        │
        ▼
On blur (rename) or confirm (remove/add)
        │
        ▼
Call useBoardStore.updateBoard({ statuses: draftStatuses })
        │
        ▼
┌─────────────────────────────────────┐
│ Optimistic update in Zustand        │
│ Rollback on API failure             │
└─────────────────────────────────────┘
        │
        ▼
Show inline error or close dialog on success
```

## 4. API Contract

Use the existing endpoint:

```
PUT /api/boards/:boardId
Content-Type: application/json

Body: { statuses: string[] }

Response 200:
{
  "data": {
    "board": {
      "_id": "...",
      "name": "...",
      "statuses": [...],
      "tasks": [...]
    }
  }
}
```

Validation already exists in `server/routes/boards.js`:

- `statuses` must be a non-empty array
- Each status must be a non-empty string

No backend changes are required for this issue.

## 5. File Changes

| File | Change |
|------|--------|
| `client/src/components/BoardHeader.jsx` | Add a gear/settings button that opens the status manager dialog |
| `client/src/components/StatusManager.jsx` | **New component** — dialog with add/rename/remove status UI |
| `client/src/store/useBoardStore.js` | No change; reuse existing `updateBoard` action |
| `server/routes/boards.js` | No change; endpoint already supports `{ statuses }` |
| `server/models/Board.js` | No change; schema already supports custom statuses |
| `docs/adr/0007-board-level-statuses.md` | No change; ADR already recommends blocking removal |

## 6. Implementation Steps

1. Create `client/src/components/StatusManager.jsx`
   - Accept `isOpen`, `onClose`, `board`, and `onSave` props
   - Initialize `draftStatuses` from `board.statuses`
   - Render each status as an inline-editable row
   - Count tasks per status from `board.tasks`
   - Show validation errors per row
   - Implement add/remove handlers
2. Add a settings/gear button to `BoardHeader.jsx` next to `ThemeToggle`
3. Wire the button to open `StatusManager`
4. In `StatusManager`, call `updateBoard({ statuses })` on save/blur
5. On API error, show the error inline and keep the dialog open; the store rollback will restore the previous state
6. Add basic styling with Tailwind utility classes matching the existing theme

## 7. Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| Rename creates a duplicate | Mark the row invalid, disable save, show "Status names must be unique" |
| Rename to empty string | Mark invalid, revert on blur or show "Status name is required" |
| Remove last status | Disable remove button with tooltip "A board must have at least one status" |
| Remove status with tasks | Disable remove button, show "Move N task(s) before removing" |
| API fails | Store rolls back via existing `updateBoard` logic; dialog shows error and stays open |
| User closes dialog with unsaved changes | Prompt confirmation if local draft differs from persisted state (optional, can be deferred) |

## 8. Testing Strategy

- **Manual smoke test**: add, rename, remove statuses on a fresh board
- **Validation test**: try removing a status that contains tasks; verify button is disabled
- **API failure test**: block the network request and confirm rollback restores previous statuses
- **Regression test**: ensure `addTask` still places new tasks in `board.statuses[0]`
- **Accessibility check**: dialog traps focus, buttons have `aria-label`, inputs have labels

## 9. Acceptance Criteria

- [ ] A button in `BoardHeader` opens the status manager dialog
- [ ] Users can add a new status to the board
- [ ] Users can rename an existing status inline
- [ ] Users can remove an existing status after confirming a modal
- [ ] Removing a status is blocked when tasks exist in that status
- [ ] Removing the last status is blocked
- [ ] Duplicate or empty status names are rejected in the UI
- [ ] Changes are persisted via `PUT /api/boards/:boardId`
- [ ] API failures roll back the UI to the previous state
- [ ] Existing tasks continue to display in the correct column after status changes

## 10. Out of Scope

- Drag-and-drop reordering of statuses
- Cascading task status changes on status removal
- Permissions / read-only mode for non-owners
- Animations or advanced transitions in the dialog

## 11. Risks & Open Questions

| Risk | Mitigation |
|------|------------|
| Renaming a status moves existing tasks visually because columns are rendered by status string | Expected behavior; tasks keep their `status` value and the column header changes. Document in UI copy if needed. |
| Dialog state can drift from store after rollback | On `updateBoard` error, re-sync `draftStatuses` from `board.statuses` (same pattern used for `draftName` in `BoardHeader`). |
| Multiple rapid renames may fire many API requests | Debounce blur saves by ~300 ms, or batch until explicit save. For the first iteration, simple blur-save is acceptable. |

### Open Questions

1. Should renaming a status also update the `status` field of all tasks that use it? **Recommendation: no.** The board-level status is a label; tasks reference it by string. Changing the label changes the column name but preserves task state.
2. Should the dialog close automatically after a successful save? **Recommendation: no.** Keep it open so users can make multiple edits; close only via the explicit close button or cancel action.
