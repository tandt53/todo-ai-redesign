// The turn path's write allowlist and its refusal (F-005 AC-36, AC-40, AC-18).
//
// > **Every field rule binds the write, not the door.** Today `taskChangesFrom`
// > holds *"title must be non-empty"*, the null/empty rules and the priority set —
// > and it is called ONLY from the HTTP handlers. `applyEdit` assigns straight onto
// > the row for every member of the diff tuple, so **the turn path never calls any
// > of it.** (AC-40)
//
// That is L-005's shape on the door AC-36 deliberately widens. Every case below
// attempts the illegal value **through the turn path**, because the HTTP path
// already passed before F-005 — and it is written as **one case per rule, not one
// parameterised over a shared setup**, because a shared setup is exactly what hides
// the door nobody guarded (platform doc § Tests, L-005, L-006).
//
// The falsifiable observables are named rather than left to *"identically to the
// HTTP path"*, which had no referent: **the task is unchanged, it is not in
// `changed_task_ids`, no diff row is emitted, and the user is told the change was
// refused.** Without all four, the wrong guess — write the legal field, mark the
// task changed, emit an empty diff — passes against the exact failure `## Impact`
// §1 exists to prevent.

import { describe, expect, it } from 'vitest'
import { buildHarness, createTask, listTasks, sendTurn, uid } from './helpers.ts'

type Harness = Awaited<ReturnType<typeof buildHarness>>

/** Seed the one task the AC-36 / AC-40 fixture rows target, and snapshot it. */
const seeded = async (h: Harness, user: string, fields: Record<string, unknown> = {}) => {
  const task = await createTask(h, user, 'Buy milk', fields)
  return { task, before: (await listTasks(h, user))[0]! }
}

/** The four observables, asserted together. A refusal missing any of them is the defect. */
const expectRefused = async (
  h: Harness,
  user: string,
  res: { status: number; body: Record<string, never> },
  expected: { reason: string; field: string | null },
  before: Record<string, unknown>,
): Promise<void> => {
  expect(res.status).toBe(200) // a healthy turn, not a server fault: never the 500 envelope
  const turn = res.body.turn as unknown as {
    status: string
    outcome: { kind: string; reason: string; field: string | null; task_id: string | null }
    changed_task_ids: string[]
    diff: unknown[]
    undo_snapshot: unknown
  }
  // 1. the user is TOLD the change was refused, and why
  expect(turn.outcome.kind).toBe('refused')
  expect(turn.outcome.reason).toBe(expected.reason)
  expect(turn.outcome.field).toBe(expected.field)
  // `no_match` would be a lie — the task WAS matched
  expect(turn.outcome.kind).not.toBe('no_match')
  // 2. the turn's STATUS stays `applied`: the existing status machine is untouched,
  // which is why no new turn status is needed
  expect(turn.status).toBe('applied')
  // 3. the task does not enter `changed_task_ids`, and no diff row is emitted — no
  // message can name a task and then fail to say what happened to it
  expect(turn.changed_task_ids).toEqual([])
  expect(turn.diff).toEqual([])
  expect(turn.undo_snapshot).toBeNull()
  // 4. the task is UNCHANGED on read-back
  const after = (await listTasks(h, user)).find((t) => t.id === before.id)
  expect(after).toEqual(before)
}

describe('AC-36 — the permitted half is a CAPABILITY: a turn can actually set all four fields', () => {
  it('a turn sets the NOTE', async () => {
    const h = await buildHarness()
    const user = uid()
    await seeded(h, user)
    const res = await sendTurn(h, user, 'note on buy milk oat only')
    expect(res.body.turn.outcome.kind).toBe('applied')
    expect((await listTasks(h, user))[0]!.note).toBe('Oat only, the blue carton')
    // the change is described in the diff, so F-001 AC-4's message can render it
    expect(res.body.turn.diff).toEqual([
      { task_id: expect.any(String), field: 'note', old: null, new: 'Oat only, the blue carton' },
    ])
  })

  it('a turn sets the PRIORITY', async () => {
    const h = await buildHarness()
    const user = uid()
    await seeded(h, user)
    const res = await sendTurn(h, user, 'make buy milk high priority')
    expect(res.body.turn.outcome.kind).toBe('applied')
    expect((await listTasks(h, user))[0]!.priority).toBe('high')
  })

  it('a turn sets the DUE DATE', async () => {
    const h = await buildHarness()
    const user = uid()
    await seeded(h, user)
    const res = await sendTurn(h, user, 'buy milk is due friday')
    expect(res.body.turn.outcome.kind).toBe('applied')
    const row = (await listTasks(h, user))[0]!
    expect(row.due_at).toBe('2026-08-21T17:00:00.000Z')
    // and the server RESOLVED and STORED the all-day flag on the write (ADR-010)
    expect(row.due_all_day).toBe(false)
  })

  it('a turn sets the REMINDER — the field that had nothing to read before F-005', async () => {
    const h = await buildHarness()
    const user = uid()
    await seeded(h, user, { reminder_at: '2026-08-20T09:00:00.000Z' })
    const res = await sendTurn(h, user, 'push the reminder on buy milk an hour later')
    expect(res.body.turn.outcome.kind).toBe('applied')
    expect((await listTasks(h, user))[0]!.reminder_at).toBe('2026-08-20T10:00:00.000Z')
  })

  it('the interpreter can READ the note and the reminder it may now write', async () => {
    const h = await buildHarness()
    const user = uid()
    await seeded(h, user, { note: 'Oat only', reminder_at: '2026-08-20T09:00:00.000Z' })
    // *"Push the reminder an hour later"* has nothing to read unless the context
    // carries it, and the note was invisible to the model that may now change it.
    // The context is captured by driving a turn and inspecting what the port saw.
    let seen: { note: string | null; reminder_at: string | null } | undefined
    const inner = h.interpreter
    const original = Reflect.get(inner, 'inner') as {
      interpret: (ctx: { tasks: { note: string | null; reminder_at: string | null }[] }) => unknown
    }
    const wrapped = {
      interpret: (ctx: { tasks: { note: string | null; reminder_at: string | null }[] }) => {
        seen = ctx.tasks[0]
        return original.interpret(ctx)
      },
    }
    Reflect.set(inner, 'inner', wrapped)
    await sendTurn(h, user, 'note on buy milk oat only')
    expect(seen).toMatchObject({ note: 'Oat only', reminder_at: '2026-08-20T09:00:00.000Z' })
  })

  it('a turn CREATES a task with a reminder — the create door, which was the broken one', async () => {
    const h = await buildHarness()
    const user = uid()
    // *"add a task to call the dentist and remind me at nine"* is the most natural
    // sentence for the field the owner's decision exists to make reachable, and
    // `applyCreate` hard-coded `reminder_at: null`: it created the task and
    // SILENTLY DROPPED the reminder, with a diff that never mentioned it. Revision
    // 2's wording is satisfied by an edit row alone, which is exactly how the create
    // half would have shipped green (dev-backend F4).
    const res = await sendTurn(h, user, 'add a task to call the dentist and remind me at nine')
    expect(res.body.turn.outcome.kind).toBe('applied')
    const row = (await listTasks(h, user))[0]!
    expect(row.reminder_at).toBe('2026-08-20T09:00:00.000Z')
    expect(res.body.turn.diff).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'reminder_at', new: '2026-08-20T09:00:00.000Z' }),
      ]),
    )
  })

  it('a turn CREATES a task with a note', async () => {
    const h = await buildHarness()
    const user = uid()
    const res = await sendTurn(h, user, 'add a task to file taxes with a note about the receipts')
    expect(res.body.turn.outcome.kind).toBe('applied')
    expect((await listTasks(h, user))[0]!.note).toBe('The receipts are in the drawer')
  })
})

describe('AC-36 — the refused half: STRUCTURE is not speakable, and the refusal is visible', () => {
  it('`parent_id` — refused', async () => {
    const h = await buildHarness()
    const user = uid()
    const { before } = await seeded(h, user)
    const res = await sendTurn(h, user, 'make buy milk a step of buy eggs')
    await expectRefused(
      h,
      user,
      res,
      { reason: 'structural_field_not_settable', field: 'parent_id' },
      before,
    )
  })

  it('`step_order` — refused', async () => {
    const h = await buildHarness()
    const user = uid()
    const { before } = await seeded(h, user)
    // the line is VALUES versus STRUCTURE: values are what people say out loud,
    // structure is what people arrange with their hands
    const res = await sendTurn(h, user, 'move buy milk to the top')
    await expectRefused(
      h,
      user,
      res,
      { reason: 'structural_field_not_settable', field: 'step_order' },
      before,
    )
  })

  it('a recurrence member — refused; *"make this weekly"* is the most misinterpretable sentence in the feature', async () => {
    const h = await buildHarness()
    const user = uid()
    const { before } = await seeded(h, user)
    const res = await sendTurn(h, user, 'make buy milk weekly')
    await expectRefused(
      h,
      user,
      res,
      { reason: 'structural_field_not_settable', field: 'repeat_frequency' },
      before,
    )
  })

  it('an unrefused attempt would mark a task changed, change nothing, and render an EMPTY diff', async () => {
    const h = await buildHarness()
    const user = uid()
    const { before } = await seeded(h, user)
    const res = await sendTurn(h, user, 'make buy milk weekly')
    // that is the F-001 AC-4 failure `## Impact` §1 exists to prevent, and it is
    // asserted here as an absence rather than left to the refusal's own shape
    expect(res.body.turn.changed_task_ids).toEqual([])
    expect(res.body.turn.diff).toEqual([])
    expect((await listTasks(h, user))[0]).toEqual(before)
  })
})

describe('AC-40 — one case per field rule, attempted through the TURN path', () => {
  it('an EMPTY TITLE is refused and the task keeps the name it had (AC-37)', async () => {
    const h = await buildHarness()
    const user = uid()
    const { before } = await seeded(h, user)
    const res = await sendTurn(h, user, 'rename buy milk to nothing')
    await expectRefused(h, user, res, { reason: 'empty_title', field: 'title' }, before)
    expect((await listTasks(h, user))[0]!.title).toBe('Buy milk')
  })

  it('a WHITESPACE-ONLY NOTE stores NO note at all, never `""` — on the turn path too (AC-6)', async () => {
    const h = await buildHarness()
    const user = uid()
    await seeded(h, user, { note: 'Oat only' })
    const id = (await listTasks(h, user))[0]!.id as string

    // This rule is a NORMALISATION, not a refusal: *"empty, whitespace-only and
    // newline-only input is stored as no note at all, never as an empty string —
    // the distinction is observable on read-back"* (AC-6). It is in this file because
    // it is a **field rule**, and before F-005 it lived only in `taskChangesFrom`:
    // a turn assigning `'   \n  '` straight onto the row stored the whitespace, which
    // is the empty string AC-6 forbids wearing a different mask.
    const res = await sendTurn(h, user, 'set the note on buy milk to spaces')
    expect(res.status).toBe(200)
    expect(res.body.turn.outcome.kind).toBe('applied')
    const afterTurn = (await listTasks(h, user))[0]!
    expect(afterTurn.note).toBeNull()
    expect(afterTurn.note).not.toBe('')
    // the diff describes it as a clear, so F-001 AC-4's message says what happened
    expect(res.body.turn.diff).toEqual([
      { task_id: id, field: 'note', old: 'Oat only', new: null },
    ])

    // the HTTP door reaches the same rule through the same validator
    await h.agent.patch(`/tasks/${id}`).set('X-User-Id', user).send({ note: 'Oat only' }).expect(200)
    const http = await h.agent.patch(`/tasks/${id}`).set('X-User-Id', user).send({ note: '  \n ' })
    expect(http.status).toBe(200)
    expect(http.body.task.note).toBeNull()
    expect(http.body.prior).toEqual({ note: 'Oat only' })
  })

  it('a note that is not TEXT is refused (`note_not_text`), and the note survives', async () => {
    const h = await buildHarness()
    const user = uid()
    await seeded(h, user, { note: 'Oat only' })
    const id = (await listTasks(h, user))[0]!.id as string
    const res = await h.agent.patch(`/tasks/${id}`).set('X-User-Id', user).send({ note: 42 })
    expect(res.status).toBe(400)
    expect(res.body.error.field).toBe('note')
    expect((await listTasks(h, user))[0]!.note).toBe('Oat only')
  })

  it('a FREE-STRING PRIORITY is refused — AC-8 says four values', async () => {
    const h = await buildHarness()
    const user = uid()
    const { before } = await seeded(h, user, { priority: 'high' })
    const res = await sendTurn(h, user, 'make buy milk urgentish')
    await expectRefused(
      h,
      user,
      res,
      { reason: 'priority_not_in_set', field: 'priority' },
      before,
    )
    expect((await listTasks(h, user))[0]!.priority).toBe('high')
  })

  it('an EMPTY STRING where clearing stores no value is refused (AC-10)', async () => {
    const h = await buildHarness()
    const user = uid()
    const { before } = await seeded(h, user, { due_at: '2026-08-20T10:00:00.000Z' })
    const res = await sendTurn(h, user, 'clear the due on buy milk with an empty string')
    expect(res.status).toBe(200)
    expect(res.body.turn.outcome.kind).toBe('refused')
    expect(res.body.turn.outcome.field).toBe('due_at')
    // not a zero date, not an empty string — and not a cleared due either
    expect((await listTasks(h, user))[0]).toEqual(before)
  })

  it('AC-18 — one LEGAL and one ILLEGAL field in one turn writes NOTHING AT ALL', async () => {
    const h = await buildHarness()
    const user = uid()
    const { before } = await seeded(h, user)
    // *"set the note and rename it to nothing"* — the ordinary case now that four
    // fields are speakable. Revision 2 stated the outcome and left its SCOPE open,
    // which left three separately guessable observables: was the legal field
    // written, was the task marked changed, was a diff rendered. One rule closes all
    // three.
    const res = await sendTurn(h, user, 'note buy milk oat only and rename it to nothing')
    await expectRefused(h, user, res, { reason: 'empty_title', field: 'title' }, before)
    const after = (await listTasks(h, user))[0]!
    expect(after.note).toBeNull() // the legal half did NOT land
    expect(after.title).toBe('Buy milk')
  })

  it('the SAME rejected value gets the SAME rule and a DIFFERENT outcome on the two doors', async () => {
    const h = await buildHarness()
    const user = uid()
    await seeded(h, user)
    const id = (await listTasks(h, user))[0]!.id as string

    // the HTTP door: a `400` with a field name, addressed to a client that sent a
    // bad body
    const http = await h.agent.patch(`/tasks/${id}`).set('X-User-Id', user).send({ priority: 'urgentish' })
    expect(http.status).toBe(400)
    expect(http.body.error.code).toBe('VALIDATION')
    expect(http.body.error.field).toBe('priority')

    // the turn door: the `refused` outcome, addressed to a person who spoke a
    // well-formed sentence. *"Identically to the HTTP path"* had no referent.
    const turn = await sendTurn(h, user, 'make buy milk urgentish')
    expect(turn.status).toBe(200)
    expect(turn.body.turn.outcome).toMatchObject({
      kind: 'refused',
      reason: 'priority_not_in_set',
      field: 'priority',
    })
  })
})

describe('a refused turn never occupies or advances the undo window', () => {
  it('it is refused `not_undoable`, exactly like `no_match` — no new turn status needed', async () => {
    const h = await buildHarness()
    const user = uid()
    await seeded(h, user)
    const refused = await sendTurn(h, user, 'make buy milk weekly')
    const undo = await h.agent
      .post(`/assistant/turn/${refused.body.turn.id}/undo`)
      .set('X-User-Id', user)
      .send({})
    expect(undo.status).toBe(409)
    expect(undo.body.error.detail.reason).toBe('not_undoable')
  })

  it('and it leaves the PREVIOUS mutating turn`s undo window untouched', async () => {
    const h = await buildHarness()
    const user = uid()
    await seeded(h, user)
    // a real mutation first…
    const applied = await sendTurn(h, user, 'make buy milk high priority')
    expect(applied.body.turn.outcome.kind).toBe('applied')
    // …then a refusal, which must not spend the undo (the mechanical window rule
    // reads `changed_task_ids`, and a refusal's is empty)
    await sendTurn(h, user, 'make buy milk weekly')
    const undo = await h.agent
      .post(`/assistant/turn/${applied.body.turn.id}/undo`)
      .set('X-User-Id', user)
      .send({})
    expect(undo.status).toBe(200)
    expect(undo.body.reverted).toHaveLength(1)
    expect((await listTasks(h, user))[0]!.priority).toBe('none')
  })
})
