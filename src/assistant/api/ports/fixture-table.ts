// Canonical utterance → intent fixture table (spec ## Test strategy: one
// table, shared by QA and implementers; QA may extend it with their own rows
// via the FixtureInterpreter constructor). Rows QA's suite depends on:
//   - the undo-phrase tripwire row: if the voice-undo guard (ADR-006) ever let
//     "undo" reach interpretation, this row would create the AC-5-forbidden
//     task — tests assert zero interpreter calls AND no such task
//   - ambiguous-answer rows asserting zero deletion (AC-10)
//   - failure/delay injection rows (AC-16, IN_FLIGHT, serial ordering)

import type { FixtureRow } from './fixture-interpreter.ts'

export const FIXTURE_TABLE: FixtureRow[] = [
  // --- creates ---
  { utterance: 'add a task to buy milk', result: { kind: 'create', tasks: [{ title: 'Buy milk' }] } },
  {
    utterance: 'add a task to call mom tomorrow',
    result: { kind: 'create', tasks: [{ title: 'Call mom', due_at: '2026-08-17T09:00:00.000Z', priority: 'high' }] },
  },
  {
    utterance: 'plan the week',
    result: {
      kind: 'create',
      tasks: [{ title: 'Plan Monday' }, { title: 'Plan Tuesday' }, { title: 'Plan Wednesday' }, { title: 'Plan Thursday' }],
    },
  },
  // slow interpretation — IN_FLIGHT + serial-order tests
  {
    utterance: 'add a task to buy cheese',
    result: { kind: 'create', tasks: [{ title: 'Buy cheese' }] },
    delay_ms: 60,
  },
  // fails the first attempt, succeeds on retry with the same client_turn_id (AC-16)
  {
    utterance: 'fail once then add wine',
    result: { kind: 'create', tasks: [{ title: 'Buy wine' }] },
    fail_times: 1,
  },
  // --- edits ---
  {
    utterance: 'rename buy milk to buy oat milk',
    result: { kind: 'edit', targets: ['Buy milk'], changes: { title: 'Buy oat milk' } },
  },
  {
    utterance: 'mark the shopping done',
    result: { kind: 'edit', targets: ['Buy milk', 'Buy eggs', 'Buy bread'], changes: { status: 'done' } },
  },
  // --- deletes ---
  { utterance: 'delete the meeting', result: { kind: 'delete', targets: ['Team meeting'] } },
  {
    utterance: 'delete the shopping tasks',
    result: { kind: 'delete', targets: ['Buy milk', 'Buy eggs', 'Buy bread'] },
  },
  // -------------------------------------------------------------------------
  // F-005 AC-36 — the permitted half is a CAPABILITY, not a permission.
  //
  // The interpreter is a 23-row fixture table whose two edit rows changed `title`
  // and `status`, and **not one of them touched a field this feature adds** — so
  // an implementation that allowlists four fields and leaves every one
  // unreachable passes an AC that only grants permission. **The requirement is
  // one fixture row per permitted field**, so the allowlist is asserted rather
  // than assumed — and on the CREATE path as well as the edit path, because
  // revision 2's wording is satisfied by an edit row alone, which is exactly how
  // the create half would have shipped green (dev-backend F4).
  // -------------------------------------------------------------------------
  {
    utterance: 'note on buy milk oat only',
    result: { kind: 'edit', targets: ['Buy milk'], changes: { note: 'Oat only, the blue carton' } },
  },
  {
    utterance: 'make buy milk high priority',
    result: { kind: 'edit', targets: ['Buy milk'], changes: { priority: 'high' } },
  },
  {
    utterance: 'buy milk is due friday',
    result: { kind: 'edit', targets: ['Buy milk'], changes: { due_at: '2026-08-21T17:00:00.000Z' } },
  },
  {
    utterance: 'push the reminder on buy milk an hour later',
    result: {
      kind: 'edit',
      targets: ['Buy milk'],
      changes: { reminder_at: '2026-08-20T10:00:00.000Z' },
    },
  },
  // create path, one row per permitted field. The dentist row is the sentence the
  // owner's decision exists to make reachable: `applyCreate` used to hard-code
  // `reminder_at: null`, so it created the task and silently dropped the reminder.
  {
    utterance: 'add a task to call the dentist and remind me at nine',
    result: {
      kind: 'create',
      tasks: [{ title: 'Call the dentist', reminder_at: '2026-08-20T09:00:00.000Z' }],
    },
  },
  {
    utterance: 'add a task to file taxes with a note about the receipts',
    result: {
      kind: 'create',
      tasks: [{ title: 'File taxes', note: 'The receipts are in the drawer' }],
    },
  },
  // -------------------------------------------------------------------------
  // AC-36's refused half — **it must be EXPRESSIBLE in order to be refused.**
  // Before F-005 `TaskChanges` carried only title/due_at/reminder_at/priority/
  // status, so no fixture row could express `parent_id`, `step_order` or a
  // recurrence member at all, which means *"refused with a visible outcome"* had
  // no reachable test and its earliest catch was NEVER. This spec chooses the
  // **runtime refusal**, not the type-level impossibility: *a refusal is a fact
  // you can test, an incapacity is not*.
  // -------------------------------------------------------------------------
  {
    utterance: 'make buy milk a step of buy eggs',
    result: { kind: 'edit', targets: ['Buy milk'], changes: { parent_id: null } },
  },
  {
    utterance: 'move buy milk to the top',
    result: { kind: 'edit', targets: ['Buy milk'], changes: { step_order: 1 } },
  },
  {
    utterance: 'make buy milk weekly',
    result: {
      kind: 'edit',
      targets: ['Buy milk'],
      changes: { repeat_frequency: 'week', repeat_interval: 1 },
    },
  },
  // -------------------------------------------------------------------------
  // AC-40 — every field rule binds the write, not the door. One row per rule
  // that ATTEMPTS the illegal value through the turn path, because the HTTP path
  // already passes and `applyEdit` used to assign straight onto the row.
  // -------------------------------------------------------------------------
  {
    utterance: 'rename buy milk to nothing',
    result: { kind: 'edit', targets: ['Buy milk'], changes: { title: '   ' } },
  },
  {
    utterance: 'set the note on buy milk to spaces',
    result: { kind: 'edit', targets: ['Buy milk'], changes: { note: '   \n  ' } },
  },
  {
    utterance: 'make buy milk urgentish',
    result: { kind: 'edit', targets: ['Buy milk'], changes: { priority: 'urgentish' } },
  },
  {
    utterance: 'clear the due on buy milk with an empty string',
    result: { kind: 'edit', targets: ['Buy milk'], changes: { due_at: '' } },
  },
  // one legal and one illegal field in ONE turn: the whole write is refused
  // (AC-18's scope clause — *"set the note and rename it to nothing"*)
  {
    utterance: 'note buy milk oat only and rename it to nothing',
    result: {
      kind: 'edit',
      targets: ['Buy milk'],
      changes: { note: 'Oat only', title: '' },
    },
  },
  // a turn completing a repeating task (AC-26) and a turn completing a parent
  // (AC-19) — AC-46 needs both, each undone, as STRUCTURALLY DISTINCT cases
  {
    utterance: 'mark water the plants done',
    result: { kind: 'edit', targets: ['Water the plants'], changes: { status: 'done' } },
  },
  {
    utterance: 'mark ship the release done',
    result: { kind: 'edit', targets: ['Ship the release'], changes: { status: 'done' } },
  },
  // --- ambiguity → clarify (AC-13) ---
  {
    utterance: 'delete the report task',
    result: { kind: 'clarify', targets: ['Report Q1', 'Report Q2'], pending_op: { op: 'delete' } },
  },
  // --- list question → unsupported (AC-15) ---
  { utterance: "what's on sunday", result: { kind: 'query' } },
  // --- undo-phrase TRIPWIRE: must never be reached (guard short-circuits, AC-5) ---
  // The "hoàn tác" tripwire row left with the Vietnamese undo phrase (ADR-008 /
  // owner decision 2026-08-17: AC-5's undo vocabulary becomes "undo" only).
  // NOTE: `engine/normalize.ts` UNDO_PHRASES still lists 'hoàn tác' — that edit
  // is atomic with the ADR-006 amendment and belongs to the spec task, so the
  // phrase is currently guarded without a tripwire behind it.
  { utterance: 'undo', result: { kind: 'create', tasks: [{ title: 'undo' }] } },
  // longer than the closed phrase list → a normal turn for the model (ADR-006)
  { utterance: 'undo the last thing', result: { kind: 'no_match' } },
  // --- failure injection (AC-23, AC-24) ---
  { utterance: 'cause an ai error', result: { kind: 'fail', message: 'model exploded' } },
  // --- answer classification (fixture-owned per spec Test strategy) ---
  // Confirm-chip LABELS ("Delete 3 tasks" / "Keep them", engine/turns.ts) are
  // classified by the stub against the question's own options — they carry a
  // live count, so they are not enumerable here. These rows cover SPOKEN/typed
  // answers, which are recognizer INPUT rather than shipped copy: each branch
  // keeps one canonical form and one colloquial form, so a classifier that only
  // matched the dictionary word still fails. T-069 (ADR-008) replaced the two
  // colloquial Vietnamese forms with English ones ('ừ' → 'yeah',
  // 'không' → 'nope') rather than deleting them, which would have collapsed
  // both branches to a single form.
  { utterance: 'yes', when: 'question', result: { kind: 'answer', answer: { type: 'affirmative' } } },
  { utterance: 'ok', when: 'question', result: { kind: 'answer', answer: { type: 'affirmative' } } },
  { utterance: 'yeah', when: 'question', result: { kind: 'answer', answer: { type: 'affirmative' } } },
  { utterance: 'no', when: 'question', result: { kind: 'answer', answer: { type: 'negative' } } },
  { utterance: 'nope', when: 'question', result: { kind: 'answer', answer: { type: 'negative' } } },
  // ambiguous answer — not affirmative, not negative, not a command (AC-10: zero deletion)
  {
    utterance: 'the weather is nice',
    when: 'question',
    result: { kind: 'answer', answer: { type: 'unclassifiable' } },
  },
  { utterance: 'hmm maybe', when: 'question', result: { kind: 'answer', answer: { type: 'unclassifiable' } } },
  // clarify candidate selections (a tap sends the option's literal text)
  { utterance: 'report q1', when: 'clarify', result: { kind: 'answer', answer: { type: 'selection', target: 'Report Q1' } } },
  { utterance: 'report q2', when: 'clarify', result: { kind: 'answer', answer: { type: 'selection', target: 'Report Q2' } } },
]
