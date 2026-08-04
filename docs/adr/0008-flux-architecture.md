# ADR-0008: Flux Architecture Pattern

**Status**: Accepted

**Date**: 2026-08-04

**Related**: ADR-0001 (Zustand for state management)

## Context

As the app grows, components need to share data (the board, its tasks, loading states). Without a pattern, we end up with:

- Components fetching the same data independently
- Props passed through 5 layers to reach a deep child
- Local state that gets out of sync with other components
- No clear place to put "the latest version of X"

We need a way to organize state and data flow that scales.

## Decision

**Adopt the Flux architecture pattern.** All UI components communicate with a single central store. The store is the only place that talks to the API.

```
User Action → UI calls Store action → Store calls API → API returns data
                                                                  │
                                                                  ▼
                                          UI re-renders with new state
```

## Rationale

- **Single source of truth** — the entire board state lives in one store. No duplicates.
- **No prop drilling** — components read directly from the store via hooks.
- **Predictable data flow** — every change goes through the same path. Easy to debug.
- **Testable** — store actions can be tested with a mocked API layer.
- **Scales** — adding a new feature means adding a new store action, not rewiring components.

## The Rule

> **UI knows the Store. Store knows the API. UI never knows the API.**

This single rule keeps the architecture clean. Break it, and the data flow becomes unpredictable.

## Layer Responsibilities

| Layer | Knows about | Doesn't know about |
|-------|-------------|-------------------|
| **Component (UI)** | The store | The API, network, fetch |
| **Store** | The API (via `lib/api.js`) | React, components, JSX |
| **API (`lib/api.js`)** | `fetch`, URLs, JSON | The store, React, components |

## Alternatives Considered

| Option | Rejected Because |
|--------|-----------------|
| **Local state in each component** | Data out of sync. Prop drilling. Hard to scale. |
| **React Context + useReducer** | Re-renders the whole tree on any change. No selectors. |
| **Redux (strict Flux)** | Same idea as Zustand but with 3x more code. Action types, reducers, Provider. |
| **MobX** | Observable pattern. Different family. Steeper learning curve. |

## Consequences

- **Easier**: Adding a new feature = add a new store action. Components stay simple.
- **Harder**: Components must read from the store, not pass props. Slight learning curve.

## Practical Reference

See `docs/state-management.md` for the full data flow, code examples, and patterns to follow when adding new state or actions.
