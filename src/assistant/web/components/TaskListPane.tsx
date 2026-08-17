// The task list — the source of truth the user verifies with their eyes
// (F-001 Purpose). Flat rows per the design system TaskRow; AI-change markers
// (AC-4) ride `state.marks`; the whole manual path (create / edit / complete /
// delete) works by touch with zero AI calls (AC-18).

import { useState } from 'react'
import * as Toggle from '@radix-ui/react-toggle'
import type { AssistantController } from '../../_shared/controller.ts'
import type { AppState } from '../../_shared/model/reducer.ts'
import type { DiffLine, TaskView } from '../../_shared/types.ts'
import { formatDue } from '../../_shared/model/format.ts'
import { CheckIcon, PencilIcon, PlusIcon, TrashIcon } from './icons.tsx'

export type ListFilter = 'all' | 'today' | 'done'

interface Group {
  label: string
  tasks: TaskView[]
}

function isToday(iso: string | null, now: Date): boolean {
  if (iso === null) return false
  const d = new Date(iso)
  return (
    !Number.isNaN(d.getTime()) &&
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

function isTomorrow(iso: string | null, now: Date): boolean {
  if (iso === null) return false
  const t = new Date(now)
  t.setDate(t.getDate() + 1)
  return isToday(iso, t)
}

function groupTasks(tasks: TaskView[], now: Date): Group[] {
  const today: TaskView[] = []
  const tomorrow: TaskView[] = []
  const later: TaskView[] = []
  const anytime: TaskView[] = []
  for (const t of tasks) {
    if (isToday(t.due_at, now) || (t.due_at === null && t.status === 'today')) today.push(t)
    else if (isTomorrow(t.due_at, now)) tomorrow.push(t)
    else if (t.due_at !== null) later.push(t)
    else anytime.push(t)
  }
  const dayLabel = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const tmr = new Date(now)
  tmr.setDate(tmr.getDate() + 1)
  const groups: Group[] = []
  if (today.length > 0) groups.push({ label: `Hôm nay · ${dayLabel(now)}`, tasks: today })
  if (tomorrow.length > 0) groups.push({ label: `Ngày mai · ${dayLabel(tmr)}`, tasks: tomorrow })
  if (later.length > 0) groups.push({ label: 'Sau này', tasks: later })
  if (anytime.length > 0) groups.push({ label: 'Lúc nào cũng được', tasks: anytime })
  return groups
}

function DiffChips({ line }: { line: DiffLine }) {
  return (
    <span className="row-diff show">
      {line.chips
        .filter((c) => c.old !== null || c.new !== null)
        .map((c, i) => (
          <span key={`${c.field}-${i}`} className="row-diff-pair">
            {c.old !== null && (
              <span className="chip-old" data-testid="assistant-diff-old">
                {c.old}
              </span>
            )}
            {c.old !== null && c.new !== null && <span className="diff-arrow"> → </span>}
            {c.new !== null && (
              <span className="chip-new" data-testid="assistant-diff-new">
                {c.new}
              </span>
            )}
          </span>
        ))}
    </span>
  )
}

function TaskRow({
  task,
  mark,
  controller,
}: {
  task: TaskView
  mark: DiffLine | null
  controller: AssistantController
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(task.title)
  const done = task.status === 'done'
  const meta =
    task.due_at !== null ? formatDue(task.due_at) : task.local === true ? 'đã lưu tại máy' : null
  return (
    <li
      className={`task-row${done ? ' done' : ''}${mark !== null ? ' flashing' : ''}`}
      data-testid="assistant-task-row"
    >
      <Toggle.Root
        className="checkbox"
        data-testid="assistant-task-checkbox"
        pressed={done}
        onPressedChange={() => void controller.toggleTask(task.id)}
        aria-label={`Đánh dấu “${task.title}” là ${done ? 'chưa xong' : 'đã xong'}`}
      >
        {done ? <CheckIcon /> : null}
      </Toggle.Root>
      <div className="task-main">
        {editing ? (
          <input
            className="task-edit-input"
            aria-label={`Sửa “${task.title}”`}
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                void controller.editTask(task.id, draft)
                setEditing(false)
              }
              if (e.key === 'Escape') {
                setDraft(task.title)
                setEditing(false)
              }
            }}
            onBlur={() => {
              void controller.editTask(task.id, draft)
              setEditing(false)
            }}
          />
        ) : (
          <>
            <span className="task-title">{task.title}</span>
            {mark !== null && (
              <span
                className={`badge show ${mark.label === 'new' ? 'badge-new' : 'badge-edited'}`}
                data-testid="assistant-row-badge"
              >
                {mark.label === 'new' ? 'Mới' : 'Đã sửa'}
              </span>
            )}
            {meta !== null && <span className="task-meta">{meta}</span>}
            {mark !== null && mark.label === 'edit' && mark.chips.length > 0 && <DiffChips line={mark} />}
          </>
        )}
      </div>
      <span className="row-actions">
        <button
          className="row-action"
          aria-label={`Sửa “${task.title}”`}
          onClick={() => {
            setDraft(task.title)
            setEditing(true)
          }}
        >
          <PencilIcon />
        </button>
        <button
          className="row-action"
          aria-label={`Xóa “${task.title}”`}
          onClick={() => void controller.removeTask(task.id)}
        >
          <TrashIcon />
        </button>
      </span>
    </li>
  )
}

export function TaskListPane({
  state,
  controller,
  filter,
}: {
  state: AppState
  controller: AssistantController
  filter: ListFilter
}) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const now = new Date()
  const all = state.tasks
  const tasks =
    filter === 'done'
      ? all.filter((t) => t.status === 'done')
      : filter === 'today'
        ? all.filter((t) => isToday(t.due_at, now) || t.status === 'today')
        : all
  const open = all.filter((t) => t.status !== 'done').length
  const groups = groupTasks(tasks, now)

  const commitAdd = () => {
    if (draft.trim() !== '') void controller.addTask(draft)
    setDraft('')
    setAdding(false)
  }

  return (
    <aside className="list-pane" aria-label="Danh sách việc của bạn">
      <div className="list-head">
        <h2>Danh sách của bạn</h2>
        {all.length > 0 && <span className="count">còn {open} việc</span>}
        <button className="add-btn" data-testid="assistant-add-task-button" onClick={() => setAdding(true)}>
          <PlusIcon />
          Thêm việc
        </button>
      </div>
      {adding && (
        <div className="add-form">
          <input
            className="add-input"
            aria-label="Tên việc mới"
            placeholder="Tên việc…"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitAdd()
              if (e.key === 'Escape') {
                setDraft('')
                setAdding(false)
              }
            }}
          />
          <button className="add-save" onClick={commitAdd}>
            Lưu
          </button>
        </div>
      )}
      {tasks.length === 0 ? (
        <div className="list-empty">
          <strong>Chưa có việc nào — nói đi.</strong>
          Nói một câu là việc hiện ngay ở đây — hoặc tự thêm bằng tay.
        </div>
      ) : (
        <div className="list-scroll">
          {groups.map((g) => (
            <div key={g.label}>
              <div className="day-head">{g.label}</div>
              <ul className="tasks">
                {g.tasks.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    mark={state.marks?.byTask[t.id] ?? null}
                    controller={controller}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </aside>
  )
}
