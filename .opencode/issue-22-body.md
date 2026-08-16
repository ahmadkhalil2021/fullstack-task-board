## User Story

> As a board user I want the **Manage stages** modal and the **Activity** sidebar to look polished and readable so that status configuration and change history feel intentional, not placeholder.

## Problem

Both components shipped in Issues #13 and #21, but their UI feels unfinished:

### `StatusManager.jsx`
- Emoji glyphs (`↑`, `↓`, `🗑`) render inconsistently across OSes
- Row layout is cramped: input, validation, char counter, and 44×44px action buttons all compete for space
- Remove-confirmation row reads *"Move tasks to X?"* — but the action only filters, never moves
- Validation text is wedged between input and char counter
- Header has no icon or accent — pure plain text

### `ActivityFeed.jsx`
- Sidebar is only `w-80` (320px) — descriptions get clipped awkwardly
- Emoji glyphs (`➕`, `✏️`, `�️`, `🗑️`, `📝`) — OS-dependent, ugly in some browsers
- List items use only `border-b` dividers — feel disconnected
- Skeleton loaders are tiny and don't convey "loading"
- "Load more" is plain blue text, not a button
- Empty state (`📭` + tiny text) is too minimal
- Header has no icon, just the word "Activity"

## Acceptance Criteria

See [`docs/implementation-plans/issue-23-polish-statuses-activity-en.md`](../docs/implementation-plans/issue-23-polish-statuses-activity-en.md) § 9.

Summary:
- Replace all emoji controls/icons with inline SVG
- Improve responsive spacing and visual hierarchy
- Replace inline removal copy with a proper confirmation panel
- Widen activity sidebar to `w-96`
- Render activity entries as glass cards
- Polish loading, empty, error, and "Load more" states
- Light/dark parity; accessibility unchanged or improved
- No backend, API, store, or dependency changes

## Out of Scope

- Filter, search, day-grouping for activity
- Drag-to-reorder for statuses
- Backend / MongoDB / route / API / store changes
- New icon packages or runtime dependencies
- Broad visual redesign of the board or other components

## Depends on

The polish builds on the uncommitted UI foundation already in the working tree on `feature/issue-21-activity-feed`:
- `glass`, `glass-dark`, `glass-sm` shadow tokens (`tailwind.config.js`)
- `glass-surface` reduced-transparency fallback (`index.css`)
- `Atmosphere` gradient backdrop (`BoardPage.jsx`)
- Glass header, sidebar, and modal surfaces

That foundation should be committed first (separate commit) before this issue's polish commits.
