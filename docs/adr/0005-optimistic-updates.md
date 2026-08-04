# ADR-0005: Optimistic UI Updates

**Status**: Accepted

**Date**: 2026-08-04

## Context
When users edit a task or board, we need to decide how to synchronize the UI with the backend API response.

## Decision
**Optimistic updates — update local state immediately, sync to API in background, rollback on failure.**

## Rationale
- **Perceived performance**: UI responds instantly. No loading spinners on every edit. This is a senior-level UX pattern.
- **Simple rollback strategy**: For this project, we save the previous state before the mutation. If the API call fails, we restore it. No CRDT or conflict resolution needed.
- **Single-user app**: No risk of conflicting edits. Optimistic updates are safe when there's only one writer.

## Alternatives Considered

| Option | Rejected Because |
|--------|-----------------|
| Pessimistic (wait for API) | Shows loading states on every keystroke. Feels sluggish. Teaches the wrong UX instincts. |
| WebSocket sync | Over-engineering for a single-user, no-collaboration app. Adds complexity without benefit. |

## Consequences
- **Easier**: Snappier UX, no loading spinners, demonstrates senior judgment
- **Harder**: Must implement rollback logic. Error states need clear user messaging ("Failed to save. Changes reverted."). Mitigated by keeping it simple — save previous state, revert on caught error.
