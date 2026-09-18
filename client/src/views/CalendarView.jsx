// CalendarView.jsx — Month calendar (Monday-first) with an unscheduled tray.
// Tasks group by their due date key (UTC-safe), can be rescheduled by drag
// or a keyboard move mode, and open the shared task detail page on click.

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { useBoardStore, filterTasks } from '../store/useBoardStore.js'
import { toDateKey } from '../lib/dueDate.js'
import { resolveDropDate } from '../lib/calendarDnd.js'
import { PRIORITY_RANK, priorityColor, priorityLabel } from '../lib/priority.js'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_CHIPS = 3

const pad = (value, length = 2) => String(value).padStart(length, '0')
const keyOf = (year, month, day) => `${pad(year, 4)}-${pad(month)}-${pad(day)}`

const addDays = (key, days) => {
  const [year, month, day] = key.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return keyOf(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
}

const todayKey = () => {
  const now = new Date()
  return keyOf(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

// Monday-first grid covering the whole month plus muted adjacent-month cells.
const buildMonthCells = (year, monthIndex) => {
  const firstKey = keyOf(year, monthIndex + 1, 1)
  const firstWeekday = (new Date(Date.UTC(year, monthIndex, 1)).getUTCDay() + 6) % 7
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7
  const start = addDays(firstKey, -firstWeekday)

  return Array.from({ length: totalCells }, (_, index) => {
    const key = addDays(start, index)
    const [y, m, d] = key.split('-').map(Number)
    return { key, day: d, inMonth: y === year && m === monthIndex + 1 }
  })
}

const monthLabel = (year, monthIndex) =>
  new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, monthIndex, 1)))

const dayLabel = (key) =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${key}T00:00:00.000Z`))

const fullDayLabel = (key) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${key}T00:00:00.000Z`))

const taskIdFromDragId = (dragId) => String(dragId).replace(/^task:/, '')

const sortUnscheduled = (tasks) =>
  [...tasks].sort((a, b) => {
    const byPriority = (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0)
    if (byPriority !== 0) return byPriority
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0
    if (aTime !== bTime) return bTime - aTime
    return a._id.localeCompare(b._id)
  })

const TaskChip = ({ task, onOpen, onMove }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `task:${task._id}`,
  })
  const [previewKey, setPreviewKey] = useState(null)
  const moving = previewKey !== null

  const handleKeyDown = (event) => {
    if (moving) {
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        setPreviewKey((key) => addDays(key, -1))
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        setPreviewKey((key) => addDays(key, 1))
      } else if (event.key === 'Home') {
        event.preventDefault()
        setPreviewKey(todayKey())
      } else if (event.key === 'Enter') {
        event.preventDefault()
        onMove(task, previewKey)
        setPreviewKey(null)
      } else if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setPreviewKey(null)
      }
      return
    }
    if (event.key.toLowerCase() === 'm') {
      event.preventDefault()
      setPreviewKey(toDateKey(task.dueDate) ?? todayKey())
    }
  }

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-1 rounded border border-surface-border bg-surface-raised text-xs transition-colors duration-200 ${
        isDragging ? 'opacity-40' : ''
      } ${moving ? 'ring-2 ring-primary' : ''}`}
    >
      <button
        type="button"
        onClick={() => onOpen(task)}
        onKeyDown={handleKeyDown}
        aria-keyshortcuts="m"
        className="flex min-w-0 flex-1 items-center gap-1 rounded px-1.5 py-0.5 text-left text-surface-text hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
      >
        <span aria-hidden="true">{task.icon}</span>
        <span className="truncate">{task.name}</span>
      </button>
      <button
        type="button"
        {...listeners}
        {...attributes}
        aria-label={`Drag ${task.name} to another day`}
        className="shrink-0 cursor-grab rounded px-1 text-surface-text-subtle hover:text-surface-text focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset active:cursor-grabbing"
      >
        ⠿
      </button>
      {moving && (
        <span role="status" className="shrink-0 px-1 font-medium text-primary">
          → {dayLabel(previewKey)}
        </span>
      )}
    </div>
  )
}

const DayCell = ({ cell, tasks, isToday, isSelected, onSelect, onOpen, onMove, registerRef }) => {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${cell.key}`, disabled: !cell.inMonth })

  // Adjacent-month cells are decorative: no drop target, no panel, no chips.
  if (!cell.inMonth) {
    return (
      <div
        aria-hidden="true"
        className="flex min-h-[104px] rounded border border-transparent bg-surface-muted/40 p-1"
      >
        <span className="flex h-6 min-w-6 items-center justify-center px-1 text-xs text-surface-text-subtle">
          {cell.day}
        </span>
      </div>
    )
  }

  const visible = tasks.slice(0, MAX_CHIPS)
  const hiddenCount = tasks.length - visible.length

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[104px] flex-col gap-1 rounded border p-1 transition-colors duration-200 ${
        cell.inMonth ? 'border-surface-border bg-surface-raised' : 'border-transparent bg-surface-muted/40'
      } ${isOver ? 'ring-2 ring-primary ring-inset' : ''} ${isSelected ? 'border-primary' : ''}`}
    >
      <div className="flex items-center justify-between gap-1">
        <button
          type="button"
          ref={(node) => registerRef(cell.key, node)}
          onClick={() => onSelect(cell.key)}
          aria-pressed={isSelected}
          aria-current={isToday ? 'date' : undefined}
          aria-label={`${dayLabel(cell.key)}, ${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}`}
          className={`flex h-6 min-w-6 items-center justify-center rounded px-1 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle ${
            isToday
              ? 'bg-primary text-white'
              : cell.inMonth
                ? 'text-surface-text-muted hover:bg-surface-muted'
                : 'text-surface-text-subtle'
          }`}
        >
          {cell.day}
        </button>
        {tasks.length > 0 && (
          <span className="rounded-full border border-surface-border bg-surface-muted px-1.5 text-[10px] text-surface-text-subtle">
            {tasks.length}
          </span>
        )}
      </div>

      <ul className="flex flex-col gap-1">
        {visible.map((task) => (
          <li key={task._id}>
            <TaskChip task={task} onOpen={onOpen} onMove={onMove} />
          </li>
        ))}
        {hiddenCount > 0 && (
          <li>
            <button
              type="button"
              onClick={() => onSelect(cell.key)}
              className="rounded px-1 text-xs text-primary hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
            >
              +{hiddenCount} more
            </button>
          </li>
        )}
      </ul>
    </div>
  )
}

const Tray = ({ tasks, onOpen, onMove }) => {
  const { setNodeRef, isOver } = useDroppable({ id: 'tray' })

  return (
    <section
      ref={setNodeRef}
      aria-label="Unscheduled tasks"
      className={`rounded-card border border-surface-border bg-surface-raised p-3 transition-colors duration-200 ${
        isOver ? 'ring-2 ring-primary' : ''
      }`}
    >
      <h3 className="text-sm font-semibold text-surface-text">Unscheduled · {tasks.length}</h3>
      {tasks.length === 0 ? (
        <p className="mt-1 text-sm text-surface-text-subtle">No unscheduled tasks</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2">
          {tasks.map((task) => (
            <li key={task._id}>
              <TaskChip task={task} onOpen={onOpen} onMove={onMove} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const CalendarView = ({ onTaskClick }) => {
  const board = useBoardStore((s) => s.board)
  const query = useBoardStore((s) => s.query)
  const filterStatus = useBoardStore((s) => s.filterStatus)
  const updateTask = useBoardStore((s) => s.updateTask)

  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [selectedDay, setSelectedDay] = useState(null)
  const [activeTask, setActiveTask] = useState(null)

  const cellRefs = useRef(new Map())
  const closeButtonRef = useRef(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  )

  const filteredTasks = useMemo(
    () => filterTasks(board?.tasks, query, filterStatus),
    [board?.tasks, query, filterStatus]
  )

  const { groups, unscheduled, scheduledCount } = useMemo(() => {
    const byDay = new Map()
    const undated = []
    filteredTasks.forEach((task) => {
      const key = toDateKey(task.dueDate)
      if (key) byDay.set(key, [...(byDay.get(key) ?? []), task])
      else undated.push(task)
    })
    return {
      groups: byDay,
      unscheduled: sortUnscheduled(undated),
      scheduledCount: filteredTasks.length - undated.length,
    }
  }, [filteredTasks])

  const cells = useMemo(
    () => buildMonthCells(visibleMonth.year, visibleMonth.month),
    [visibleMonth]
  )

  useEffect(() => {
    if (selectedDay && closeButtonRef.current) closeButtonRef.current.focus()
  }, [selectedDay])

  // Escape closes the day panel and returns focus to its day button.
  useEffect(() => {
    if (!selectedDay) return
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      const node = cellRefs.current.get(selectedDay)
      setSelectedDay(null)
      node?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedDay])

  if (!board) return null

  const today = todayKey()
  const label = monthLabel(visibleMonth.year, visibleMonth.month)
  const selectedTasks = selectedDay ? (groups.get(selectedDay) ?? []) : []
  const monthScheduled = cells
    .filter((cell) => cell.inMonth)
    .reduce((sum, cell) => sum + (groups.get(cell.key)?.length ?? 0), 0)

  const moveTask = async (task, dueDate) => {
    try {
      await updateTask(task._id, { dueDate })
    } catch {
      // The store rolled back and set the error banner.
    }
  }

  const shiftMonth = (delta) =>
    setVisibleMonth(({ year, month }) => {
      const date = new Date(Date.UTC(year, month + delta, 1))
      return { year: date.getUTCFullYear(), month: date.getUTCMonth() }
    })

  const goToday = () => {
    const now = new Date()
    setVisibleMonth({ year: now.getFullYear(), month: now.getMonth() })
  }

  const handleDragStart = ({ active }) => {
    const task = board.tasks.find((t) => t._id === taskIdFromDragId(active.id))
    setActiveTask(task ?? null)
  }

  const handleDragEnd = ({ active, over }) => {
    setActiveTask(null)
    if (!over) return
    const task = board.tasks.find((t) => t._id === taskIdFromDragId(active.id))
    if (!task) return

    const overId = String(over.id)
    const nextDueDate = resolveDropDate(task.dueDate, overId)
    if (nextDueDate !== undefined) moveTask(task, nextDueDate)
  }

  const registerCellRef = (key, node) => {
    if (node) cellRefs.current.set(key, node)
    else cellRefs.current.delete(key)
  }

  const closePanel = () => {
    const node = selectedDay ? cellRefs.current.get(selectedDay) : null
    setSelectedDay(null)
    node?.focus()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-surface-text">{label}</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
            className="inline-flex h-8 w-8 items-center justify-center rounded text-surface-text-muted hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle transition-colors duration-200"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={goToday}
            className="rounded px-3 py-1.5 text-sm text-surface-text-muted hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle transition-colors duration-200"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
            className="inline-flex h-8 w-8 items-center justify-center rounded text-surface-text-muted hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle transition-colors duration-200"
          >
            ›
          </button>
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {label}: {scheduledCount} scheduled tasks, {unscheduled.length} unscheduled
      </p>

      {filteredTasks.length === 0 && (
        <div
          role="status"
          className="rounded-card border border-surface-border bg-surface-raised px-4 py-3 text-sm text-surface-text-muted"
        >
          No tasks match the current filters.
        </div>
      )}

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveTask(null)}
      >
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="min-w-0 flex-1">
            <div
              role="group"
              aria-label={`${label} calendar`}
              className="grid grid-cols-7 gap-1"
            >
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="px-1 py-1 text-center text-xs font-medium uppercase tracking-wide text-surface-text-subtle"
                >
                  {day}
                </div>
              ))}
              {cells.map((cell) => (
                <DayCell
                  key={cell.key}
                  cell={cell}
                  tasks={groups.get(cell.key) ?? []}
                  isToday={cell.key === today}
                  isSelected={cell.key === selectedDay}
                  onSelect={setSelectedDay}
                  onOpen={onTaskClick}
                  onMove={moveTask}
                  registerRef={registerCellRef}
                />
              ))}
            </div>

            {monthScheduled === 0 && unscheduled.length > 0 && (
              <p className="mt-2 text-sm text-surface-text-subtle">
                No tasks due this month — drag tasks from the tray into a day.
              </p>
            )}
          </div>

          {selectedDay && (
            <aside
              aria-label={`Tasks on ${fullDayLabel(selectedDay)}`}
              className="w-full shrink-0 rounded-card border border-surface-border bg-surface-raised p-4 lg:w-80"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-surface-text">
                  {fullDayLabel(selectedDay)}
                </h3>
                <button
                  type="button"
                  ref={closeButtonRef}
                  onClick={closePanel}
                  aria-label="Close day panel"
                  className="inline-flex h-8 w-8 items-center justify-center rounded text-surface-text-muted hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle transition-colors duration-200"
                >
                  ×
                </button>
              </div>

              {selectedTasks.length === 0 ? (
                <p className="text-sm text-surface-text-subtle">No tasks due on this day.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {selectedTasks.map((task) => (
                    <li key={task._id}>
                      <button
                        type="button"
                        onClick={() => onTaskClick(task)}
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-surface-text hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset transition-colors duration-200"
                      >
                        <span aria-hidden="true">{task.icon}</span>
                        <span className="min-w-0 flex-1 truncate">{task.name}</span>
                        {priorityColor(task.priority) && (
                          <span
                            aria-label={`Priority ${priorityLabel(task.priority)}`}
                            className={`inline-block h-2 w-2 shrink-0 rounded-full bg-priority-${priorityColor(task.priority)}`}
                          />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </aside>
          )}
        </div>

        <Tray tasks={unscheduled} onOpen={onTaskClick} onMove={moveTask} />

        <DragOverlay>
          {activeTask ? (
            <div className="flex items-center gap-1 rounded border border-surface-border bg-surface-raised px-2 py-1 text-xs shadow-card-hover">
              <span aria-hidden="true">{activeTask.icon}</span>
              <span className="truncate">{activeTask.name}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

export default CalendarView
