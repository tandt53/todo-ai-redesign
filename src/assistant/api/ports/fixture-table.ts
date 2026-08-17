// Canonical utterance → intent fixture table (spec ## Test strategy: one
// table, shared by QA and implementers; QA may extend it with their own rows
// via the FixtureInterpreter constructor). Rows QA's suite depends on:
//   - the undo-phrase tripwire rows: if the voice-undo guard (ADR-006) ever
//     let "undo" / "hoàn tác" reach interpretation, these rows would create the
//     AC-5-forbidden task — tests assert zero interpreter calls AND no such task
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
  // --- ambiguity → clarify (AC-13) ---
  {
    utterance: 'delete the report task',
    result: { kind: 'clarify', targets: ['Report Q1', 'Report Q2'], pending_op: { op: 'delete' } },
  },
  // --- list question → unsupported (AC-15) ---
  { utterance: "what's on sunday", result: { kind: 'query' } },
  // --- undo-phrase TRIPWIRES: must never be reached (guard short-circuits, AC-5) ---
  { utterance: 'undo', result: { kind: 'create', tasks: [{ title: 'undo' }] } },
  { utterance: 'hoàn tác', result: { kind: 'create', tasks: [{ title: 'hoàn tác' }] } },
  // longer than the closed phrase list → a normal turn for the model (ADR-006)
  { utterance: 'undo the last thing', result: { kind: 'no_match' } },
  // --- failure injection (AC-23, AC-24) ---
  { utterance: 'cause an ai error', result: { kind: 'fail', message: 'model exploded' } },
  // --- answer classification (fixture-owned per spec Test strategy) ---
  // Confirm-chip LABELS ("Delete 3 tasks" / "Keep them") are classified by the
  // stub against the question's own options — they carry a live count, so they
  // are not enumerable here. These rows cover SPOKEN/typed answers.
  { utterance: 'yes', when: 'question', result: { kind: 'answer', answer: { type: 'affirmative' } } },
  { utterance: 'ok', when: 'question', result: { kind: 'answer', answer: { type: 'affirmative' } } },
  { utterance: 'ừ', when: 'question', result: { kind: 'answer', answer: { type: 'affirmative' } } },
  { utterance: 'no', when: 'question', result: { kind: 'answer', answer: { type: 'negative' } } },
  { utterance: 'không', when: 'question', result: { kind: 'answer', answer: { type: 'negative' } } },
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
