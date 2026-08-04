# Route Design

## Route Table

| Path | Component | Purpose |
|------|-----------|---------|
| `/` | `HomePage` | Auto-creates board → redirects |
| `/board/:boardId` | `BoardPage` | Main board view |

## Route Flow

```
User visits "/"
       │
       ▼
  HomePage mounts
       │
       ▼
  POST /api/boards (create board)
       │
       ▼
  navigate("/board/:new-board-id")
       │
       ▼
  BoardPage mounts
       │
       ▼
  GET /api/boards/:boardId (fetch board)
       │
       ▼
  Board renders
```

### Direct visit to `/board/:boardId`
```
User visits "/board/abc123"
       │
       ▼
  BoardPage mounts
       │
       ▼
  GET /api/boards/abc123
       │
       ├── Success → render board
       └── 404 → show "Board not found" + link to create new
```

## Implementation Notes

- Use `react-router-dom` v6 with `createBrowserRouter`
- `HomePage` uses `useNavigate()` for redirect
- `BoardPage` uses `useParams()` for `boardId`
- No nested routes — flat structure
- No layout routes — each page is self-contained
