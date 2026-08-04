# ADR-0001: Zustand for State Management

**Status**: Accepted

**Date**: 2026-08-04

## Context
We need a state management solution for a React application with a single board containing tasks. The options considered were Redux Toolkit, Zustand, and React Context.

## Decision
**Zustand**

## Rationale
- **Project scope fits**: One board = one store. Redux would be overkill with its boilerplate (slices, reducers, action creators, Provider setup).
- **Less code**: Zustand actions are plain functions. No dispatchers, no action type constants.
- **No Provider wrapper**: Zustand stores are hooks, not context. No component tree wrapping needed.
- **Selector-based re-renders**: Components subscribe to slices of state via selectors — only re-render when their data changes. Same capability as Redux but simpler API.
- **Senior relevance**: Zustand is widely adopted in production (used by Vercel, Linear). Knowing it demonstrates pragmatism — picking the right tool for the job, not the most popular one.

## Alternatives Considered

| Option | Rejected Because |
|--------|-----------------|
| Redux Toolkit | Too much boilerplate for a single-entity app. Requires Provider, `configureStore`, `createSlice`, `useDispatch`/`useSelector`. Over-engineering for this scope. |
| React Context + useReducer | Re-renders the entire tree on any state change. No selector support without external library. Fine for theme/auth, poor for frequently mutating data. |

## Consequences
- **Easier**: Onboarding, less code to maintain, faster development
- **Harder**: If the app grows to 50+ stores, Zustand doesn't provide the structural guardrails Redux does. Mitigated by the fact this won't happen for this project.
