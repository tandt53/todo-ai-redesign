// Outcome → message mapping (platform web.md: all conversation logic in plain
// TS, unit-tested under node). Every server outcome renders as a visible
// message — nothing resolves silently (AC-11); wording follows the design
// mockup (docs/design/assistant/screens/voice-assistant-view.html).

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
import { appliedHead, formatStamp, formatValue, tasksWord } from './format.ts'

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
        'New task'
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
        'Task'
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
    lines.push({ taskId: '', title: anatomy.created_titles[createdIdx] ?? 'New task', label: 'new', chips: [] })
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
      head: `Delete ${n} ${tasksWord(n)}?`,
      body: `Will delete: ${q.task_titles.join(', ')}.`,
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
    // The mockup's clarify head quotes the matched phrase ("“Meeting” matches
    // two tasks — which one?"); the wire carries no such field (api types.ts
    // `Question` has kind/task_ids/task_titles/options only), so the count
    // carries it. Reported as a catalogue gap, not invented wording.
    head: `${n} ${tasksWord(n)} match — which one?`,
    body: null,
    options: [...q.options],
    taskTitles: [...q.task_titles],
    resolved: q.resolution !== null,
    at: turn.created_at,
  }
}

/** declined / declined-superseded outcome — "Kept all 3 tasks" (AC-11). */
export function keptMessage(
  info: { qkind: QuestionKind; titles: string[] } | null,
  superseded: boolean,
  at: string,
): NewMsg {
  const body = superseded
    ? 'The delete was set aside because you moved on to something else. Nothing was deleted.'
    : 'Nothing was deleted.'
  if (info === null || info.qkind !== 'bulk_delete') {
    return {
      kind: 'outcome',
      head: 'That question was set aside',
      body: [
        superseded
          ? 'The question was set aside because you moved on to something else. Nothing changed.'
          : 'Nothing changed.',
      ],
      at,
    }
  }
  const n = info.titles.length
  return {
    kind: 'outcome',
    head: `Kept all ${n} ${tasksWord(n)}`,
    body: [body],
    at,
  }
}

export function alreadyResolvedMessage(at: string): NewMsg {
  return {
    kind: 'outcome',
    head: 'That question was already answered',
    body: ['Nothing more to do — it was settled earlier.'],
    at,
  }
}

export function unclassifiableMessage(at: string): NewMsg {
  return {
    kind: 'outcome',
    head: null,
    body: ["I didn't catch that as an answer — the question above is still waiting. Nothing was done."],
    at,
  }
}

export function noMatchMessage(heard: string, at: string): NewMsg {
  return { kind: 'no-match', heard, at }
}

export function unsupportedMessage(alternative: string, at: string): NewMsg {
  return { kind: 'unsupported', alternative, at }
}

/**
 * **A refused turn is its own outcome** (F-005 AC-36, AC-40; api-contracts § The
 * refused turn) — the seventh `TurnOutcome` member, and the reason it had to be
 * one rather than an improvisation over the existing six:
 *
 * - `no_match` is a **lie** — the task *was* matched;
 * - the failure envelope reports a **server fault** for a healthy turn;
 * - *write nothing and say nothing* **passes AC-40's own fixture row** if that
 *   row asserts only that nothing was written.
 *
 * So: the task is unchanged (AC-18's whole-write scope), the turn is not applied,
 * and **the user is told the change was refused and why**. Rendering it here is
 * what makes AC-36's *"visible outcome"* verified on web as well as api (tester
 * W12): left as an `(api)`-tagged promise, no client tier checks it.
 *
 * **The WORDING is F-002's and this is a placeholder.** `F-002 ## What speaks,
 * and from what` is declared exhaustive and closed and carries **no refusal
 * frame**, so a refused turn selects none — which is an amendment F-002 owes and
 * this client cannot make (`F-005 ## Impact §3`, routed to the orchestrator).
 * Until it lands, the reason is stated from a **closed switch of literals**, never
 * a template over the reason code: a template is how an unenumerated combination
 * ships fluent text nobody reviewed (L-008). An unknown reason falls back to a
 * sentence that names no cause rather than inventing one.
 */
export function refusedMessage(
  reason: string,
  field: string | null,
  at: string,
): NewMsg {
  return { kind: 'outcome', head: 'That change was refused', body: [refusalBody(reason, field)], at }
}

function refusalBody(reason: string, field: string | null): string {
  switch (reason) {
    case 'empty_title':
      return 'A task needs a name, so nothing was changed.'
    case 'priority_not_in_set':
      return 'Priority can be none, low, medium or high — nothing was changed.'
    case 'note_not_text':
      return 'A note has to be text, so nothing was changed.'
    case 'structural_field_not_settable':
      return "Steps and repeats are set by hand on the task itself, not by asking — nothing was changed."
    case 'step_not_addressable':
      return 'Steps live inside their task and cannot be changed by asking — nothing was changed.'
    case 'nesting_too_deep':
      return 'A step cannot have steps of its own, so nothing was changed.'
    case 'repeat_on_step':
      return 'Only a whole task can repeat, not one of its steps — nothing was changed.'
    case 'until_and_count':
      return 'A repeat ends on a date or after a number of runs, not both — nothing was changed.'
    case 'end_before_due':
      return 'That end date is before the task is due, so nothing was changed.'
    case 'clear_due_while_repeating':
      return 'A repeating task needs a due date — end the repeat first. Nothing was changed.'
    case 'timezone_unknown':
      return "This app doesn't know your time zone yet, so the date couldn't be worked out. Nothing was changed."
    case 'length_exceeded':
      return 'That was too long to save, so nothing was changed.'
    default:
      return field === null
        ? 'Nothing was changed.'
        : 'That is not something the assistant can change. Nothing was changed.'
  }
}

export function aiErrorMessage(retryTurnId: string | null, at: string): NewMsg {
  return {
    kind: 'error',
    head: "Couldn't send",
    body: [
      "The assistant couldn't handle that one. Nothing changed — your words are still in the box below.",
    ],
    retryTurnId,
    at,
  }
}

const UNDO_REFUSAL_BODY: Record<string, string> = {
  not_undoable: 'There is nothing to undo — nothing has been applied in this session.',
  not_newest: "That can't be undone any more — a newer change came after it.",
  session_closed: "That session has closed, so its changes can't be undone.",
}

/** AC-6/AC-8: a refused undo is a visible outcome stating why, never silence. */
export function undoRefusedMessage(reason: string, at: string): NewMsg {
  return {
    kind: 'outcome',
    head: null,
    body: [UNDO_REFUSAL_BODY[reason] ?? "That can't be undone right now."],
    at,
  }
}

/** Undo result → reverted message (AC-7): skipped tasks named; all-skipped
 * renders "Nothing was undone", never dressed as success. */
export function revertedMessage(
  undo: Pick<UndoOutcomeWire, 'reverted' | 'skipped' | 'nothing_reverted'>,
  lineFor: (taskId: string) => DiffLine | null,
  at: string,
): NewMsg {
  if (undo.nothing_reverted) {
    const titles = undo.skipped.map((s) => s.title).join(', ')
    return {
      kind: 'reverted',
      head: 'Nothing was undone',
      body: [`They all changed after my edit: ${titles}. I left them as they are.`],
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
  // "Undone:" is the mockup's published label for the case it renders (a task
  // the turn created, taken away again). The second group — a task whose edited
  // field value came back — has no published label, and "Restored:" is not
  // available: §Buttons bans restore/revert/roll back for anything in the undo
  // family. "Put back:" is the placeholder; reported to design as a gap.
  if (removed.length > 0) body.push(`Undone: ${removed.join(', ')}.`)
  if (restored.length > 0) body.push(`Put back: ${restored.join(', ')}.`)
  for (const s of undo.skipped) {
    body.push(`Skipped: ${s.title} — it changed after my edit, so I left it alone.`)
  }
  const skipped = undo.skipped.length
  const head =
    skipped === 0
      ? 'Undone'
      : `Undone — except ${skipped === 1 ? 'one task' : `${skipped} tasks`}`
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
    // F-005 AC-36 / AC-40 — a refused turn carries NO marks: the task did not
    // enter `changed_task_ids`, so there is nothing to attribute, and attributing
    // a change that did not happen is the F-001 AC-4 failure `## Impact §1` exists
    // to prevent (a message that names a task and cannot say what happened to it).
    case 'refused':
      return { messages: [refusedMessage(outcome.reason, outcome.field, at)], marks: null }
    // F-006 AC-14 — trash_read is informational, no mutation, no marks
    case 'trash_read': {
      const head = outcome.query === 'task_in_trash'
        ? `${outcome.task_title ?? 'That task'} is in the trash`
        : outcome.entry_count === 0
          ? 'The trash is empty'
          : `${outcome.entry_count} ${outcome.entry_count === 1 ? 'entry' : 'entries'} in the trash`
      return {
        messages: [{
          kind: 'outcome' as const,
          head,
          body: [],
          at,
        }],
        marks: null,
      }
    }
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
  const reason = b.close_reason === 'idle' ? 'no activity' : 'you closed it'
  const head = `Session closed — ${reason} · ${formatStamp(b.closed_at, ctx.now)}`
  const lines: string[] = []
  for (const q of b.declined_questions) {
    const n = q.task_titles.length
    const label = q.kind === 'bulk_delete' ? `Delete ${n} ${tasksWord(n)}?` : 'Which task?'
    lines.push(
      `Closing the session declined “${label}” — ${q.task_titles.join(', ')} were all kept.`,
    )
  }
  for (const late of b.late_outcomes) {
    lines.push(`While you were away: ${describeLateOutcome(late, ctx)}`)
  }
  return { kind: 'boundary', head, lines, at: b.closed_at }
}

function describeLateOutcome(
  late: BoundaryWire['late_outcomes'][number],
  ctx: MessageContext,
): string {
  if (late.status === 'failed')
    return "one turn couldn't be handled — what you said is still saved in the session."
  const o = late.outcome
  if (o !== null && o !== undefined && o.kind === 'applied') {
    const parts: string[] = []
    for (const t of o.created_titles) parts.push(`added “${t}”`)
    for (const t of o.deleted_titles) parts.push(`deleted “${t}”`)
    const edits = new Set(
      o.diff.filter((d) => d.old !== null && d.new !== null).map((d) => d.task_id),
    )
    for (const id of edits) {
      const title = ctx.titleFor(id)
      parts.push(title === null ? 'edited 1 task' : `edited “${title}”`)
    }
    if (parts.length > 0) return `${parts.join('; ')}.`
  }
  if (o !== null && o !== undefined && o.kind === 'resolution' && o.executed) {
    const del = o.executed.deleted_titles
    if (del.length > 0) return `deleted ${del.join(', ')}.`
  }
  // Defensive: some harness stubs summarize late outcomes as a plain string.
  const summary = (late as { summary?: unknown }).summary
  if (typeof summary === 'string') return `${summary}.`
  return 'a change went through.'
}

// ---------------------------------------------------------------------------
// Mic-mode guidance messages (AC-21 / AC-22 — the message states which cause)
// ---------------------------------------------------------------------------

export function permissionDeniedMessage(at: string): NewMsg {
  return {
    kind: 'info',
    head: 'Microphone needs permission',
    body: [
      'Your browser is blocking the microphone for this page. Allow it in the site settings and the mic lights up again.',
      'Typing still works as usual.',
    ],
    cta: 'permission',
    at,
  }
}

export function transientFailureMessage(at: string): NewMsg {
  return {
    kind: 'info',
    head: 'Speech recognition is busy',
    body: [
      "The recognition service isn't answering. It usually clears in a moment — the mic will come back on its own.",
      'Typing still works as usual.',
    ],
    cta: null,
    at,
  }
}
