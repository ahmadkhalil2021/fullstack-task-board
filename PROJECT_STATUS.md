# fullstack-task-board — Projekt-Status (Session-Handoff)

> **Stand: 2026-09-12.** Lint: ⚠ 1 pre-existing warning, Tests: 121/121 passing, Build: not run.  
> Branch: `main`, Arbeitsverzeichnis clean. Dev-Server läuft in `screen`-Session.

## Was in DIESER Session dazugekommen ist

- **Entwicklungsumgebung aufgesetzt**
  - Node.js/npm waren auf dem System nicht installiert → nvm + Node v24.21.0 + npm v11.19.0 installiert.
  - Projekt-Dependencies via `npm install` installiert.
  - `client/package.json`: fehlende `react-router-dom` und `zustand` ergänzt (Code importierte sie, aber sie waren nicht gelistet).
- **Dev-Server gestartet**
  - Läuft in einer `screen`-Session namens `fullstack-task-board`.
  - Client: `http://localhost:5173`
  - Server: `http://localhost:5001`
  - MongoDB startet automatisch im Speicher.

## Historische Features (für Kontext)

In chronologischer Reihenfolge (Issues 1 → 21):

- **Issues #1–#7** — Grundgerüst: Vite + Express monorepo, MongoDB/Mongoose, React Router, Zustand, Tailwind, optimistische Updates.
- **Issue #8 — Add new task** (PR #16, `7426847`)
- **Issue #9 — Auto-create board on first visit** (PR #15, `0688eab`)
- **Issue #10 — Connect frontend to backend** (PR #18, `8b8058a`)
- **Issue #12 — Light/dark theme** (PR #17, `5cffb68`)
- **Issue #13 — Manage board statuses** (PR #20, `37da4d3`)
- **Issue #14 — Polish UI** (PR #19, `a86b965`)
- **Issue #21 — Activity feed** (PR #22, `eca8f54`) — gemergt.

## Aktueller Status

```
$ npm run test --workspace=client
 Test Files  9 passed (9)
      Tests  71 passed (71)

$ npm run test --workspace=server
ℹ tests 50
ℹ pass 50
ℹ fail 0

$ npm run lint --workspace=client
src/components/TaskCard.jsx:24:24: warning eslint(no-unused-vars): Parameter 'e' is declared but never used. (PRE-EXISTING)
```

## Bekannte offene Punkte

| # | Ticket | Status |
|---|--------|--------|
| 1 | **Issue #23 — StatusManager & ActivityFeed UI polish** wurde implementiert (`9d110f8`) und danach revertet (`a6e6f93`). Aktuell sind beide Komponenten wieder unpoliert. | **offen** |
| 2 | **Issue #24 — Design tokens** existiert als Remote-Branch `origin/feature/issue-24-design-tokens`. | offen |
| 3 | **Issue #11 — Deploy to Vercel** (geplant für das Ende des Projekts). | offen |
| 4 | **Pre-existing lint warning**: `client/src/components/TaskCard.jsx:24` ungenutzter Parameter `e`. | offen |
| 5 | **API error normalisierung**: Netzwerkfehler zeigen rohe `TypeError: Failed to fetch` statt eines `NETWORK_ERROR`-Codes. | offen |
| 6 | **`__mocks__/api.js` extraction**: `vi.mock('../lib/api.js', ...)` ist in mehreren Testdateien dupliziert. | offen |
| 7 | **`docs/route-design.md` drift**: Behauptet, `BoardPage` fetcht immer — tatsächlich skipped es den Fetch, wenn der Store das Board bereits hat. | offen |

## Was als Nächstes ansteht (priorisiert)

| Prio | Task | Aufwand |
|------|------|---------|
| 1 | **Issue #23 neu anwenden** (`git revert a6e6f93` oder manuelle Re-Implementierung des UI-Polishs) | Small |
| 2 | **Issue #24 design tokens** reviewen / fortsetzen | Small-Medium |
| 3 | **Offene Pedantik-Tickets** erledigen (Lint-Warning, Mock-Extraction, Error-Normalisierung, Doc-Drift) | Small |
| 4 | **Issue #11 — Vercel-Deployment** vorbereiten | Medium |

## Weiterarbeiten

### 1. Dev-Server

Läuft bereits in einer `screen`-Session:

```bash
# Logs ansehen
cat /tmp/opencode/fullstack-task-board-dev.log

# In die Session einhängen
screen -r fullstack-task-board

# Abkoppeln
# → Ctrl+A, dann D

# Stoppen
screen -S fullstack-task-board -X quit
```

### 2. Browser URLs

- Home: `http://localhost:5173/` — erstellt automatisch ein Board und leitet weiter.
- Direktes Board: `http://localhost:5173/board/<id>`.

### 3. Test-Commands

```bash
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm test                    # beide Workspaces
npm run test --workspace=client
npm run test --workspace=server
npm run lint --workspace=client
```

### 4. Wichtige Files

- `AGENTS.md` — Projekt-Conventions (MUST READ)
- `docs/adr/` — 8 Architektur-Entscheidungen
- `docs/implementation-plans/` — bilingual Pläne pro Issue
- `client/src/store/useBoardStore.js` — Single source of truth
- `server/routes/` — REST Endpoints

### Env-Var Quick-Reference

| Variable | Where | Purpose |
|----------|-------|---------|
| `MONGODB_URI` | `server/.env` | MongoDB Connection String (lokal im Speicher, wenn leer) |
| `VITE_API_URL` | `client/.env` | API Base URL (default `/api`) |
| `PORT` | server | Server-Port (default 5001) |

⚠ **NEVER put actual values in this file.** Values live in `.env.local` (gitignored).

---

*Erledigt (historisch):*
- Issues #1–#7 (Grundgerüst)
- Issues #8, #9, #10, #12, #13, #14, #21
