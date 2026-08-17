// Bulk-delete gate + question resolution (AC-9..13, D2, processing rules 7/8):
// refused-to-apply questions, one-shot resolution, answer binding,
// unclassifiable-stays-pending, supersede, affirmative re-validation, clarify.

import { describe, expect, it } from 'vitest'
import type { Harness } from './helpers.ts'
import {
  buildHarness,
  createTask,
  getSession,
  listTasks,
  sendTurn,
  uid,
} from './helpers.ts'

async function seedShoppingQuestion(h: Harness, user: string) {
  for (const t of ['Buy milk', 'Buy eggs', 'Buy bread']) await createTask(h, user, t)
  const res = await sendTurn(h, user, 'delete the shopping tasks')
  expect(res.status).toBe(200)
  return res.body.turn
}

describe('bulk-delete confirmation (AC-9)', () => {
  it('a delete touching >1 task is refused-to-apply and asks, naming count and titles', async () => {
    const h = await buildHarness()
    const user = uid()
    const turn = await seedShoppingQuestion(h, user)
    expect(turn.status).toBe('asked')
    expect(turn.outcome).toEqual({ kind: 'question' })
    expect(turn.question.kind).toBe('bulk_delete')
    expect(turn.question.task_titles).toEqual(['Buy milk', 'Buy eggs', 'Buy bread'])
    expect(turn.question.task_ids).toHaveLength(3)
    // human-readable chip labels, not protocol tokens (T-006d); English copy
    // transcribed from the mockups' assistant-chip-affirm / -negative (T-069)
    expect(turn.question.options).toEqual(['Delete 3 tasks', 'Keep them'])
    // an asking turn applies nothing (AC-1 carve-out)
    expect(turn.changed_task_ids).toEqual([])
    expect(await listTasks(h, user)).toHaveLength(3)
  })

  it('AC-10: a clearly affirmative answer executes, with the full applied anatomy (AC-11)', async () => {
    const h = await buildHarness()
    const user = uid()
    const asked = await seedShoppingQuestion(h, user)
    const answer = await sendTurn(h, user, 'yes')
    expect(answer.status).toBe(200)
    expect(answer.body.resolutions).toEqual([
      { question_turn_id: asked.id, result: 'executed' },
    ])
    const outcome = answer.body.turn.outcome
    expect(outcome.kind).toBe('resolution')
    expect(outcome.result).toBe('executed')
    expect(outcome.executed.deleted_titles).toEqual(['Buy milk', 'Buy eggs', 'Buy bread'])
    expect(outcome.executed.changed_task_ids).toHaveLength(3)
    expect(await listTasks(h, user)).toHaveLength(0)
    // recorded on the asked turn's question.resolution
    const session = await getSession(h, user)
    const askedNow = session.body.session.messages.find(
      (m: { id: string }) => m.id === asked.id,
    )
    expect(askedNow.question.resolution.result).toBe('executed')
    expect(askedNow.question.resolution.resolved_by_turn_id).toBe(answer.body.turn.id)
  })

  it('AC-10: a negative answer declines and deletes nothing', async () => {
    const h = await buildHarness()
    const user = uid()
    const asked = await seedShoppingQuestion(h, user)
    const answer = await sendTurn(h, user, 'no')
    expect(answer.body.turn.outcome).toEqual({
      kind: 'resolution',
      result: 'declined',
      question_turn_id: asked.id,
    })
    expect(answer.body.resolutions).toEqual([
      { question_turn_id: asked.id, result: 'declined' },
    ])
    expect(await listTasks(h, user)).toHaveLength(3)
  })

  it('AC-10: an unclassifiable utterance executes nothing and the question stays pending', async () => {
    const h = await buildHarness()
    const user = uid()
    const asked = await seedShoppingQuestion(h, user)
    const mumble = await sendTurn(h, user, 'the weather is nice')
    expect(mumble.body.turn.outcome).toEqual({
      kind: 'unclassifiable',
      question_turn_id: asked.id,
    })
    expect(mumble.body.resolutions).toEqual([])
    expect(await listTasks(h, user)).toHaveLength(3) // zero deletion (AC-10)
    // still pending…
    const session = await getSession(h, user)
    const askedNow = session.body.session.messages.find(
      (m: { id: string }) => m.id === asked.id,
    )
    expect(askedNow.question.resolution).toBeNull()
    // …and still resolvable by a real answer
    const answer = await sendTurn(h, user, 'yes')
    expect(answer.body.turn.outcome.result).toBe('executed')
    expect(await listTasks(h, user)).toHaveLength(0)
  })

  it('AC-10: an unrelated command supersedes — the delete is declined and the command proceeds', async () => {
    const h = await buildHarness()
    const user = uid()
    const asked = await seedShoppingQuestion(h, user)
    const cmd = await sendTurn(h, user, 'add a task to call mom tomorrow')
    expect(cmd.body.resolutions).toEqual([
      { question_turn_id: asked.id, result: 'declined_superseded' },
    ])
    expect(cmd.body.turn.outcome.kind).toBe('applied')
    expect(cmd.body.turn.outcome.created_titles).toEqual(['Call mom'])
    const tasks = await listTasks(h, user)
    // the questioned delete never executed; the new task exists
    expect(tasks.map((t) => t.title).sort()).toEqual(
      ['Buy bread', 'Buy eggs', 'Buy milk', 'Call mom'].sort(),
    )
  })

  it('AC-10 one-shot: an answer arriving after resolution never executes and yields already_resolved', async () => {
    const h = await buildHarness()
    const user = uid()
    const asked = await seedShoppingQuestion(h, user)
    await sendTurn(h, user, 'no') // resolves the question: declined
    const calls = h.interpreter.calls.length
    // a tap answer carries an explicit binding to the question's turn
    const late = await sendTurn(h, user, 'Delete 3 tasks', {
      source: 'tap',
      answer_to: asked.id,
    })
    expect(late.status).toBe(200)
    expect(late.body.turn.outcome).toEqual({
      kind: 'resolution',
      result: 'already_resolved',
      question_turn_id: asked.id,
    })
    expect(late.body.resolutions).toEqual([
      { question_turn_id: asked.id, result: 'already_resolved' },
    ])
    expect(await listTasks(h, user)).toHaveLength(3) // the questioned delete never ran
    expect(h.interpreter.calls.length).toBe(calls) // resolved deterministically, no model call
  })

  it('a tap answer with explicit binding executes its question (AC-10 binding rule)', async () => {
    const h = await buildHarness()
    const user = uid()
    const asked = await seedShoppingQuestion(h, user)
    const tap = await sendTurn(h, user, asked.question.options[0] as string, {
      source: 'tap',
      answer_to: asked.id,
    })
    expect(tap.body.turn.outcome.result).toBe('executed')
    expect(await listTasks(h, user)).toHaveLength(0)
  })

  it('AC-12: on affirmative, tasks changed since ask time are dropped and the outcome names the actual count', async () => {
    const h = await buildHarness()
    const user = uid()
    const asked = await seedShoppingQuestion(h, user)
    // manual edit between ask and answer — snapshot comparison must drop it
    const eggsId = (await listTasks(h, user)).find((t) => t.title === 'Buy eggs')!.id as string
    await h.agent
      .patch(`/tasks/${eggsId}`)
      .set('X-User-Id', user)
      .send({ title: 'Buy free-range eggs' })
    const answer = await sendTurn(h, user, 'yes')
    const executed = answer.body.turn.outcome.executed
    expect(executed.deleted_titles.sort()).toEqual(['Buy bread', 'Buy milk'])
    expect(executed.changed_task_ids).toHaveLength(2)
    const remaining = await listTasks(h, user)
    expect(remaining.map((t) => t.title)).toEqual(['Buy free-range eggs'])
    void asked
  })
})

describe('confirm-chip labels — literal-text round trip (T-006d, AC-9/AC-10, WCAG 2.5.3)', () => {
  it('options are human-readable labels whose affirmative names the action and the ACTUAL count', async () => {
    const h = await buildHarness()
    const user = uid()
    // only two of the three shopping tasks exist → the label must say 2, not 3
    for (const t of ['Buy milk', 'Buy eggs']) await createTask(h, user, t)
    const asked = (await sendTurn(h, user, 'delete the shopping tasks')).body.turn
    expect(asked.question.task_ids).toHaveLength(2)
    expect(asked.question.options).toEqual(['Delete 2 tasks', 'Keep them'])
    // the label matches the titles the message names (AC-9)
    expect(asked.question.task_titles).toEqual(['Buy milk', 'Buy eggs'])
  })

  it('tapping the affirmative chip sends its literal text — that text is the transcript AND it executes', async () => {
    const h = await buildHarness()
    const user = uid()
    const asked = await seedShoppingQuestion(h, user)
    const label = asked.question.options[0] as string
    expect(label).toBe('Delete 3 tasks')
    const tap = await sendTurn(h, user, label, { source: 'tap', answer_to: asked.id })
    // the user's own bubble reads the chip label, never "Yes" (WCAG 2.5.3)
    expect(tap.body.turn.transcript_raw).toBe('Delete 3 tasks')
    expect(tap.body.turn.outcome.result).toBe('executed')
    expect(tap.body.turn.outcome.executed.deleted_titles).toHaveLength(3)
    expect(await listTasks(h, user)).toHaveLength(0)
  })

  it('tapping the negative chip ("Keep them") declines and keeps every task', async () => {
    const h = await buildHarness()
    const user = uid()
    const asked = await seedShoppingQuestion(h, user)
    const label = asked.question.options[1] as string
    expect(label).toBe('Keep them')
    const tap = await sendTurn(h, user, label, { source: 'tap', answer_to: asked.id })
    expect(tap.body.turn.transcript_raw).toBe('Keep them')
    expect(tap.body.turn.outcome.result).toBe('declined')
    expect(await listTasks(h, user)).toHaveLength(3)
  })

  it('spoken answers still classify alongside the labels — yes/ok/yeah execute, no/nope decline', async () => {
    for (const [utterance, expected] of [
      ['yes', 'executed'],
      ['ok', 'executed'],
      ['yeah', 'executed'],
      ['no', 'declined'],
      ['nope', 'declined'],
    ] as const) {
      const h = await buildHarness()
      const user = uid()
      await seedShoppingQuestion(h, user)
      const answer = await sendTurn(h, user, utterance, { source: 'voice' })
      expect(answer.body.turn.outcome.result, utterance).toBe(expected)
      expect(await listTasks(h, user), utterance).toHaveLength(expected === 'executed' ? 0 : 3)
    }
  })

  it('ambiguous utterances stay ambiguous — labels did not widen the classifier', async () => {
    for (const utterance of ['the weather is nice', 'hmm maybe']) {
      const h = await buildHarness()
      const user = uid()
      const asked = await seedShoppingQuestion(h, user)
      const answer = await sendTurn(h, user, utterance, { source: 'voice' })
      expect(answer.body.turn.outcome, utterance).toEqual({
        kind: 'unclassifiable',
        question_turn_id: asked.id,
      })
      expect(await listTasks(h, user), utterance).toHaveLength(3) // zero deletion (AC-10)
    }
  })
})

describe('clarification (AC-13)', () => {
  async function seedClarify(h: Harness, user: string) {
    await createTask(h, user, 'Report Q1')
    await createTask(h, user, 'Report Q2')
    const res = await sendTurn(h, user, 'delete the report task')
    expect(res.body.turn.status).toBe('asked')
    return res.body.turn
  }

  it('an ambiguous reference asks with the actual candidates; no data changes until answered', async () => {
    const h = await buildHarness()
    const user = uid()
    const turn = await seedClarify(h, user)
    expect(turn.question.kind).toBe('clarify')
    expect(turn.question.task_titles).toEqual(['Report Q1', 'Report Q2'])
    expect(turn.question.options).toEqual(['Report Q1', 'Report Q2'])
    expect(await listTasks(h, user)).toHaveLength(2)
  })

  it('a tap sending the option literal text executes the pending op on that candidate only', async () => {
    const h = await buildHarness()
    const user = uid()
    const asked = await seedClarify(h, user)
    const tap = await sendTurn(h, user, 'Report Q1', { source: 'tap', answer_to: asked.id })
    expect(tap.body.turn.outcome.result).toBe('executed')
    expect(tap.body.turn.outcome.executed.deleted_titles).toEqual(['Report Q1'])
    const remaining = await listTasks(h, user)
    expect(remaining.map((t) => t.title)).toEqual(['Report Q2'])
  })

  it('an unrelated command supersedes a clarify question too (same D2 rule)', async () => {
    const h = await buildHarness()
    const user = uid()
    const asked = await seedClarify(h, user)
    const cmd = await sendTurn(h, user, 'add a task to buy milk')
    expect(cmd.body.resolutions).toEqual([
      { question_turn_id: asked.id, result: 'declined_superseded' },
    ])
    expect(await listTasks(h, user)).toHaveLength(3) // both reports intact + new task
  })
})
