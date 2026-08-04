# ADR-0004: Vercel for Deployment

**Status**: Accepted

**Date**: 2026-08-04

## Context
We need to deploy both the React frontend and Express backend. Options considered: Vercel, Render, and Railway.

## Decision
**Vercel (both tiers)**

## Rationale
- **Single platform**: Both frontend and backend deployed on the same service — one dashboard, one CLI, one domain.
- **Serverless Express**: Vercel wraps Express as serverless functions via `api/` directory. No Docker, no server management, no process supervision.
- **Free tier sufficient**: 100GB bandwidth, 100GB-hours execution. More than enough for a demo.
- **Git-integrated deploy**: Push to `main` triggers automatic deploy. No manual upload or CI configuration.
- **Cold starts acceptable**: Serverless cold starts are ~300ms. Not noticeable for a task board with low traffic.

## Alternatives Considered

| Option | Rejected Because |
|--------|-----------------|
| Render | Separate web service + static site. Two dashboards. Free tier has 15-minute inactivity spin-down (slower than Vercel cold start). |
| Railway | Free tier includes $5 credit that expires. Less generous than Vercel. |

## Consequences
- **Easier**: Unified deploys, automatic HTTPS, preview deploys for PRs
- **Harder**: Express must export `app` instead of calling `app.listen()`. Serverless constraints mean no WebSockets, no long-running processes. Neither is needed here.
