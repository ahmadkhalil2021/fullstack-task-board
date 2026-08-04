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
    enum: ['In Progress', 'Completed', "Won't do"],
    default: 'In Progress'
  }
}, {
  timestamps: true
})
```

### Validations
- `status` — enum validation at Mongoose level. Backed by API-level check for user-friendly errors.

### Indexes
- `_id` — automatic, used for PUT/DELETE `/api/tasks/:taskId`

## Default Tasks (Created with Board)

When `POST /api/boards` is called, 3 tasks are created:
```
Task 1: { name: 'Task in Progress', status: 'In Progress', icon: '⏰' }
Task 2: { name: 'Task Completed',   status: 'Completed',   icon: '🏋️' }
Task 3: { name: "Task Won't Do",   status: "Won't do",    icon: '☕' }
```

New tasks added via UI default to:
```
{ name: 'New Task', status: 'In Progress', icon: '⏰' }
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
