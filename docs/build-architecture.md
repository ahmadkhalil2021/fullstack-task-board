# Build & Runtime Architecture

A visual guide to how the backend and frontend are organized, built, and how they communicate at runtime. Diagrams are written in [Mermaid](https://mermaid.js.org/) and render natively in GitHub and VS Code.

**Color rule**: All boxes use **dark backgrounds with white text**. This is the only combination that stays readable in both GitHub light and dark modes. Custom colors are set via `classDef` with both `fill` and `color` forced.

---

## 1. Project Structure

```mermaid
graph TD
    Root[fullstack-task-board/] --> Client[client/]
    Root --> Server[server/]
    Root --> Docs[docs/]
    Root --> Config[vercel.json, package.json, README.md]

    Client --> CSrc[src/]
    Client --> CConfig[vite.config.js<br/>tailwind.config.js<br/>vitest.config.js]
    CSrc --> CComp[components/]
    CSrc --> CPage[pages/]
    CSrc --> CStore[store/]
    CSrc --> CLib[lib/]
    CSrc --> CTest[__tests__/]

    Server --> SModels[models/]
    Server --> SRoutes[routes/]
    Server --> SMid[middleware/]
    Server --> SLib[lib/]
    Server --> STest[__tests__/]
    Server --> SEntry[index.js, dev.js, db.js]

    Docs --> Adr[adr/]
    Docs --> Refs[api-contract.md<br/>database-schema.md<br/>error-handling.md<br/>route-design.md<br/>state-management.md]

    classDef rootNode fill:#1f2937,stroke:#000,color:#fff
    classDef clientNode fill:#1e40af,stroke:#000,color:#fff
    classDef serverNode fill:#065f46,stroke:#000,color:#fff
    classDef docsNode fill:#92400e,stroke:#000,color:#fff
    classDef leafNode fill:#374151,stroke:#000,color:#fff

    class Root rootNode
    class Client,CConfig clientNode
    class CSrc,CComp,CPage,CStore,CLib,CTest leafNode
    class Server serverNode
    class SModels,SRoutes,SMid,SLib,STest,SEntry leafNode
    class Docs,Adr,Refs docsNode
    class Config leafNode
```

---

## 2. Runtime Architecture

```mermaid
graph TB
    subgraph Browser["BROWSER (Vercel CDN)"]
        direction TB
        React["React App (Vite bundle)"]
        Components["Components"]
        Store["useBoardStore (Zustand)"]
        ApiLayer["api.js (fetch wrappers)"]
        React --> Components
        Components -. reads .-> Store
        Components -. calls .-> Store
        Store -. calls .-> ApiLayer
    end

    subgraph Server["SERVER (Vercel Serverless)"]
        direction TB
        Express["Express App"]
        Middlewares["CORS, JSON, errorHandler"]
        Routes["/api/boards, /api/tasks"]
        Models["Board model, Task model"]
        Express --> Middlewares
        Middlewares --> Routes
        Routes --> Models
    end

    subgraph Database["DATABASE"]
        MongoDB[("MongoDB Atlas<br/>boards, tasks")]
    end

    ApiLayer == "HTTPS / JSON" ==> Express
    Models == "Mongoose / BSON" ==> MongoDB

    classDef browserStyle fill:#1e40af,stroke:#000,color:#fff
    classDef serverStyle fill:#065f46,stroke:#000,color:#fff
    classDef dbStyle fill:#92400e,stroke:#000,color:#fff
    classDef innerStyle fill:#374151,stroke:#000,color:#fff

    class Browser,React,Components,Store,ApiLayer browserStyle
    class Server,Express,Middlewares,Routes,Models serverStyle
    class Database,MongoDB dbStyle
```

---

## 3. The Build Pipeline

### 3a. Development (`npm run dev`)

```mermaid
flowchart LR
    A[npm run dev] --> B[concurrently]
    B --> C[Vite dev server :5173]
    B --> D[node dev.js :5001]
    C --> E[Edit .jsx file]
    E --> F[HMR instant reload]
    D --> G[Edit .js file]
    G --> H[Manual restart or --watch]

    classDef inputNode fill:#4f46e5,stroke:#000,color:#fff
    classDef okNode fill:#065f46,stroke:#000,color:#fff
    classDef warnNode fill:#92400e,stroke:#000,color:#fff
    class A,B inputNode
    class C,D,E,G leafNode
    class F okNode
    class H warnNode
```

### 3b. Production Build (`npm run build`)

```mermaid
flowchart LR
    A[npm run build] --> B["vite build (client only)"]
    B --> C["client/dist/index.html"]
    B --> D["client/dist/assets/index.css, .js"]
    E["server/index.js (no build)"] -.used as-is.-> F[Node.js runs it]

    classDef inputNode fill:#4f46e5,stroke:#000,color:#fff
    classDef clientNode fill:#1e40af,stroke:#000,color:#fff
    classDef serverNode fill:#065f46,stroke:#000,color:#fff
    class A,B inputNode
    class C,D clientNode
    class E,F serverNode
```

### 3c. Deployment (Vercel)

```mermaid
flowchart TD
    A[git push to main] --> B[Vercel detects push]
    B --> C[Reads vercel.json]
    C --> D[Builds frontend vite build]
    C --> E[Bundles server serverless function]
    D --> F[Static files to CDN]
    E --> G[API function ready]
    F --> H[yourapp.vercel.app]
    G --> H
    H --> I[User visits URL]
    I --> J[HTML+JS loads]
    I --> K["/api/* calls hit serverless function"]

    classDef inputNode fill:#4f46e5,stroke:#000,color:#fff
    classDef clientNode fill:#1e40af,stroke:#000,color:#fff
    classDef serverNode fill:#065f46,stroke:#000,color:#fff
    class A,B,C inputNode
    class D,F,J clientNode
    class E,G,K serverNode
```

---

## 4. Request Flow (with Optimistic Update)

The most important diagram. Shows how a single user action flows through the system, and how the UI updates **before** the server responds.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as TaskCard
    participant Store as Zustand
    participant API as api.js
    participant Server as Express
    participant DB as MongoDB

    User->>UI: Types new name & clicks Save
    UI->>Store: updateTask(id, { name })

    Note over Store,UI: OPTIMISTIC UPDATE
    Store->>UI: re-render with new name
    User-->>User: Sees new name instantly

    Store->>API: PUT /api/tasks/:id { name }
    API->>Server: HTTP request
    Server->>DB: Task.findByIdAndUpdate()
    DB-->>Server: updated task
    Server-->>API: 200 + task JSON
    API-->>Store: response arrives

    alt Success
        Note over Store: Server confirmed
    else Failure
        Store->>Store: ROLLBACK to previous state
        Store->>UI: re-render with old name
    end
```

**Key insight**: Steps 3–7 happen *before* steps 8–13. The UI feels instant because we don't wait for the server. If the server fails, we roll back.

---

## 5. The Flux Rule

```mermaid
graph LR
    UI["UI (React)"]
    Store["Store (Zustand)"]
    API["API (fetch)"]
    Server["Server (Express)"]

    UI -- "reads state" --> Store
    UI -- "calls actions" --> Store
    Store -- "calls API" --> API
    API -- "HTTP" --> Server

    UI -. "forbidden" .-> API
    UI -. "forbidden" .-> Server
    Store -. "forbidden" .-> Server

    classDef uiStyle fill:#1e40af,stroke:#000,color:#fff
    classDef storeStyle fill:#065f46,stroke:#000,color:#fff
    classDef apiStyle fill:#92400e,stroke:#000,color:#fff
    classDef serverStyle fill:#831843,stroke:#000,color:#fff

    class UI uiStyle
    class Store storeStyle
    class API apiStyle
    class Server serverStyle
```

**The rule in one line:**

> **UI knows the Store. Store knows the API. UI never knows the API.**

The dashed red lines show what is **forbidden**. Break this rule and the data flow becomes unpredictable.

---

## 6. Layers Cheat Sheet

| Layer | Folder | Reads from | Calls | Doesn't know about |
|-------|--------|------------|-------|-------------------|
| **UI Component** | `client/src/components/`, `client/src/pages/` | Store | Store actions | API, fetch, JSON |
| **Store** | `client/src/store/` | API (for actions) | API functions | React, components, JSX |
| **API** | `client/src/lib/` | (network) | `fetch` | Store, React |
| **Route** | `server/routes/` | Models | Model methods | Frontend, React |
| **Model** | `server/models/` | (database) | Mongoose | HTTP, frontend |

---

## Why dark + white text everywhere

| Background | Text | Light mode | Dark mode |
|------------|------|-----------|-----------|
| `#1e40af` (dark blue) | `#fff` (white) | ✅ visible | ✅ visible |
| `#bfdbfe` (light blue) | no color (theme default) | ✅ | ❌ white on light |
| `#ffffff` (white) | no color | ❌ | ❌ |

**Dark backgrounds with forced white text are the only combination that survives both themes.** GitHub's Mermaid renderer always picks the theme's default text color (white in dark mode, dark in light mode) when text color isn't forced. So we force it.

---

## Related

- `ARCHITECTURE.md` — high-level system design
- `docs/state-management.md` — Flux pattern in depth
- `docs/adr/0008-flux-architecture.md` — why we use Flux
- `docs/adr/0005-optimistic-updates.md` — why the UI updates before the server
- `vercel.json` — the deploy config this diagram is based on
