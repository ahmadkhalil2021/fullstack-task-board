# ADR-0006: Monorepo with npm Workspaces

**Status**: Accepted

**Date**: 2026-08-04

## Context
We need to organize the client (React) and server (Express) code. Options: monorepo (single repo, `client/` and `server/` directories) vs polyrepo (two separate repos).

## Decision
**Monorepo using npm workspaces**

## Rationale
- **Single `npm install`**: Install all dependencies from root. No need to cd into each directory.
- **Shared dev script**: `npm run dev` starts both client and server concurrently.
- **Single deploy context**: Vercel can deploy both frontend and serverless API from the same repo using `vercel.json`.
- **Single source of truth**: One git history, one issue tracker, one PR flow. No cross-repo coordination.
- **Project size**: 2 packages. npm workspaces is sufficient. No need for Turborepo/Nx at this scale.

## Alternatives Considered

| Option | Rejected Because |
|--------|-----------------|
| Polyrepo (2 repos) | Double PRs, double deploys, double issue trackers. Coordination overhead for 1 developer on a small project. |
| Turborepo/Nx | Build caching and task orchestration are valuable for 10+ packages. Adds configuration complexity for just 2. |

## Consequences
- **Easier**: Unified dependency management, single dev command, single deploy
- **Harder**: Workspaces can hoist dependencies unexpectedly. Mitigated by explicit `--workspace` flags and `nohoist` config if needed.
