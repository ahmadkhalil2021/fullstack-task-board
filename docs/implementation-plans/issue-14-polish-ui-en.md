# Implementation Plan — Issue #14: Polish board UI design

## Summary

Issue #14 is a frontend-only visual and interaction polish pass over the existing board view. The goal is to raise the perceived quality of the app by tightening typography, spacing, color, motion, and focus states; adding skeleton placeholders for loading; making the layout responsive; and ensuring keyboard navigation works cleanly. No API contracts, state logic, or new features change. All work is confined to presentational components and Tailwind configuration.

## Architecture & Design Decisions

### 1. Typography system
**Recommendation: Option C — Keep the system stack.**

The current UI relies on Tailwind's default sans stack (`ui-sans-serif, system-ui, sans-serif`). Adding a Google Font introduces a network dependency, FOIT/FOUT handling, and CSP considerations for a polish task. The system stack is already crisp, respects the user's OS preferences, and avoids a render-blocking request. We will improve the *application* of type (size, weight, line-height, tracking) rather than changing the font family.

### 2. Skeleton loaders
**Recommendation: Option A — Pulse animation placeholders during `fetchBoard`.**

The board currently renders plain text `Loading...` while `isLoading` is true. We will replace that with a skeleton layout that mirrors the final board: a header placeholder plus three column placeholders, each containing a few pulsing task-card shapes. This is implemented with Tailwind's `animate-pulse` and muted background utilities. No external library is added; the skeleton markup lives inside the existing `BoardPage` loading branch and in a small presentational helper that is local to the board view.

### 3. Responsive breakpoints
**Recommendation: Option A — Mobile-first with `sm`/`md`/`lg` breakpoints.**

The board is a horizontal kanban, so the primary mobile experience remains horizontal scroll (`overflow-x-auto`) with a minimum column width. On larger screens we increase padding, gaps, and column min-widths. Touch targets are kept at least `44px`. This keeps the existing interaction model intact while improving readability on every viewport.

### 4. Keyboard navigation scope
**Recommendation: Option A — Tab-only, ensuring browsers handle it natively.**

The existing drag-and-drop already uses `@dnd-kit`'s `KeyboardSensor`, so reordering is keyboard-accessible. For this polish task we focus on making every interactive element reachable, visible, and predictable via `Tab`/`Shift+Tab`: task cards, header inputs, the add-task button, and the theme toggle. We avoid custom shortcuts (`j`/`k`, etc.) because they would add state, event listeners, and documentation overhead that falls outside a pure UI polish scope.

### 5. Motion/transitions
**Recommendation: Option A — Subtle (`transition-colors`, `duration-150`).**

Motion should feel responsive, not decorative. We add short transitions to color, border-color, shadow, and transform changes. Entry animations are avoided to keep the board snappy during optimistic updates. All motion respects `prefers-reduced-motion` by pairing Tailwind transitions with `motion-safe:` where appropriate and by not relying on motion to convey state.

### 6. Color palette
**Recommendation: Extend `dark:` variants to specific UI surfaces; keep the existing gray/blue base.**

We do not introduce a new color system. Instead, we apply a more intentional hierarchy: header gets a subtle surface color, columns get a consistent muted background, task cards get slightly elevated surfaces, and hover/focus states use a single accent blue. Status-specific column colors are *not* added because the current three statuses ("In Progress", "Completed", "Won't do") are arbitrary and color-coding them could create false semantic meaning. The dark-mode palette is hardened so every surface has a defined pair.

## State Machine / Flow

N/A — Issue #14 does not add, remove, or change state logic. The Zustand store contract remains identical.

## API Contract

N/A — Issue #14 does not add, remove, or change API endpoints or payloads.

## File Changes

- `client/tailwind.config.js`
- `client/src/pages/BoardPage.jsx`
- `client/src/pages/HomePage.jsx`
- `client/src/components/Column.jsx`
- `client/src/components/TaskCard.jsx`
- `client/src/components/BoardHeader.jsx`
- `client/src/components/EmptyBoard.jsx`

## Implementation Steps

1. **Audit current UI surfaces.** Open each file listed above and catalog typography, spacing, color, focus, and motion inconsistencies.
2. **Extend Tailwind theme.** Add a small `extend` block for consistent border-radius, box-shadow, and transition timing if needed. Keep custom values minimal; prefer standard Tailwind utilities.
3. **Build skeleton placeholders.** In `BoardPage.jsx`, replace the `isLoading` branch with a skeleton layout matching the board structure. Optionally extract the repeated card/column skeleton shapes into a local helper inside the same file to keep JSX readable.
4. **Polish `BoardHeader`.**
   - Increase visual separation with a subtle background or stronger border.
   - Ensure inputs have visible `focus-visible` rings and adequate padding.
   - Add a saving-state transition (opacity on the "Saving..." text).
5. **Polish `Column`.**
   - Refine padding and gap scale (`p-4`, `gap-3`).
   - Improve drop-target feedback (ring + background color change with transition).
   - Make the task count badge more legible.
   - Ensure the column is scrollable on its own axis without clipping focus rings.
6. **Polish `TaskCard`.**
   - Tighten typography (`leading-snug`, `text-sm` description).
   - Add `focus-visible` ring for keyboard users.
   - Smooth hover shadow/border transitions.
   - Preserve drag overlay appearance.
7. **Polish `EmptyBoard` and `HomePage`.**
   - `EmptyBoard`: add an icon/illustration placeholder and friendlier vertical spacing.
   - `HomePage`: replace the plain spinner centering with the same surface styling used on `BoardPage`, and add a skeleton-ready container.
8. **Responsive pass.**
   - Add mobile-first breakpoints to `BoardPage` main area.
   - Verify horizontal scroll is usable on 320px-wide viewports.
   - Verify columns do not collapse below their minimum readable width.
9. **Accessibility pass.**
   - Tab through every interactive element and confirm a visible focus ring.
   - Test with macOS/Windows reduced-motion settings enabled.
   - Run a quick Lighthouse audit for contrast and focus.
10. **Visual regression / manual QA.**
    - Compare light and dark modes side by side.
    - Verify skeleton layout does not jump when real data replaces it.
    - Verify drag-and-drop still works after style changes.

## Edge Cases & Error Handling

- **Focus visible on custom elements.** Task cards are divs with `onClick`. Ensure they have `tabIndex={0}`, a keyboard `onKeyDown` handler (Enter/Space), and a `focus-visible` ring. Without this, keyboard users cannot open tasks.
- **Reduced motion.** All transitions are purely presentational; state changes do not depend on animation. Add `motion-safe:` prefixes where entry/exit motion is introduced, and avoid auto-playing motion.
- **Layout collapse on small screens.** Columns have `min-w-[280px]`. On very small viewports the board scrolls horizontally instead of squashing columns. Verify `overflow-x-auto` is present on the scroll container and that `flex-shrink-0` is not accidentally removed.
- **Skeleton flash.** If `fetchBoard` resolves quickly, the skeleton might flicker. Do not add artificial delays; instead ensure the skeleton mirrors final geometry so the transition feels instantaneous rather than jarring.
- **Dark-mode hardening.** Every new color token must have a `dark:` counterpart. Test with the theme toggle and with `<html class="dark">` set on load.

## Testing Strategy

- **Manual checklist (required):**
  - [ ] Light mode looks polished at desktop and mobile widths.
  - [ ] Dark mode looks polished at desktop and mobile widths.
  - [ ] Skeleton appears during initial board load.
  - [ ] Every clickable element shows a visible focus ring when tabbed.
  - [ ] Task cards can be opened with Enter/Space.
  - [ ] Drag-and-drop still reorders and moves tasks correctly.
  - [ ] Reduced-motion preference does not break functionality.
- **Visual regression (optional):**
  - If Storybook or a screenshot tool exists in the repo, capture the board, empty, and skeleton states before and after. This project currently has no Storybook configuration, so this step is optional.
- **Lighthouse / axe:**
  - Run a quick accessibility scan to catch contrast or focus-order regressions.

## Acceptance Criteria

- [ ] Typography, spacing, color, motion, and focus rings are consistent across `BoardPage`, `Column`, `TaskCard`, `BoardHeader`, `EmptyBoard`, and `HomePage`.
- [ ] A skeleton loading state is shown while the board is loading.
- [ ] The board layout is usable from 320px to 4K widths without horizontal clipping or unreadable columns.
- [ ] All interactive elements are reachable and visually identifiable via keyboard (`Tab`/`Shift+Tab`).
- [ ] No state logic, API calls, or data shapes are changed.
- [ ] No new dependencies are added.
- [ ] Dark mode remains fully functional.

## Out of Scope

- New features (filters, search, assignees, due dates, etc.).
- New functional components beyond small presentational skeleton helpers local to the board view.
- Backend changes of any kind.
- Theme toggle implementation (already completed in Issue #12).
- Custom keyboard shortcuts beyond standard tab order.
- New font family or design-system overhaul.

## Risks & Open Questions

- **Design system fragmentation.** Because this is a one-off polish pass, there is a risk that colors/spacing diverge from future components. Mitigation: document the chosen tokens in code comments inside `tailwind.config.js` and keep values aligned with Tailwind's default scale.
- **Regression risk in drag-and-drop.** Restyling `TaskCard` or `Column` can accidentally change hit areas, cursor handling, or the drag overlay. Mitigation: test dnd-kit behavior after every style change and avoid changing DOM structure inside sortable nodes.
- **Reduced-motion testing.** Not all team environments expose `prefers-reduced-motion` toggles. Mitigation: use DevTools rendering emulation and keep motion strictly cosmetic.
- **Open question:** Should the skeleton use the same column count as the loaded board? Since the column list is not known until `fetchBoard` resolves, a fixed three-column skeleton is recommended. If boards can have a variable number of statuses, consider a generic 3-column skeleton that approximates the most common layout.
