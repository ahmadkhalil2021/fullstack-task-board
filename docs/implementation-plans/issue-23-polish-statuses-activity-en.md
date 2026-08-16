# Implementation Plan — Issue #23: Polish status manager and activity feed

## 1. Summary

Polish the existing `StatusManager` modal and `ActivityFeed` sidebar so both feel intentional, readable, and consistent with the existing glass UI. The pass replaces emoji glyphs with inline SVG icons, improves responsive spacing and hierarchy, clarifies the status-removal confirmation, and strengthens loading, empty, error, and pagination states. It remains a frontend-only quick iteration: no new features, API changes, backend work, or runtime dependencies.

## 2. Architecture & Design Decisions

| # | Decision | Recommended Option | Rationale |
|---|----------|-------------------|-----------|
| 1 | Icon implementation | **Inline SVG icon components inside the existing files** | Removes OS-dependent emoji rendering without adding a dependency or inventing a new shared path. Keep the icon set small and local to this 30–60 minute pass. |
| 2 | Status row layout | **Responsive two-zone row with a flexible name area and grouped actions** | Gives the input and validation content usable width while preserving 44px touch targets. The action group can shrink or wrap on narrow screens without changing behavior. |
| 3 | Removal confirmation | **A distinct full-width confirmation panel inside the selected row** | Separates the destructive decision from normal editing, gives the copy room to explain the actual save behavior, and avoids the misleading “Move tasks” wording. |
| 4 | Status modal surface | **TaskForm-style modal surface with restrained translucency and stronger hierarchy** | `TaskForm.jsx:100-121` already provides the project’s modal pattern. Use the existing `glass`, `glass-dark`, and `glass-sm` tokens while reducing the muddy overlay effect over the board gradient. |
| 5 | Activity sidebar width | **Increase the desktop width from `w-80` to a readable `w-96` with a viewport cap** | A 384px content area gives descriptions and timestamps room to breathe while remaining a sidebar. The mobile bottom-sheet behavior stays unchanged. |
| 6 | Activity item treatment | **Stacked glass cards with spacing, not `border-b` dividers** | Cards create clear grouping and improve scanability without introducing a new interaction or data model. |
| 7 | Loading, empty, and error UX | **Larger card-shaped skeletons, illustrated SVG empty state, and consistent action buttons** | These states should occupy the panel intentionally and use the same hierarchy as loaded content. Existing retry and store flows remain unchanged. |
| 8 | State and data flow | **Keep Zustand as the single source of truth and preserve existing actions** | The visual pass must not bypass `useBoardStore`, add local API calls, or alter optimistic update behavior. |

## 3. State Machine / Flow

### 3.1 Status manager visual flow

```
Status manager opens
        │
        ▼
Draft statuses render with SVG controls
        │
        ├─ Edit name ──► validate ──► commit on blur / Enter
        │
        ├─ Select remove ──► confirmation panel
        │                         │
        │                         ├─ Cancel ──► normal row
        │                         └─ Remove ──► remove from local draft
        │
        └─ Add status ──► new editable row
                                  │
                                  ▼
                          Save through updateTask/updateBoard
                                  │
                   ┌──────────────┴──────────────┐
                   ▼                             ▼
              Success: close              Failure: show error,
                                           restore draft, stay open
```

### 3.2 Activity feed visual flow

```
Sidebar opens
      │
      ▼
Read activity state from useBoardStore
      │
      ├─ Loading with no items ──► card skeleton stack
      ├─ Error ───────────────────► error panel + Retry button
      ├─ Empty ───────────────────► SVG empty state + guidance
      └─ Items ───────────────────► SVG icon cards + relative time
                                      │
                                      └─ Load more ──► existing cursor fetch
```

No state transitions, store actions, or API sequencing change in this plan.

## 4. API Contract

No API changes.

`StatusManager` continues to use the existing store actions that ultimately call `PUT /api/boards/:boardId` and the task update route when necessary. `ActivityFeed` continues to use `useBoardStore.fetchActivity`, which consumes `GET /api/boards/:boardId/activity` with the existing `limit` and `before` cursor contract defined in `server/routes/activity.js` and `docs/api-contract.md`.

Response shapes, error handling, optimistic updates, and pagination remain unchanged.

## 5. File Changes

| File | Change |
|------|--------|
| `client/src/components/StatusManager.jsx` | Replace emoji and text glyph controls with inline SVG icons; rebalance row spacing and input layout; move validation into a stable message area; refine modal/header hierarchy and glass surfaces; replace the inline removal wording with a proper confirmation panel. |
| `client/src/components/ActivityFeed.jsx` | Replace activity emoji mapping and empty-state glyph with inline SVG icons; increase desktop sidebar width; render activity items as glass cards; enlarge skeletons; style “Load more”, empty, and error states as intentional panel content. |
| `client/src/__tests__/status-manager.test.jsx` | Preserve behavior assertions and add or update assertions for the confirmation copy, SVG control accessibility, and stable validation rendering. |
| `client/src/__tests__/activity-feed.test.jsx` | Preserve store and content assertions and add or update assertions for SVG icon accessibility, card states, and the styled pagination action. |
| `client/tailwind.config.js` | No change; reuse the existing `glass`, `glass-dark`, `glass-sm`, and `shadow-glass` tokens already available. |
| `server/routes/activity.js` | No change; existing activity API remains the source of feed data. |

## 6. Implementation Steps

1. Update `client/src/components/StatusManager.jsx` icon definitions and modal/header classes.
   - Add small inline SVG components for close, move up, move down, remove, and the status-management header accent.
   - Keep every interactive SVG `aria-hidden="true"`; retain the existing button `aria-label` values so current behavior remains accessible.
   - Match the modal surface proportions and close-button treatment used by `TaskForm.jsx:100-121`, while using less opaque layering over the page gradient.
2. Update `client/src/components/StatusManager.jsx` status rows and confirmation panel.
   - Give the editable name area and task-count metadata a clear hierarchy, and keep controls in a grouped action area with 44px targets.
   - Render validation text in a dedicated block below the input and keep the character counter aligned independently.
   - Replace “Move tasks to X?” with explicit removal copy, for example “Remove ‘X’?” and “Tasks in this stage will be reassigned when you save.” The existing task-count guard remains authoritative, so stages containing tasks stay non-removable.
   - Preserve add, rename, reorder, save, rollback, and focus behavior.
3. Update `client/src/components/ActivityFeed.jsx` icons and sidebar shell.
   - Replace `ICONS` emoji values with a small SVG icon map or typed icon components for each existing activity type, plus a neutral fallback.
   - Keep `ActivityIcon` and `CloseIcon` consistent with the new icon sizing and color treatment.
   - Change only the desktop width constraint to a readable `w-96`/viewport-capped equivalent; preserve the mobile bottom sheet and slide transitions.
4. Update `client/src/components/ActivityFeed.jsx` content states and tests.
   - Convert list rows to separated glass cards with consistent padding, icon containers, text wrapping, and hover/focus states.
   - Replace tiny skeleton rows with larger card-shaped skeletons that mirror loaded item geometry.
   - Replace the emoji empty state with an SVG illustration and supporting text; make “Load more” a full-width, clearly bordered or filled button using existing Tailwind tokens.
   - Update `client/src/__tests__/status-manager.test.jsx` and `client/src/__tests__/activity-feed.test.jsx` only where selectors or new state assertions require it; do not weaken existing behavior coverage.
5. Run the focused component tests and perform a responsive light/dark manual smoke test.
   - Verify no backend, store, or API files are modified by the implementation.

## 7. Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| Narrow viewport in `StatusManager` | Use flexible layout, wrapping where necessary, and preserve 44px controls; do not allow the input or confirmation actions to become horizontally clipped. |
| Long stage name or validation message | Keep `maxLength` and existing validation; place the message below the input so it cannot overlap the counter or action group. |
| Status removal with tasks | Keep the remove button disabled and retain the existing task-count title. The confirmation panel is only reachable for removable stages. |
| Last status | Keep removal disabled with the existing last-status title and no new destructive path. |
| Save failure | Preserve `updateTask`/`updateBoard` error handling, rollback, inline error visibility, and modal-open behavior. |
| Activity description is long | Allow normal wrapping inside the wider card; do not truncate meaningful activity text. |
| Activity type is unknown | Render the neutral SVG fallback and existing `describeActivity` fallback text rather than a broken icon or emoji. |
| Loading while older items exist | Keep the existing list visible and avoid replacing it with the initial skeleton; the larger skeleton applies only when `activity.length === 0`. |
| Empty or failed activity request | Preserve the existing empty and retry branches; improve presentation only and keep `clearActivityError`/`fetchActivity` wiring unchanged. |
| No more activity pages | Keep “Load more” hidden when `activityHasMore` is false. |
| Dark mode | Pair every new surface, icon, focus, and text treatment with the existing `dark:` variants; avoid relying on emoji color. |

## 8. Testing Strategy

1. **Focused component tests**
   - Run `client/src/__tests__/status-manager.test.jsx` and `client/src/__tests__/activity-feed.test.jsx` with the existing Vitest command.
   - Keep all current assertions for add, rename, validation, remove confirmation, save, rollback, store pagination, descriptions, loading, and empty states.
2. **Status manager additions or selector updates**
   - Assert the confirmation panel uses removal/reassignment wording rather than “Move tasks to”.
   - Assert icon buttons retain their accessible names and contain SVG elements, while no emoji glyph is required for controls.
   - Assert validation remains visible in a dedicated alert region and does not prevent the existing duplicate-name behavior.
3. **Activity feed additions or selector updates**
   - Assert activity items render the expected text and an SVG icon/fallback with `aria-hidden="true"`.
   - Assert loading, empty, error, and “Load more” states remain discoverable by role and accessible name.
4. **Manual responsive and accessibility smoke test**
   - Check both components at mobile width and desktop width in light and dark mode.
   - Confirm focus rings, button labels, modal/sidebar Escape behavior, wrapping, and no horizontal clipping.
   - Confirm the existing `useBoardStore` calls and network requests are unchanged.

## 9. Acceptance Criteria

- [ ] `StatusManager` contains no emoji or text-glyph move/remove controls; actions use consistent inline SVG icons.
- [ ] `StatusManager` rows provide readable space for the name/input, metadata, and action group at narrow and desktop widths.
- [ ] Validation text has a stable dedicated layout and does not collide with the character counter.
- [ ] The status modal has a clear header accent/icon, hierarchy, and a restrained glass surface consistent with `TaskForm.jsx`.
- [ ] Status removal uses a distinct confirmation panel with copy that describes removal and save-time reassignment accurately.
- [ ] Existing status add, rename, reorder, validation, task reassignment, save, rollback, focus, and accessibility behavior remains intact.
- [ ] `ActivityFeed` uses SVG icons for all supported activity types, the header, close action, and empty state.
- [ ] The desktop activity sidebar is wide enough for readable descriptions while mobile behavior remains a bottom sheet.
- [ ] Activity entries appear as visually connected glass cards rather than `border-b`-only rows.
- [ ] Loading skeletons communicate the size and structure of activity cards.
- [ ] “Load more” is a clear full-width button and retains the existing cursor behavior.
- [ ] Empty and error states have clear hierarchy, readable copy, and working retry behavior.
- [ ] Light/dark mode, focus states, accessible labels, and existing tests remain supported.
- [ ] No backend, API contract, store behavior, or new runtime dependency changes are introduced.

## 10. Out of Scope

- Filter, search, or day-grouping activity.
- Keyboard navigation beyond existing Escape, focus, and button behavior.
- Drag-to-reorder or other new status-management features.
- Real-time subscriptions, websockets, polling, or activity data changes.
- Backend, MongoDB, route, API, or Zustand action changes.
- New icon packages, design-system components, localization infrastructure, or runtime dependencies.
- Broad visual redesign of the board, `TaskForm.jsx`, or unrelated components.

## 11. Risks & Open Questions

| Risk | Impact | Mitigation |
|------|--------|------------|
| Inline SVG additions increase component size | Low | Keep the icon set limited to controls and existing activity types; avoid a new abstraction or dependency for this quick pass. |
| Wider sidebar reduces visible board area | Medium | Apply the width only at the existing desktop breakpoint, cap it with the viewport, and preserve the mobile sheet layout. |
| Visual selector changes break tests | Low | Keep accessible names and semantic roles stable; update only selectors that intentionally target the new presentation. |
| Confirmation copy implies behavior that differs from save logic | Medium | Keep task-containing statuses disabled and describe reassignment only as the existing save-time behavior for applicable removals. |
| Glass surfaces remain muddy over the board gradient | Medium | Reduce opacity/backdrop layering, use the existing shadow tokens, and validate in both themes against the actual board background. |
| Scope expands beyond the timebox | Medium | Limit work to the two components and their focused tests; defer shared icon extraction and broader redesign. |

### Open Questions

1. Should the user-facing strings be localized now? **Recommendation: no.** Keep the current English test-facing strings and note that the UI copy will be re-localized in code if localization is introduced later.
2. Should removable stages with zero tasks explicitly mention that no tasks will move? **Recommendation: yes.** Use concise copy that states removal is staged locally and persisted on Save, without suggesting an automatic task move.
3. Should the desktop width be `w-96` exactly or a nearby custom width? **Recommendation: use the existing Tailwind scale with `w-96` plus the current viewport cap; avoid changing `client/tailwind.config.js`.**
