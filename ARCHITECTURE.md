# ARCHITECTURE.md — System Design

## Overview

```
┌──────────────┐       HTTP/REST        ┌──────────────┐       Mongoose       ┌──────────────┐
│   React App  │ ◄────────────────────► │  Express API │ ◄──────────────────► │   MongoDB    │
│  (Vercel)    │    /api/boards/*       │  (Vercel)    │    MONGODB_URI       │  (Atlas)     │
│              │    /api/tasks/*        │              │                      │              │
└──────┬───────┘                        └──────────────┘                      └──────────────┘
       │
       ▼
┌──────────────┐
│   Zustand    │
│    Store     │
└──────────────┘
```

## Data Models

### Board
```json
{
  "_id": "ObjectId",
  "name": "My Task Board",
  "description": "Optional board description",
  "tasks": ["TaskId1", "TaskId2", "TaskId3"],
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### Task
```json
{
  "_id": "ObjectId",
  "name": "Task in Progress",
  "description": "",
  "icon": "⏰",
  "status": "In Progress",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

## API Routes

| Method | Path | Description | Request Body | Response |
|--------|------|-------------|-------------|----------|
| GET | `/api/boards/:boardId` | Get board with tasks | — | `{ board }` |
| POST | `/api/boards` | Create board with defaults | `{ name?, description? }` | `{ board }` |
| PUT | `/api/boards/:boardId` | Update board metadata | `{ name?, description? }` | `{ board }` |
| DELETE | `/api/boards/:boardId` | Delete board + its tasks | — | `{ message }` |
| PUT | `/api/tasks/:taskId` | Update task | `{ name?, description?, icon?, status? }` | `{ task }` |
| DELETE | `/api/tasks/:taskId` | Delete task from board | — | `{ message }` |

### Default Board (created on POST /api/boards)
- **name**: "My Task Board"
- **description**: ""
- **tasks**: 3 default tasks with statuses "In Progress", "Completed", "Won't do"

## Component Tree

```
App
├── HomePage          (/)         → auto-creates board, redirects
└── BoardPage         (/board/:id)
    ├── BoardHeader               → editable name + description
    ├── BoardColumns               → flex container
    │   ├── Column                 → "In Progress" header
    │   │   └── TaskCard[]         → draggable, editable
    │   ├── Column                 → "Completed" header
    │   │   └── TaskCard[]
    │   └── Column                 → "Won't do" header
    │       └── TaskCard[]
    └── AddTaskButton
```

## Data Flow

```
User Action → Zustand Action → Optimistic Store Update → API Call → Merge Response
                                                     ↘ (error) → Rollback Store
```

### Example: Edit Task Name
1. User types new name in TaskCard
2. `useBoardStore.updateTask(taskId, { name })` called
3. Store immediately updates the task in local state
4. `PUT /api/tasks/:taskId` fires in background
5. If API fails → revert store to previous state

## State Management (Zustand)

```js
// useBoardStore shape
{
  board: null,
  isLoading: false,
  error: null,

  fetchBoard: (boardId) => {},
  createBoard: () => {},
  updateBoard: (data) => {},
  updateTask: (taskId, data) => {},
  deleteTask: (taskId) => {},
  addTask: (status) => {},
}
```

## Zustand Store Design

- Single store `useBoardStore` holds the entire board with tasks
- Components import only the slices they need via selectors
- All API calls happen inside store actions
- Optimistic updates: UI updates first, API syncs second
- Error state is surfaced for rollback

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **1 store vs many** | Single board = single store. Simple, no cross-store sync needed. |
| **Optimistic updates** | Feels instant. Senior-level UX pattern. |
| **Express on Vercel** | One platform for both tiers. Serverless = no server management. |
| **Tasks embedded in Board** | Board owns tasks via refs. Avoids orphaned tasks. Cascade delete. |
| **No authentication** | Scope is learning CRUD. Auth can be added later. |
