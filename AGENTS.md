# AGENTS.md — AI Assistant Instructions

## Project Identity
**fullstack-task-board** — A task management application where each board has 3 columns (In Progress, Completed, Won't do) with tasks. Board is accessible via `/board/:board-id`. Auto-creates a board on first visit.

## Tech Stack
| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite + react-router-dom |
| State | Zustand |
| Styling | Tailwind CSS |
| Backend | Express.js (deployed as Vercel serverless) |
| Database | MongoDB + Mongoose |
| Deployment | Vercel (both client & server) |

## File Rules
- **Add comments sparingly — only the WHY, not the WHAT**
  - Good comment: explains a non-obvious choice, a trade-off, or a gotcha
  - Bad comment: restates the code (e.g. `// loop through items` above a `for` loop)
  - One short comment per non-obvious block is usually enough
- **NEVER create README or .md files** unless explicitly asked (AGENTS.md is already created)
- Follow existing patterns in the codebase — mimic imports, naming, structure
- Use `const` for function components, never `function` keyword
- Use arrow functions everywhere

## Naming Conventions
- **Files**: `kebab-case.jsx` for components, `camelCase.js` for utilities
- **Components**: `PascalCase`
- **Variables/functions**: `camelCase`
- **CSS classes**: Tailwind utility classes only
- **MongoDB collections**: lowercase plural (`boards`, `tasks`)
- **API routes**: `/api/resource-name/:param-name`

## Code Style
- No semicolons
- Single quotes for strings
- Trailing commas in objects/arrays
- 2-space indentation
- No unused imports — remove them
- Prefer `const` over `let`, never `var`
- Destructure props inline

## Project Structure
```
fullstack-task-board/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Board.jsx
│   │   │   ├── Column.jsx
│   │   │   ├── TaskCard.jsx
│   │   │   └── TaskForm.jsx
│   │   ├── store/
│   │   │   └── useBoardStore.js
│   │   ├── lib/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── vite.config.js
├── server/
│   ├── models/
│   │   ├── Board.js
│   │   └── Task.js
│   ├── routes/
│   │   ├── boards.js
│   │   └── tasks.js
│   ├── db.js
│   └── index.js
├── AGENTS.md
├── ARCHITECTURE.md
└── .env.example
```

## Commands
```bash
# Dev (starts both client and server from root)
npm run dev

# Client only
npm run dev --workspace=client
# Or
cd client && npm run dev

# Server only
npm run dev --workspace=server
# Or
cd server && npm run dev
```

## Architecture Principles
1. **API-first**: Backend defines the contract. Frontend consumes it.
2. **Optimistic updates**: Update Zustand store immediately, sync to API in background
3. **Single source of truth**: Board state lives in Zustand store
4. **No prop drilling**: Components read directly from Zustand store
5. **Serverless-ready**: Express app exports `app` (not `app.listen`) for Vercel

## Workflow Rules
- **Never close an issue before the user reviews it.** After completing work, move the issue to **In review** on the kanban board and wait for explicit user approval before closing.
- The flow is: Backlog → Ready → In progress → **In review** → (user approves) → Done

### Adding a new component
1. Create in `client/src/components/`
2. Import Zustand store directly (no prop passing from parent)
3. Use Tailwind for all styling

### Working with MongoDB
- Connect once in `server/db.js`, reuse connection
- Use Mongoose schemas in `server/models/`
- Never hardcode connection strings — use `process.env.MONGODB_URI`
