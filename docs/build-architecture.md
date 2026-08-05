# Build & Runtime Architecture

A visual guide to how the backend and frontend are organized, built, and how they communicate at runtime.

## 1. Project Structure

```
fullstack-task-board/
│
├── client/                          # React + Vite frontend
│   ├── public/
│   ├── src/
│   │   ├── components/              # BoardHeader, Column, TaskCard, EmptyBoard
│   │   ├── pages/                   # HomePage, BoardPage, NotFoundPage
│   │   ├── store/                   # useBoardStore.js (Zustand)
│   │   ├── lib/                     # api.js (fetch wrappers)
│   │   ├── test/                    # test setup
│   │   ├── __tests__/               # component + routing tests
│   │   ├── App.jsx                  # mounts the router
│   │   ├── main.jsx                 # React root
│   │   └── index.css                # Tailwind directives
│   ├── index.html
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── vitest.config.js
│   ├── vite.config.js
│   └── package.json
│
├── server/                          # Express + Mongoose backend
│   ├── models/                      # Board.js, Task.js
│   ├── routes/                      # boards.js, tasks.js
│   ├── middleware/                  # errorHandler.js
│   ├── lib/                         # errors.js
│   ├── __tests__/                   # API tests (mongodb-memory-server)
│   ├── db.js                        # Mongoose connection helper
│   ├── index.js                     # Express app (exports app, no listen)
│   ├── dev.js                       # local dev entry (calls listen)
│   └── package.json
│
├── docs/                            # documentation
│   ├── adr/                         # architecture decision records
│   ├── api-contract.md
│   ├── database-schema.md
│   ├── error-handling.md
│   ├── route-design.md
│   └── state-management.md
│
├── vercel.json                      # deploy config
├── package.json                     # workspaces + concurrently
├── ARCHITECTURE.md                  # high-level system design
├── AGENTS.md                        # AI assistant instructions
└── README.md                        # entry point
```

## 2. Runtime Architecture

```
┌──────────────────────────────────────┐         ┌──────────────────────────────────────┐
│         BROWSER (User's machine)     │         │         SERVER (Vercel / local)      │
│                                      │         │                                      │
│  ┌────────────────────────────────┐  │         │  ┌────────────────────────────────┐  │
│  │  React App (Vite bundle)       │  │         │  │  Express App                   │  │
│  │  ┌──────────────┐              │  │         │  │  ┌──────────────┐              │  │
│  │  │  Components  │              │  │         │  │  │ Middlewares  │              │  │
│  │  │  - BoardHeader              │  │         │  │  │  - CORS      │              │  │
│  │  │  - Column    │              │  │         │  │  │  - JSON      │              │  │
│  │  │  - TaskCard  │              │  │         │  │  │  - errorHandler             │  │
│  │  └──────┬───────┘              │  │         │  │  └──────┬───────┘              │  │
│  │         │ reads                │  │         │  │         │ catches errors          │  │
│  │  ┌──────▼───────┐              │  │         │  │  ┌──────▼───────┐              │  │
│  │  │ useBoardStore│              │  │         │  │  │   Routes     │              │  │
│  │  │  (Zustand)   │  ─────────► │  │  HTTP   │  │  │ /api/boards  │              │  │
│  │  │  - state     │  fetch /api  │  │  JSON   │  │  │ /api/tasks   │              │  │
│  │  │  - actions   │ ◄─────────  │  │ ◄────── │  │  └──────┬───────┘              │  │
│  │  └──────┬───────┘              │  │         │  │         │ calls                 │  │
│  │         │ calls                │  │         │  │  ┌──────▼───────┐              │  │
│  │  ┌──────▼───────┐              │  │         │  │  │   Models     │              │  │
│  │  │   api.js     │              │  │         │  │  │  - Board     │              │  │
│  │  │  (fetch      │              │  │         │  │  │  - Task      │              │  │
│  │  │   wrappers)  │              │  │         │  │  └──────┬───────┘              │  │
│  │  └──────────────┘              │  │         │  │         │ Mongoose              │  │
│  └────────────────────────────────┘  │         │  └─────────┼────────────────────┘  │
│                                      │         │            │                       │
│  Hosted on: Vercel CDN               │         │            │                       │
│  Bundle: ~290KB (gzipped ~91KB)      │         │            ▼                       │
└──────────────────────────────────────┘         │  ┌────────────────────────┐         │
                                                  │  │      MongoDB           │         │
                                                  │  │  (Atlas / in-memory)   │         │
                                                  │  │  - boards collection   │         │
                                                  │  │  - tasks collection    │         │
                                                  │  └────────────────────────┘         │
                                                  │                                      │
                                                  │  Hosted on: MongoDB Atlas           │
                                                  └──────────────────────────────────────┘
```

## 3. The Build Pipeline

### Development (npm run dev)

```
                  npm run dev
                       │
                       ▼
         ┌─────────────────────────┐
         │   concurrently starts    │
         │   two dev processes       │
         └────┬───────────────┬────┘
              │               │
              ▼               ▼
    ┌─────────────────┐  ┌─────────────────┐
    │  Vite dev server │  │  node dev.js    │
    │  Port 5173       │  │  Port 5001      │
    │  HMR enabled     │  │  in-memory      │
    │  proxies /api →  │  │  MongoDB        │
    │  localhost:5001  │  │                 │
    └─────────────────┘  └─────────────────┘
              │               │
              ▼               ▼
    ┌─────────────────┐  ┌─────────────────┐
    │  Edit .jsx file  │  │  Edit .js file   │
    │  Save            │  │  Save            │
    │  → instant       │  │  → restart       │
    │    browser       │  │    manually or   │
    │    reload        │  │    use --watch   │
    └─────────────────┘  └─────────────────┘
```

### Production Build (npm run build)

```
                  npm run build
                       │
                       ▼
         ┌─────────────────────────┐
         │   Runs:                   │
         │   client → vite build     │
         └────────────┬────────────┘
                      │
                      ▼
         ┌─────────────────────────┐
         │   client/dist/ created   │
         │   ├── index.html         │
         │   ├── assets/            │
         │   │   ├── index-XXX.css  │  ← Tailwind (purged, tree-shaken)
         │   │   └── index-XXX.js   │  ← React + your code
         │   └── favicon.svg        │
         └─────────────────────────┘
                      │
                      ▼
         ┌─────────────────────────┐
         │   server/index.js stays  │
         │   as-is (Node.js runs    │
         │   it directly, no build  │
         │   step needed)            │
         └─────────────────────────┘
```

### Deployment (Vercel)

```
                  git push
                       │
                       ▼
              ┌─────────────────┐
              │   Vercel sees   │
              │   the push      │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  Reads vercel   │
              │  .json:         │
              │  - buildCommand │
              │  - outputDir    │
              │  - rewrites     │
              └────────┬────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
  ┌──────────────┐            ┌──────────────┐
  │  Builds the  │            │  Bundles the │
  │  frontend    │            │  server      │
  │              │            │              │
  │  Static      │            │  Serverless  │
  │  files go    │            │  function    │
  │  to the CDN  │            │  for /api/*  │
  └──────┬───────┘            └──────┬───────┘
         │                           │
         │         ┌─────────┐       │
         └────────►│  URL    │◄──────┘
                   │  yourapp│
                   │ .vercel │
                   │  .app   │
                   └────┬────┘
                        │
                        ▼
              ┌─────────────────┐
              │  User visits URL │
              │  → HTML+JS loads │
              │  → makes /api/*  │
              │    calls         │
              │  → serverless    │
              │    function runs │
              │  → MongoDB Atlas │
              │    responds      │
              └─────────────────┘
```

## 4. How a Request Flows at Runtime

User clicks "edit task name":

```
┌────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ User   │     │ TaskCard │     │  Store   │     │  api.js  │     │ Server   │
│ clicks │ ──► │  .jsx    │ ──► │  action  │ ──► │  fetch   │ ──► │ Express  │
└────────┘     └──────────┘     └──────────┘     └──────────┘     └────┬─────┘
                                                                       │
                                                                       ▼
                                                                 ┌──────────┐
                                                                 │ MongoDB  │
                                                                 │  Atlas   │
                                                                 └────┬─────┘
                                                                      │
              ┌────────┐     ┌──────────┐     ┌──────────┐     ┌──────┴─────┐
              │ User   │     │ TaskCard │     │  Store   │     │  api.js    │
              │ sees   │ ◄── │ re-render│ ◄── │ updated  │ ◄── │  response  │
              │ new    │     │  with    │     │  state   │     │  arrives   │
              │ name   │     │  new     │     │          │     │           │
              └────────┘     └──────────┘     └──────────┘     └────────────┘
```

The store updates the UI **before** the server responds (optimistic). The server's response reconciles any differences.

## 5. The Flux Rule (in one line)

> **UI knows the Store. Store knows the API. UI never knows the API.**

```
Component ──reads──► Store
   │                   │
   │                   │ calls
   │                   ▼
   └──never──────► api.js ──HTTP──► Server
```

This single rule keeps the architecture clean as the app grows.
