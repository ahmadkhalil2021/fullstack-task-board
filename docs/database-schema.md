# Database Schema Design

## Board

```js
const boardSchema = new mongoose.Schema({
  name: {
    type: String,
    default: 'My Task Board',
    maxlength: 100,
    trim: true
  },
  description: {
    type: String,
    default: '',
    maxlength: 500,
    trim: true
  },
  statuses: {
    type: [String],
    default: ['Backlog', 'Ready', 'In progress', 'In review', 'Done'],
    validate: {
      validator: (arr) => arr.length >= 1 && arr.every(s => s.trim().length > 0),
      message: 'statuses must be a non-empty array of non-empty strings'
    }
  },
  tasks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  }]
}, {
  timestamps: true
})
```

### Indexes
- `_id` — automatic, used as primary lookup key for `/board/:boardId`

### Hooks
- **pre('deleteOne', { document: true })** — delete all referenced tasks when a board is deleted:
  ```
  board.deleteOne() → deleteMany({ _id: { $in: board.tasks } })
  ```

### Statuses (board-level)
Each board defines its own list of allowed statuses. Tasks reference the status by name (string). The default board gets `['In Progress', 'Completed', "Won't do"]`, but users can rename, add, or remove them per board (UI in a future issue).

## Task

```js
const taskSchema = new mongoose.Schema({
  name: {
    type: String,
    default: 'New Task',
    maxlength: 100,
    trim: true
  },
  description: {
    type: String,
    default: '',
    maxlength: 1000,
    trim: true
  },
  icon: {
    type: String,
    default: '⏰',
    maxlength: 10
  },
  status: {
    type: String,
    default: 'In progress'
  }
}, {
  timestamps: true
})
```

### Validations
- `status` is a free string. **Validation against the parent board's `statuses` array happens in the API layer**, not in the schema. This is because Mongoose can't easily reference values from a related document during validation.

### Indexes
- `_id` — automatic, used for PUT/DELETE `/api/tasks/:taskId`

## Default Tasks (Created with Board)

When `POST /api/boards` is called, one task is created per status in `board.statuses`. The default board has 5 statuses, so 5 tasks:

```
board.statuses = ['Backlog', 'Ready', 'In progress', 'In review', 'Done']
  → Task 1: { name: 'Task Backlog',     status: 'Backlog',     icon: '⏰' }
  → Task 2: { name: 'Task Ready',       status: 'Ready',       icon: '⏰' }
  → Task 3: { name: 'Task In progress', status: 'In progress', icon: '⏰' }
  → Task 4: { name: 'Task In review',   status: 'In review',   icon: '⏰' }
  → Task 5: { name: 'Task Done',        status: 'Done',        icon: '⏰' }
```

If a user customizes `board.statuses` to `['Backlog', 'This Week', 'Done']`, the default tasks become:

```
  → Task 1: { name: 'Task Backlog',    status: 'Backlog',    icon: '⏰' }
  → Task 2: { name: 'Task This Week',  status: 'This Week',  icon: '⏰' }
  → Task 3: { name: 'Task Done',       status: 'Done',       icon: '⏰' }
```

New tasks added via UI default to:
```
{ name: 'New Task', status: board.statuses[0], icon: '⏰' }
```

## Delete Flow

### Delete Task
```
DELETE /api/tasks/:taskId
  → Task.findByIdAndDelete(taskId)
  → Board.updateOne({ tasks: taskId }, { $pull: { tasks: taskId } })
```

### Delete Board (cascade)
```
DELETE /api/boards/:boardId
  → Board.findById(boardId)
  → Task.deleteMany({ _id: { $in: board.tasks } })   [Mongoose pre-hook]
  → Board.findByIdAndDelete(boardId)
```
