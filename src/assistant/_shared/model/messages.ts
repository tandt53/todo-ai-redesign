// Outcome → message mapping (platform web.md: all conversation logic in plain
// TS, unit-tested under node). Every server outcome renders as a visible
// message — nothing resolves silently (AC-11); wording follows the design
// mockup (design/assistant/screens/voice-assistant-view.html).

import type { AppliedAnatomy, DiffRow, QuestionKind, UndoResultRec } from '../../api/types.ts'
import type {
  BoundaryWire,
  DiffChip,
  DiffLine,
  Marks,
  Message,
  SessionWire,
  TurnWire,
  UndoOutcomeWire,
} from '../types.ts'
import { appliedHead, formatStamp, formatValue } from './format.ts'

/** Reducer assigns ids; builders produce id-less messages. Omit must
 * distribute over the union so each variant keeps its own fields. */
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never
export type NewMsg = DistributiveOmit<Message, 'id'>

export interface MessageContext {
  /** current task title for a task id — never render a raw uuid (AC-4) */
  titleFor(taskId: string): string | null
  /** the asked question a resolution points back to (count + titles + kind) */
  questionInfo(questionTurnId: string): { qkind: QuestionKind; titles: string[] } | null
  now?: Date
}

// ---------------------------------------------------------------------------
// Applied anatomy → diff lines
// ---------------------------------------------------------------------------

export interface AnatomyView {
  lines: DiffLine[]
  deletedTitles: string[]
  counts: { edited: number; created: number; deleted: number }
}

export function anatomyView(anatomy: AppliedAnatomy, ctx: MessageContext): AnatomyView {
  const byTask = new Map<string, DiffRow[]>()
  for (const row of anatomy.diff) {
    const list = byTask.get(row.task_id) ?? []
    list.push(row)
    byTask.set(row.task_id, list)
  }
  const lines: DiffLine[] = []
  let createdIdx = 0
  let edited = 0
  const deletedIds = new Set<string>()
  for (const [taskId, rows] of byTask) {
    const allCreate = rows.every((r) => r.old === null || r.old === undefined)
    const allDelete = rows.every((r) => r.new === null || r.new === undefined)
    if (allDelete && !allCreate) {
      // deletes are named by title in the message body — no row remains (AC-4)
      deletedIds.add(taskId)
      continue
    }
    const titleRow = rows.find((r) => r.field === 'title')
    if (allCreate) {
      const title =
        formatValue(titleRow?.new, ctx.now) ??
        ctx.titleFor(taskId) ??
        anatomy.created_titles[createdIdx] ??
        'Việc mới'
      createdIdx += 1
      const chips: DiffChip[] = rows
        .filter((r) => r.field !== 'title' && r.new !== null && r.new !== undefined)
        .map((r) => ({ field: r.field, old: null, new: formatValue(r.new, ctx.now) }))
      lines.push({ taskId, title, label: 'new', chips })
    } else {
      edited += 1
      const title =
        ctx.titleFor(taskId) ??
        formatValue(titleRow?.new, ctx.now) ??
        formatValue(titleRow?.old, ctx.now) ??
        'Việc'
      const chips: DiffChip[] = rows.map((r) => ({
        field: r.field,
        old: formatValue(r.old, ctx.now),
        new: formatValue(r.new, ctx.now),
      }))
      lines.push({ taskId, title, label: 'edit', chips })
    }
  }
  // created tasks may carry a single title-only diff or none at all — make
  // sure every created title is represented
  while (createdIdx < anatomy.created_titles.length) {
    lines.push({ taskId: '', title: anatomy.created_titles[createdIdx] ?? 'Việc mới', label: 'new', chips: [] })
    createdIdx += 1
  }
  return {
    lines,
    deletedTitles: [...anatomy.deleted_titles],
    counts: {
      edited,
      created: anatomy.created_titles.length,
      deleted: anatomy.deleted_titles.length,
    },
  }
}

export function marksFrom(turnId: string, view: AnatomyView): Marks | null {
  const byTask: Record<string, DiffLine> = {}
  for (const line of view.lines) {
    if (line.taskId !== '') byTask[line.taskId] = line
  }
  if (Object.keys(byTask).length === 0) return null
  return { turnId, byTask }
}

// ---------------------------------------------------------------------------
// Individual message builders
// ---------------------------------------------------------------------------

export function appliedMessage(
  turnId: string,
  anatomy: AppliedAnatomy,
  ctx: MessageContext,
  at: string,
  undone = false,
): { message: NewMsg; marks: Marks | null } {
  const view = anatomyView(anatomy, ctx)
  const message: NewMsg = {
    kind: 'applied',
    turnId,
    head: appliedHead(view.counts),
    lines: view.lines,
    deletedTitles: view.deletedTitles,
    mutated: anatomy.changed_task_ids.length > 0,
    undone,
    at,
  }
  return { message, marks: undone ? null : marksFrom(turnId, view) }
}

export function questionMessage(turn: TurnWire): NewMsg {
  const q = turn.question
  if (q === null) throw new Error('asked turn without question')
  const n = q.task_titles.length
  if (q.kind === 'bulk_delete') {
    return {
      kind: 'question',
      turnId: turn.id,
      qkind: q.kind,
      head: `Xóa ${n} việc?`,
      body: `Sẽ xóa: ${q.task_titles.join(', ')}.`,
      options: [...q.options],
      taskTitles: [...q.task_titles],
      resolved: q.resolution !== null,
      at: turn.created_at,
    }
  }
  return {
    kind: 'question',
    turnId: turn.id,
    qkind: q.kind,
    head: `Có ${n} việc khớp — bạn muốn việc nào?`,
    body: null,
    options: [...q.options],
    taskTitles: [...q.task_titles],
    resolved: q.resolution !== null,
    at: turn.created_at,
  }
}

/** declined / declined-superseded outcome — "Đã giữ nguyên 3 việc" (AC-11). */
export function keptMessage(
  info: { qkind: QuestionKind; titles: string[] } | null,
  superseded: boolean,
  at: string,
): NewMsg {
  const body = superseded
    ? 'Việc xóa được bỏ qua vì bạn đã chuyển sang chuyện khác. Không có gì bị xóa.'
    : 'Không có gì bị xóa.'
  if (info === null || info.qkind !== 'bulk_delete') {
    return {
      kind: 'outcome',
      head: 'Bỏ qua câu hỏi đó',
      body: [
        superseded
          ? 'Câu hỏi được bỏ qua vì bạn đã chuyển sang chuyện khác. Chưa có gì thay đổi.'
          : 'Chưa có gì thay đổi.',
      ],
      at,
    }
  }
  return {
    kind: 'outcome',
    head: `Đã giữ nguyên ${info.titles.length} việc`,
    body: [body],
    at,
  }
}

export function alreadyResolvedMessage(at: string): NewMsg {
  return {
    kind: 'outcome',
    head: 'Câu hỏi đó đã được trả lời rồi',
    body: ['Không làm gì thêm — câu hỏi đã xử lý xong từ trước.'],
    at,
  }
}

export function unclassifiableMessage(at: string): NewMsg {
  return {
    kind: 'outcome',
    head: null,
    body: ['Tôi chưa hiểu đó là câu trả lời — câu hỏi ở trên vẫn đang chờ. Chưa làm gì cả.'],
    at,
  }
}

export function noMatchMessage(heard: string, at: string): NewMsg {
  return { kind: 'no-match', heard, at }
}

export function unsupportedMessage(alternative: string, at: string): NewMsg {
  return { kind: 'unsupported', alternative, at }
}

export function aiErrorMessage(retryTurnId: string | null, at: string): NewMsg {
  return {
    kind: 'error',
    head: 'Chưa gửi được',
    body: [
      'Trợ lý chưa xử lý được lời bạn vừa gửi. Chưa có gì thay đổi — lời của bạn vẫn được giữ bên dưới.',
    ],
    retryTurnId,
    at,
  }
}

const UNDO_REFUSAL_BODY: Record<string, string> = {
  not_undoable: 'Không có gì để hoàn tác — phiên này chưa có thay đổi nào được áp dụng.',
  not_newest: 'Không hoàn tác được nữa — đã có thay đổi mới hơn sau đó.',
  session_closed: 'Phiên đó đã kết thúc nên không hoàn tác được các thay đổi của nó.',
}

/** AC-6/AC-8: a refused undo is a visible outcome stating why, never silence. */
export function undoRefusedMessage(reason: string, at: string): NewMsg {
  return {
    kind: 'outcome',
    head: null,
    body: [UNDO_REFUSAL_BODY[reason] ?? 'Bây giờ chưa hoàn tác được.'],
    at,
  }
}

/** Undo result → reverted message (AC-7): skipped tasks named; all-skipped
 * renders "Không hoàn tác được gì", never dressed as success. */
export function revertedMessage(
  undo: Pick<UndoOutcomeWire, 'reverted' | 'skipped' | 'nothing_reverted'>,
  lineFor: (taskId: string) => DiffLine | null,
  at: string,
): NewMsg {
  if (undo.nothing_reverted) {
    const titles = undo.skipped.map((s) => s.title).join(', ')
    return {
      kind: 'reverted',
      head: 'Không hoàn tác được gì',
      body: [`Mọi việc của lần đó đều đã thay đổi sau đấy: ${titles}. Chúng được giữ nguyên.`],
      at,
    }
  }
  const removed: string[] = []
  const restored: string[] = []
  for (const r of undo.reverted) {
    const line = lineFor(r.task_id)
    if (line?.label === 'new') removed.push(r.title)
    else restored.push(r.title)
  }
  const body: string[] = []
  if (removed.length > 0) body.push(`Đã bỏ: ${removed.join(', ')}.`)
  if (restored.length > 0) body.push(`Đã khôi phục: ${restored.join(', ')}.`)
  for (const s of undo.skipped) {
    body.push(`Bỏ qua: ${s.title} — việc này đã thay đổi sau đó nên tôi giữ nguyên.`)
  }
  const head =
    undo.skipped.length === 0
      ? 'Đã hoàn tác'
      : `Đã hoàn tác — trừ ${undo.skipped.length} việc`
  return { kind: 'reverted', head, body, at }
}

// ---------------------------------------------------------------------------
// Turn → messages (live response + session resume share this)
// ---------------------------------------------------------------------------

export interface TurnView {
  messages: NewMsg[]
  marks: Marks | null
}

export function turnOutcomeMessages(turn: TurnWire, ctx: MessageContext, isLast: boolean): TurnView {
  const at = turn.resolved_at ?? turn.created_at
  if (turn.status === 'failed') {
    return { messages: [aiErrorMessage(isLast ? turn.client_turn_id : null, at)], marks: null }
  }
  const outcome = turn.outcome
  if (outcome === null) {
    if (turn.status === 'asked' && turn.question !== null) {
      return { messages: [questionMessage(turn)], marks: null }
    }
    return { messages: [], marks: null }
  }
  switch (outcome.kind) {
    case 'applied': {
      const { message, marks } = appliedMessage(turn.id, outcome, ctx, at, turn.status === 'undone')
      return { messages: [message], marks }
    }
    case 'question':
      return { messages: [questionMessage(turn)], marks: null }
    case 'resolution': {
      if (outcome.result === 'executed' && outcome.executed) {
        const { message, marks } = appliedMessage(turn.id, outcome.executed, ctx, at, turn.status === 'undone')
        return { messages: [message], marks }
      }
      if (outcome.result === 'already_resolved') {
        return { messages: [alreadyResolvedMessage(at)], marks: null }
      }
      const info = ctx.questionInfo(outcome.question_turn_id)
      return {
        messages: [keptMessage(info, outcome.result === 'declined_superseded', at)],
        marks: null,
      }
    }
    case 'unclassifiable':
      return { messages: [unclassifiableMessage(at)], marks: null }
    case 'no_match':
      return { messages: [noMatchMessage(outcome.heard_transcript, at)], marks: null }
    case 'unsupported_query':
      return { messages: [unsupportedMessage(outcome.alternative, at)], marks: null }
  }
}

/** Full session history → messages (resume, AC-28). Turns ARE the messages. */
export function sessionMessages(session: SessionWire, ctx: MessageContext): { messages: NewMsg[]; marks: Marks | null } {
  const out: NewMsg[] = []
  let marks: Marks | null = null
  const turns = session.messages
  turns.forEach((turn, i) => {
    out.push({
      kind: 'user',
      text: turn.transcript_raw,
      via: turn.source,
      at: turn.created_at,
      queued: false,
      clientTurnId: turn.client_turn_id,
    })
    const isLast = i === turns.length - 1
    const view = turnOutcomeMessages(turn, ctx, isLast)
    out.push(...view.messages)
    if (turn.status === 'applied' && view.marks !== null) marks = view.marks
    if (turn.status === 'undone' && turn.undo_result !== null) {
      out.push(revertedFromRecord(turn.undo_result, view, turn.resolved_at ?? turn.created_at))
    }
  })
  return { messages: out, marks }
}

function revertedFromRecord(rec: UndoResultRec, view: TurnView, at: string): NewMsg {
  const lines = new Map<string, DiffLine>()
  for (const m of view.messages) {
    if (m.kind === 'applied') for (const l of m.lines) lines.set(l.taskId, l)
  }
  return revertedMessage(rec, (taskId) => lines.get(taskId) ?? null, at)
}

/** Clean start: exactly ONE boundary message carrying the closed session's
 * terminal outcomes (AC-28). */
export function boundaryMessage(b: BoundaryWire, ctx: MessageContext): NewMsg {
  const reason = b.close_reason === 'idle' ? 'để lâu không dùng' : 'bạn đã đóng'
  const head = `Phiên đã kết thúc — ${reason} · ${formatStamp(b.closed_at, ctx.now)}`
  const lines: string[] = []
  for (const q of b.declined_questions) {
    const label = q.kind === 'bulk_delete' ? `Xóa ${q.task_titles.length} việc?` : 'Việc nào?'
    lines.push(`Đóng phiên nên bỏ qua: “${label}” — vẫn giữ ${q.task_titles.join(', ')}.`)
  }
  for (const late of b.late_outcomes) {
    lines.push(`Trong lúc bạn vắng mặt: ${describeLateOutcome(late, ctx)}`)
  }
  return { kind: 'boundary', head, lines, at: b.closed_at }
}

function describeLateOutcome(
  late: BoundaryWire['late_outcomes'][number],
  ctx: MessageContext,
): string {
  if (late.status === 'failed')
    return 'có một câu chưa xử lý được — nội dung vẫn được lưu trong phiên.'
  const o = late.outcome
  if (o !== null && o !== undefined && o.kind === 'applied') {
    const parts: string[] = []
    for (const t of o.created_titles) parts.push(`đã thêm “${t}”`)
    for (const t of o.deleted_titles) parts.push(`đã xóa “${t}”`)
    const edits = new Set(
      o.diff.filter((d) => d.old !== null && d.new !== null).map((d) => d.task_id),
    )
    for (const id of edits) {
      const title = ctx.titleFor(id)
      parts.push(title === null ? 'đã sửa 1 việc' : `đã sửa “${title}”`)
    }
    if (parts.length > 0) return `${parts.join('; ')}.`
  }
  if (o !== null && o !== undefined && o.kind === 'resolution' && o.executed) {
    const del = o.executed.deleted_titles
    if (del.length > 0) return `đã xóa ${del.join(', ')}.`
  }
  // Defensive: some harness stubs summarize late outcomes as a plain string.
  const summary = (late as { summary?: unknown }).summary
  if (typeof summary === 'string') return `${summary}.`
  return 'một thay đổi đã hoàn tất.'
}

// ---------------------------------------------------------------------------
// Mic-mode guidance messages (AC-21 / AC-22 — the message states which cause)
// ---------------------------------------------------------------------------

export function permissionDeniedMessage(at: string): NewMsg {
  return {
    kind: 'info',
    head: 'Micro cần quyền truy cập',
    body: [
      'Trình duyệt đang chặn micro cho trang này. Bạn cho phép trong cài đặt trang là micro sáng lại ngay.',
      'Gõ chữ vẫn dùng được như thường.',
    ],
    cta: 'permission',
    at,
  }
}

export function transientFailureMessage(at: string): NewMsg {
  return {
    kind: 'info',
    head: 'Nhận dạng giọng nói đang bận',
    body: [
      'Dịch vụ nhận dạng chưa phản hồi lúc này. Thường chỉ một lát là xong — micro sẽ tự bật lại.',
      'Gõ chữ vẫn dùng được như thường.',
    ],
    cta: null,
    at,
  }
}
