# fullstack-task-board — Projekt-Status (Session-Handoff)

> **Stand: 2026-08-13.** Lint: ⚠ 1 pre-existing warning, Tests: 121/121 passing, Build: not run.
> Branch: `feature/issue-21-activity-feed`, PR #22 open (approved with minor changes, NOT merged).

## Was in DIESER Session dazugekommen ist

In chronologischer Reihenfolge (Issues 9 → 21):

- **Issue #9 — Auto-create board on first visit** (PR #15, `0688eab`)
  - `HomePage.jsx` rewritten with state machine (`creating | error`)
  - `hasStarted` + `isMounted` refs for StrictMode + unmount safety
  - Inline retry button on error
- **Issue #8 — Add new task** (PR #16, `7426847`)
  - `AddTaskButton.jsx` (new) at bottom of first column
  - `Column.jsx` renders the button when `onAddTask` provided
  - `BoardPage.jsx` `handleAddTask` + `hasStarted` ref for double-click guard
  - `useBoardStore.addTask` fixed to send `parentBoardId` — deployment-blocking bug
  - Server-side `order` field now accepted and validated
- **Issue #12 — Light/dark theme** (PR #17, `5cffb68`)
  - `ThemeToggle.jsx` cycling button (☀ → 🌙 → 💻)
  - `useBoardStore` `theme` slice + `applyTheme` helper
  - `matchMedia` browser-guard + HMR guard
  - **Critical**: inline `<script>` in `client/index.html` for FOUC prevention
- **Issue #10 — Connect frontend to backend** (PR #18, `8b8058a`)
  - `BoardHeader.jsx` persists on blur (was local-only per Issue #6)
  - `api.js` reads `VITE_API_URL` with `/api` fallback
  - `BoardPage.jsx` error banner (replaces full-screen error)
  - `client/.env.example` documents `VITE_API_URL`
- **Issue #14 — Polish UI** (PR #19, `a86b965`)
  - `tailwind.config.js`: system fonts, `transitionDuration: 150ms`, fade-in animation
  - `BoardPage.jsx` skeleton columns (animate-pulse) instead of "Loading..."
  - `HomePage.jsx` focus rings, aria-live, h1 heading
  - `Column.jsx` sticky header, shadow-inner on drag-over
  - `TaskCard.jsx` focus-visible rings, Enter-opens-edit, role=button, aria-label
  - `BoardHeader.jsx` responsive sm: padding/title, role switching
  - `EmptyBoard.jsx` Heroicon SVG illustration
  - `index.css` `scrollbar-hide` utility (scrollbar completely invisible)
- **Issue #13 — Manage board statuses** (PR #20, `37da4d3`)
  - `StatusManager.jsx` (new) — modal dialog for add/rename/remove
  - Gear icon (⚙) in `BoardHeader`
  - Validation: empty/duplicate names blocked, remove blocked if tasks exist or last status
  - Hydrates from `useBoardStore.updateBoard({ statuses })` (no backend changes)
- **Issue #21 — Activity feed** (PR #22, `c5a07dc`) — **CURRENT, NOT YET MERGED**
  - `server/models/Activity.js` (new) — schema with `boardId`, `type` enum, `changes`, timestamps
  - `server/routes/activities.js` (new) — `GET /api/boards/:boardId/activity?limit=N&before=ISO`
  - `server/routes/tasks.js` emits on POST/PUT/DELETE/move
  - `server/routes/boards.js` emits `board_updated`, `status_added/renamed/removed`
  - `server/models/Board.js` cascade-deletes Activities in `pre('deleteOne')`
  - `client/src/components/ActivityFeed.jsx` (new) — slide-in sidebar from right
  - `useBoardStore` `activity` slice + optimistic appends
  - `BoardHeader.jsx` activity toggle icon

**6 Issues closed in session, 1 PR (Issue #21) pending review fixes.**

## Was davor schon stand (Fundament)

From the original scaffold (PR #1-#7, closed before session start):
- Vite + Express monorepo (npm workspaces)
- Tailwind CSS, Mongoose/MongoDB, Vercel serverless
- React Router (`createBrowserRouter`)
- Zustand store with Flux pattern
- Optimistic updates with rollback (ADR-0005)
- 8 ADRs in `docs/adr/` documenting architectural decisions
- `docs/api-contract.md`, `docs/state-management.md`, `docs/route-design.md`, `docs/error-handling.md`

## Status-Check

```
$ npm run test --workspace=client
 Test Files  9 passed (9)
      Tests  71 passed (71)

$ npm run test --workspace=server
ℹ tests 50
ℹ pass 50
ℹ fail 0

$ npm run lint --workspace=client
src/components/TaskCard.jsx:24:24: warning eslint(no-unused-vars): Parameter 'e' is declared but never used. (PRE-EXISTING — TaskCard.jsx was not modified in this session)
```

## Test-Logins / Credentials

No auth in this project — single-user, no login. All boards/tasks live in MongoDB (Atlas in production, in-memory locally via `mongodb-memory-server`).

## Architektur-Conventions (kritische Gotchas)

1. **Flux-Pattern**: UI → Zustand Store → API. Components NEVER call `api.js` directly. (ADR-0008)
2. **Optimistic updates**: Update store first, sync to API in background, rollback on error. (ADR-0005)
3. **No prop drilling**: Components read directly from `useBoardStore` via selectors.
4. **File-header comment** first line of every new file: `// Filename.jsx — Short description.`
5. **No WHAT comments** — only WHY for non-obvious tricks (e.g., the `isMounted.current = true` re-assertion in `HomePage.jsx` for StrictMode).
6. **Tailwind only** — no CSS files except `index.css` for global utilities (scrollbar-hide).
7. **Code style**: `const`, arrow functions, no semicolons, single quotes, trailing commas, 2-space indent.
8. **Coding agents**: Architect (plans), Developer (codes), Reviewer (bilingual en/de PR comments). User does NOT write code directly.
9. **Reviewer posts bilingual**: always English + German PR comments — persisted in their agent config.
10. **Architect creates bilingual plans** in `docs/implementation-plans/` (en + de files).
11. **commit + push + PR**: agent makes commit + push, **user needs explicit "yes" before PR** is created.
12. **Workflow**: Backlog → Ready → In progress → **In review** → (user approves) → Done. PR auto-closes issue via `Closes #N`.

## Pedantische Tickets / Bekannte Edge-Cases

| # | Ticket | Status |
|---|--------|--------|
| 1 | **PR #22 review fixes** (Issue #21) — 2 bugs + 2 minor: optimistic dedup, rollback on update/delete failure, ESC + focus trap for sidebar, removed `await emitActivity` latency, fix index claim in boards.js docs | **offen** |
| 2 | **`useEffect` dependency**: `useBoardStore` `addOptimisticActivity` effect uses `board` not `board._id` (PR #20 nit) | offen |
| 3 | **`api.js` Error-Normalisierung**: network errors show raw `TypeError: Failed to fetch` instead of a mapped `NETWORK_ERROR` code | offen |
| 4 | **`__mocks__/api.js` Extraction**: `vi.mock('../lib/api.js', ...)` block duplicated in 3+ test files (add-task, board-header-persistence, status-manager, activity-feed) | offen |
| 5 | **Pre-existing lint warning**: `client/src/components/TaskCard.jsx:24` unused `e` parameter in `handleClick` | offen (pre-existing, not introduced by any session PR) |
| 6 | **a11y sweep**: `role="status"`, `aria-live` not yet applied to all dynamic UI surfaces (e.g., `store.isLoading` in BoardPage) | offen |
| 7 | **`docs/route-design.md` drift**: claims `BoardPage` always fetches, but `BoardPage.jsx:43` skips fetch when store has the board (Issue #9 design decision — needs doc update) | offen |

## Was als Nächstes ansteht (priorisiert)

| Prio | Task | Aufwand |
|------|------|---------|
| 1 | Apply PR #22 review fixes (commit pending on `feature/issue-21-activity-feed`) | Small (~30 min) |
| 2 | Re-review PR #22, merge → closes #21 | Small |
| 3 | **Issue #11 — Deploy to Vercel** (planned for end of project) — requires MongoDB Atlas cluster + Vercel env vars + vercel.json validation | Medium |
| 4 | Pedantische Tickets #1-#7 (incl. cleanup of lint warning, doc drift, mock extraction) | Small-Medium |
| 5 | **Feature backlog** (filed as #21-#25 in product-manager brainstorm): Task Labels, Due Dates, Assignees, Global Search, Activity Feed (DONE) | Variable |

## Morgen weiterarbeiten

### 1. Dev-Server starten

```bash
cd C:\Users\askha\Desktop\Coding\fullstack-task-board
npm run dev
```

- Client: `http://localhost:5173`
- Server: `http://localhost:3000` (or 5001 default)
- In-memory MongoDB starts automatically if `MONGODB_URI` is not set

### 2. Browser URL

- Home: `http://localhost:5173/` — auto-creates a board and redirects
- Direct board: `http://localhost:5173/board/<id>` — ID is in the URL after first redirect

### 3. Hard-Refresh

Strg+Shift+R (Windows) — sometimes Vite HMR holds stale state.

### 4. Test-Pfad

1. `http://localhost:5173/` → loading spinner → auto-redirect to `/board/<id>`
2. BoardPage renders with 5 default columns (Backlog, Ready, In progress, In review, Done)
3. Click "☀️" / "🌙" in header → theme cycles
4. Click "⚙" → Status-Manager modal opens
5. Click "🕘" → Activity sidebar opens (currently empty since server is fresh)
6. Click "+ Add new task" → task appears at top, modal opens with name focused
7. Drag tasks between columns
8. Click task → modal opens for edit

### 5. Test-Commands

```bash
npm test                    # both client + server
npm run test --workspace=client
npm run test --workspace=server
npm run lint --workspace=client
```

### 6. Wichtige Files

- `AGENTS.md` — project conventions (MUST READ first)
- `docs/adr/` — 8 architecture decision records
- `docs/implementation-plans/` — bilingual plans for each issue (en + de)
- `client/src/store/useBoardStore.js` — single source of truth for state
- `server/routes/` — REST endpoints

### Wenn morgen Probleme auftreten

| Symptom | Fix |
|---------|-----|
| Empty board after redirect | Hard-refresh; check MongoDB running (in-memory should auto-start) |
| `ECONNREFUSED` errors | Server not running; `npm run dev` in another terminal |
| Optimistic activity not showing | Pull latest — `git checkout feature/issue-21-activity-feed && git pull` (was uncommitted) |
| Theme doesn't persist | Check `localStorage.getItem('theme')` in DevTools |
| Lint warning on `TaskCard.jsx:24` | Pre-existing, unrelated to recent PRs |
| `vi.mock` errors in tests | Check `client/src/__tests__/` files use `vi.mock('../lib/api.js')` pattern |

### Env-Var Quick-Reference

| Variable | Where | Purpose |
|----------|-------|---------|
| `MONGODB_URI` | `server/.env` (root) | MongoDB connection string (defaults to in-memory locally) |
| `VITE_API_URL` | `client/.env` (client dir) | API base URL (defaults to `/api` for Vercel rewrites) |
| `PORT` | server | Server port (default 5001 in dev) |

⚠ **NEVER put actual values in this file.** Values live in `.env.local` (gitignored).

---

## Wo wir gerade stehen

- **Branch**: `feature/issue-21-activity-feed` (PR #22 open, NOT merged)
- **Uncommitted**: 2 directories (`docs/implementation-plans/` bilingual plans, `.opencode/` opencode config — gitignored)
- **Session-handoff commit will be made next**. After committing, push manually with `git push origin feature/issue-21-activity-feed`.

---

*Erledigt (historisch):*
- Issue #1 Scaffold project structure
- Issue #2 MongoDB models (Board + Task)
- Issue #3 Board API endpoints
- Issue #4 Task API endpoints
- Issue #5 React Router and Board page
- Issue #6 Board UI with 3 columns
- Issue #7 Task CRUD in UI
- **Issue #8** Add new task button (`7426847`)
- **Issue #9** Auto-create board on first visit (`0688eab`)
- **Issue #10** Connect frontend to backend (`8b8058a`)
- **Issue #12** Light/dark theme toggle (`5cffb68`)
- **Issue #13** Manage board statuses (`37da4d3`)
- **Issue #14** Polish UI (`a86b965`)
- **Issue #21** Activity feed (`c5a07dc`) — PR #22 awaiting review fixes