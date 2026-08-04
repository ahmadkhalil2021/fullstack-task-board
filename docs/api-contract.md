# API Contract

## Base URL
```
/api
```

## Standard Response Shapes

### Success (200)
```json
{
  "data": { ... }
}
```

### Created (201)
```json
{
  "data": { ... }
}
```

### Error (4xx, 5xx)
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Human-readable description"
  }
}
```

---

## Boards

### `GET /api/boards/:boardId`
Retrieve a board with its tasks populated.

**Response 200**
```json
{
  "data": {
    "board": {
      "_id": "64b2f1a...",
      "name": "My Task Board",
      "description": "",
      "tasks": [
        {
          "_id": "64b2f1b...",
          "name": "Task in Progress",
          "description": "",
          "icon": "⏰",
          "status": "In Progress"
        },
        {
          "_id": "64b2f1c...",
          "name": "Task Completed",
          "description": "",
          "icon": "🏋️",
          "status": "Completed"
        },
        {
          "_id": "64b2f1d...",
          "name": "Task Won't Do",
          "description": "",
          "icon": "☕",
          "status": "Won't do"
        }
      ],
      "createdAt": "2026-08-04T...",
      "updatedAt": "2026-08-04T..."
    }
  }
}
```

**Response 404**
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Board not found"
  }
}
```

---

### `POST /api/boards`
Create a new board with 3 default tasks.

**Request Body**
```json
{
  "name": "My Task Board",
  "description": ""
}
```
All fields optional. Defaults applied if missing.

**Response 201**
```json
{
  "data": {
    "board": {
      "_id": "64b2f1a...",
      "name": "My Task Board",
      "description": "",
      "tasks": [ ... ],
      "createdAt": "2026-08-04T...",
      "updatedAt": "2026-08-04T..."
    }
  }
}
```

**Response 400**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Name must be a string"
  }
}
```

---

### `PUT /api/boards/:boardId`
Update board name and/or description.

**Request Body**
```json
{
  "name": "Updated Board Name",
  "description": "Updated description"
}
```
All fields optional. Only provided fields are updated.

**Response 200**
```json
{
  "data": {
    "board": {
      "_id": "64b2f1a...",
      "name": "Updated Board Name",
      "description": "Updated description",
      "tasks": [ ... ],
      "createdAt": "2026-08-04T...",
      "updatedAt": "2026-08-04T..."
    }
  }
}
```

---

### `DELETE /api/boards/:boardId`
Delete a board and all its tasks (cascade).

**Response 200**
```json
{
  "data": {
    "message": "Board deleted"
  }
}
```

---

## Tasks

### `PUT /api/tasks/:taskId`
Update a task's fields.

**Request Body**
```json
{
  "name": "Updated task name",
  "description": "Updated description",
  "icon": "🚀",
  "status": "Completed"
}
```
All fields optional. Only provided fields are updated.

**Response 200**
```json
{
  "data": {
    "task": {
      "_id": "64b2f1b...",
      "name": "Updated task name",
      "description": "Updated description",
      "icon": "🚀",
      "status": "Completed",
      "createdAt": "2026-08-04T...",
      "updatedAt": "2026-08-04T..."
    }
  }
}
```

**Valid status values**: `"In Progress"`, `"Completed"`, `"Won't do"`

---

### `DELETE /api/tasks/:taskId`
Delete a task and remove its reference from the board.

**Response 200**
```json
{
  "data": {
    "message": "Task deleted"
  }
}
```

---

## Error Codes

| Code | HTTP | When |
|------|------|------|
| `NOT_FOUND` | 404 | Board or task doesn't exist |
| `VALIDATION_ERROR` | 400 | Invalid request body (wrong types, missing required) |
| `INVALID_STATUS` | 400 | Task status not in allowed list |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
