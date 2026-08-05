# Build & Runtime Architecture

A visual guide to how the backend and frontend are organized, built, and how they communicate at runtime. Diagrams are written in [Mermaid](https://mermaid.js.org/) and render natively in GitHub and VS Code.

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

    CSrc --> CComp[components/<br/>BoardHeader, Column, TaskCard]
    CSrc --> CPage[pages/<br/>HomePage, BoardPage, NotFoundPage]
    CSrc --> CStore[store/<br/>useBoardStore.js]
    CSrc --> CLib[lib/<br/>api.js]
    CSrc --> CTest[__tests__/]

    Server --> SModels[models/<br/>Board, Task]
    Server --> SRoutes[routes/<br/>boards, tasks]
    Server --> SMid[middleware/<br/>errorHandler]
    Server --> SLib[lib/<br/>errors]
    Server --> STest[__tests__/]
    Server --> SEntry[index.js, dev.js, db.js]

    Docs --> Adr[adr/<br/>decision records]
    Docs --> Refs[api-contract.md<br/>database-schema.md<br/>error-handling.md<br/>route-design.md<br/>state-management.md]

    style Root fill:#1f2937,color:#fff
    style Client fill:#3b82f6,color:#fff
    style Server fill:#10b981,color:#fff
    style Docs fill:#f59e0b,color:#fff
```

---

## 2. Runtime Architecture

```mermaid
graph TB
    subgraph Browser["🌐 BROWSER (Vercel CDN)"]
        direction TB
        React["React App<br/>(Vite bundle)"]
        Components["Components<br/>BoardHeader, Column, TaskCard"]
        Store["useBoardStore<br/>(Zustand)"]
        ApiLayer["api.js<br/>(fetch wrappers)"]
        React --> Components
        Components -. reads .-> Store
        Components -. calls .-> Store
        Store -. calls .-> ApiLayer
    end

    subgraph Server["⚙️ SERVER (Vercel Serverless)"]
        direction TB
        Express["Express App"]
        Middlewares["CORS · JSON · errorHandler"]
        Routes["/api/boards<br/>/api/tasks"]
        Models["Board model<br/>Task model"]
        Express --> Middlewares
        Middlewares --> Routes
        Routes --> Models
    end

    subgraph Database["🗄️ DATABASE"]
        MongoDB[("MongoDB Atlas<br/>boards, tasks")]
    end

    ApiLayer == "HTTPS / JSON" ==> Express
    Models == "Mongoose / BSON" ==> MongoDB

    style Browser fill:#dbeafe,stroke:#3b82f6
    style Server fill:#d1fae5,stroke:#10b981
    style Database fill:#fef3c7,stroke:#f59e0b
```

---

## 3. The Build Pipeline

### 3a. Development (`npm run dev`)

```mermaid
flowchart LR
    A[npm run dev] --> B[concurrently]
    B --> C[Vite dev server<br/>:5173]
    B --> D[node dev.js<br/>:5001]
    C --> E[Edit .jsx file]
    E --> F[HMR<br/>instant reload]
    D --> G[Edit .js file]
    G --> H[Manual restart<br/>or --watch]

    style A fill:#1f2937,color:#fff
    style F fill:#d1fae5
    style H fill:#fef3c7
```

### 3b. Production Build (`npm run build`)

```mermaid
flowchart LR
    A[npm run build] --> B["vite build<br/>(client only)"]
    B --> C["client/dist/<br/>index.html"]
    B --> D["client/dist/assets/<br/>index-XXX.css<br/>index-XXX.js"]
    E["server/index.js<br/>(no build needed)"] -.used as-is.-> F[Node.js runs it]

    style A fill:#1f2937,color:#fff
    style C fill:#dbeafe
    style D fill:#dbeafe
    style F fill:#d1fae5
```

### 3c. Deployment (Vercel)

```mermaid
flowchart TD
    A[git push to main] --> B[Vercel detects push]
    B --> C[Reads vercel.json]
    C --> D[Builds frontend<br/>vite build]
    C --> E[Bundles server<br/>as serverless function]
    D --> F[Static files → CDN]
    E --> G[API function ready]
    F --> H["https://yourapp.vercel.app"]
    G --> H
    H --> I[User visits URL]
    I --> J[HTML+JS loads]
    I --> K["/api/* calls hit<br/>the serverless function"]

    style A fill:#1f2937,color:#fff
    style H fill:#dbeafe
    style K fill:#d1fae5
```

---

## 4. Request Flow (with Optimistic Update)

This is the most important diagram. It shows how a single user action flows through the system — and how the UI updates **before** the server responds.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as TaskCard<br/>(React)
    participant Store as useBoardStore<br/>(Zustand)
    participant API as api.js<br/>(fetch)
    participant Server as Express<br/>Route
    participant DB as MongoDB

    User->>UI: Types new name & clicks Save
    UI->>Store: updateTask(id, { name })

    Note over Store,UI: ⚡ OPTIMISTIC UPDATE<br/>Store changes state NOW
    Store->>UI: re-render with new name
    User-->>User: Sees new name instantly

    Store->>API: PUT /api/tasks/:id { name }
    API->>Server: HTTP request
    Server->>DB: Task.findByIdAndUpdate()
    DB-->>Server: updated task
    Server-->>API: 200 + task JSON
    API-->>Store: response arrives

    alt ✅ Success
        Note over Store: Server confirmed<br/>no change needed
    else ❌ Failure
        Store->>Store: ROLLBACK to previous state
        Store->>UI: re-render with old name
        Store->>UI: show error toast
    end
```

**Key insight**: Steps 3–6 happen *before* steps 7–11. The UI feels instant because we don't wait for the server. If the server fails, we roll back.

---

## 5. The Flux Rule

```mermaid
graph LR
    UI["🖼️ UI<br/>(React)"]
    Store["📦 Store<br/>(Zustand)"]
    API["🌐 API<br/>(fetch)"]
    Server["⚙️ Server<br/>(Express)"]

    UI -- "reads state" --> Store
    UI -- "calls actions" --> Store
    Store -- "calls API" --> API
    API -- "HTTP" --> Server

    UI -. "❌ never" .-> API
    UI -. "❌ never" .-> Server
    Store -. "❌ never" .-> Server

    style UI fill:#dbeafe,stroke:#3b82f6
    style Store fill:#d1fae5,stroke:#10b981
    style API fill:#fef3c7,stroke:#f59e0b
    style Server fill:#fce7f3,stroke:#ec4899
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

## Related

- `ARCHITECTURE.md` — high-level system design
- `docs/state-management.md` — Flux pattern in depth
- `docs/adr/0008-flux-architecture.md` — why we use Flux
- `docs/adr/0005-optimistic-updates.md` — why the UI updates before the server
- `vercel.json` — the deploy config this diagram is based on
