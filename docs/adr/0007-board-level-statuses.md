# ADR-0007: Board-Level User-Defined Statuses

**Status**: Accepted

**Date**: 2026-08-04

**Supersedes**: Part of ADR-0003 (initial status design was enum-based)

## Context

Originally, task status was a fixed enum: `['In Progress', 'Completed', "Won't do"]`. This is too rigid — different teams and projects want different workflows. A marketing team might use `['Ideas', 'Writing', 'Published']`. A dev team might use `['Backlog', 'This Week', 'In Review', 'Done']`.

We need a flexible system where each board can define its own statuses.

## Decision

**Statuses are now defined per board.** Each `Board` has a `statuses: [String]` array. Each `Task.status` is a free string, but the API layer validates that the value exists in the parent board's `statuses` array.

## Rationale

- **Flexibility per project**: Different boards can have different workflows without changing the data model
- **Simple schema**: A string is simpler than a relational table for status types
- **No new collection**: We avoid introducing a `Status` collection, which would be over-engineering for this scope
- **API-level validation**: Mongoose can't validate cross-document references, so validation moves to the API layer where we have access to the board

## Alternatives Considered

| Option | Rejected Because |
|--------|-----------------|
| **Global user-defined statuses** | Requires user accounts and settings — out of scope for this learning project |
| **Status collection with ObjectId refs** | Over-engineering. A string is enough. Adds a join where none is needed. |
| **Keep fixed enum** | Inflexible. Every project gets the same three columns whether they want them or not. |
| **Free-form string with no validation** | No integrity guarantee. Users could typo statuses and create phantom columns. |

## Consequences

- **Easier**: Different boards can have different workflows. The data model is simpler.
- **Harder**: The API layer must validate cross-document references (task.status must be in board.statuses). Removing a status from a board is a destructive operation that needs policy (see below).

## Open Questions (deferred)

When a user removes a status from `board.statuses` and tasks use that status:
- **Option A** (recommended): block the removal until the user moves all tasks to another status
- **Option B**: cascade-rename to the first status in the list

This is deferred to the UI implementation issue (TBD). For now, the API will accept any status change via `PUT /api/tasks/:id` and not check the board's status list (it will in Issue #4).
