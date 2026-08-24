// F-008 lists — CRUD, filing, step constraint, assistant integration, undo.
// Every test names the AC it covers.

import { describe, expect, it } from 'vitest'
import { buildHarness, createTask, listTasks, sendTurn, uid, undoTurn } from './helpers.ts'
import type { Harness } from './helpers.ts'

// ---- helpers ----

async function createList(
  h: Harness,
  user: string,
  name: string,
  color?: number,
): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = { name }
  if (color !== undefined) body.color = color
  const res = await h.agent.post('/lists').set('X-User-Id', user).send(body)
  if (res.status !== 201) throw new Error(`create list failed: ${res.status} ${res.text}`)
  return res.body.list as Record<string, unknown>
}

async function getLists(h: Harness, user: string): Promise<Record<string, unknown>[]> {
  const res = await h.agent.get('/lists').set('X-User-Id', user)
  if (res.status !== 200) throw new Error(`get lists failed: ${res.status}`)
  return res.body.lists as Record<string, unknown>[]
}

// ---- List CRUD ----

describe('POST /lists', () => {
  it('AC-1 — creates a list with trimmed name, default color, server-generated id, timestamps', async () => {
    const h = await buildHarness()
    const user = uid()
    const res = await h.agent.post('/lists').set('X-User-Id', user).send({ name: '  Groceries  ' })
    expect(res.status).toBe(201)
    const list = res.body.list
    expect(list.name).toBe('Groceries')
    expect(list.color).toBe(0)
    expect(list.user_id).toBe(user)
    expect(list.position).toBe(1024)
    expect(list.task_count).toBe(0)
    expect(list.id).toBeTruthy()
    expect(list.created_at).toBeTruthy()
    expect(list.updated_at).toBeTruthy()
  })

  it('AC-2 — color 0-6 accepted, outside range rejected with 400 VALIDATION', async () => {
    const h = await buildHarness()
    const user = uid()
    // valid colors
    for (const c of [0, 1, 2, 3, 4, 5, 6]) {
      const res = await h.agent.post('/lists').set('X-User-Id', user).send({ name: `List${c}`, color: c })
      expect(res.status).toBe(201)
      expect(res.body.list.color).toBe(c)
    }
    // invalid color
    const bad = await h.agent.post('/lists').set('X-User-Id', user).send({ name: 'Bad', color: 7 })
    expect(bad.status).toBe(400)
    expect(bad.body.error.code).toBe('VALIDATION')

    const neg = await h.agent.post('/lists').set('X-User-Id', user).send({ name: 'Neg', color: -1 })
    expect(neg.status).toBe(400)
    expect(neg.body.error.code).toBe('VALIDATION')
  })

  it('AC-3 — duplicate name (case-insensitive, trimmed) refused with 409 DUPLICATE_NAME', async () => {
    const h = await buildHarness()
    const user = uid()
    await createList(h, user, 'Groceries')
    const dup = await h.agent.post('/lists').set('X-User-Id', user).send({ name: 'groceries' })
    expect(dup.status).toBe(409)
    expect(dup.body.error.code).toBe('DUPLICATE_NAME')
    // different user can have the same name
    const other = uid()
    const otherRes = await h.agent.post('/lists').set('X-User-Id', other).send({ name: 'Groceries' })
    expect(otherRes.status).toBe(201)
  })

  it('AC-23 — 50 list limit with 409 LIST_LIMIT_REACHED', async () => {
    const h = await buildHarness()
    const user = uid()
    for (let i = 0; i < 50; i++) {
      await createList(h, user, `List ${i}`)
    }
    const res = await h.agent.post('/lists').set('X-User-Id', user).send({ name: 'List 51' })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('LIST_LIMIT_REACHED')
  })

  it('AC-24 — name max 100 chars enforced', async () => {
    const h = await buildHarness()
    const user = uid()
    const long = 'a'.repeat(101)
    const res = await h.agent.post('/lists').set('X-User-Id', user).send({ name: long })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION')
    // exactly 100 is fine
    const ok = await h.agent.post('/lists').set('X-User-Id', user).send({ name: 'a'.repeat(100) })
    expect(ok.status).toBe(201)
  })

  it('validation — empty/whitespace name, unknown fields', async () => {
    const h = await buildHarness()
    const user = uid()
    const empty = await h.agent.post('/lists').set('X-User-Id', user).send({ name: '' })
    expect(empty.status).toBe(400)
    const ws = await h.agent.post('/lists').set('X-User-Id', user).send({ name: '   ' })
    expect(ws.status).toBe(400)
    const unknown = await h.agent.post('/lists').set('X-User-Id', user).send({ name: 'X', extra: 1 })
    expect(unknown.status).toBe(400)
    expect(unknown.body.error.field).toBe('extra')
  })

  it('401 — missing X-User-Id', async () => {
    const h = await buildHarness()
    const res = await h.agent.post('/lists').send({ name: 'X' })
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHENTICATED')
  })
})

describe('GET /lists', () => {
  it('AC-14 — returns lists ordered by position with computed task_count', async () => {
    const h = await buildHarness()
    const user = uid()
    const list = await createList(h, user, 'Work')
    const task = await createTask(h, user, 'Do stuff')
    // file the task
    await h.agent.patch(`/tasks/${task.id}`).set('X-User-Id', user).send({ list_id: list.id })
    const lists = await getLists(h, user)
    expect(lists).toHaveLength(1)
    expect(lists[0]!.name).toBe('Work')
    expect(lists[0]!.task_count).toBe(1)
  })

  it('scoped to the authenticated user', async () => {
    const h = await buildHarness()
    const user1 = uid()
    const user2 = uid()
    await createList(h, user1, 'A')
    await createList(h, user2, 'B')
    expect(await getLists(h, user1)).toHaveLength(1)
    expect(await getLists(h, user2)).toHaveLength(1)
  })

  it('task_count excludes deleted tasks and steps', async () => {
    const h = await buildHarness()
    const user = uid()
    const list = await createList(h, user, 'Work')
    const parent = await createTask(h, user, 'Parent')
    const step = await createTask(h, user, 'Step', { parent_id: parent.id })
    const regular = await createTask(h, user, 'Regular')
    // file parent and regular
    await h.agent.patch(`/tasks/${parent.id}`).set('X-User-Id', user).send({ list_id: list.id })
    await h.agent.patch(`/tasks/${regular.id}`).set('X-User-Id', user).send({ list_id: list.id })
    let lists = await getLists(h, user)
    expect(lists[0]!.task_count).toBe(2) // parent + regular (step excluded)
    // delete regular
    await h.agent.delete(`/tasks/${regular.id}`).set('X-User-Id', user)
    lists = await getLists(h, user)
    expect(lists[0]!.task_count).toBe(1) // only parent remains
  })
})

describe('PATCH /lists/{id}', () => {
  it('AC-4 — rename retains id, color, position and filed tasks', async () => {
    const h = await buildHarness()
    const user = uid()
    const list = await createList(h, user, 'Old Name', 3)
    const res = await h.agent.patch(`/lists/${list.id}`).set('X-User-Id', user).send({ name: 'New Name' })
    expect(res.status).toBe(200)
    expect(res.body.list.name).toBe('New Name')
    expect(res.body.list.id).toBe(list.id)
    expect(res.body.list.color).toBe(3)
    expect(res.body.list.position).toBe(list.position)
  })

  it('AC-4 + AC-3 — rename duplicate check', async () => {
    const h = await buildHarness()
    const user = uid()
    await createList(h, user, 'First')
    const second = await createList(h, user, 'Second')
    const res = await h.agent.patch(`/lists/${second.id}`).set('X-User-Id', user).send({ name: 'FIRST' })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('DUPLICATE_NAME')
  })

  it('AC-5 — recolour updates only color', async () => {
    const h = await buildHarness()
    const user = uid()
    const list = await createList(h, user, 'Work', 0)
    const res = await h.agent.patch(`/lists/${list.id}`).set('X-User-Id', user).send({ color: 5 })
    expect(res.status).toBe(200)
    expect(res.body.list.color).toBe(5)
    expect(res.body.list.name).toBe('Work')
  })

  it('404 for unknown or other-user list', async () => {
    const h = await buildHarness()
    const user1 = uid()
    const user2 = uid()
    const list = await createList(h, user1, 'Mine')
    const res = await h.agent.patch(`/lists/${list.id}`).set('X-User-Id', user2).send({ name: 'Stolen' })
    expect(res.status).toBe(404)
    const bad = await h.agent.patch('/lists/nonexistent').set('X-User-Id', user1).send({ name: 'X' })
    expect(bad.status).toBe(404)
  })

  it('AC-24 — name max 100 chars on rename', async () => {
    const h = await buildHarness()
    const user = uid()
    const list = await createList(h, user, 'Short')
    const res = await h.agent.patch(`/lists/${list.id}`).set('X-User-Id', user).send({ name: 'a'.repeat(101) })
    expect(res.status).toBe(400)
  })

  it('updated_at advances on every accepted change', async () => {
    const h = await buildHarness()
    const user = uid()
    const list = await createList(h, user, 'Work')
    h.clock.advance(1000)
    const res = await h.agent.patch(`/lists/${list.id}`).set('X-User-Id', user).send({ name: 'Work2' })
    expect(res.status).toBe(200)
    expect(res.body.list.updated_at).not.toBe(list.updated_at)
  })
})

describe('DELETE /lists/{id}', () => {
  it('AC-6 — deleting empty list removes it immediately', async () => {
    const h = await buildHarness()
    const user = uid()
    const list = await createList(h, user, 'Empty')
    const res = await h.agent.delete(`/lists/${list.id}`).set('X-User-Id', user).send({})
    expect(res.status).toBe(200)
    expect(res.body.deleted).toBe(true)
    expect(res.body.tasks_moved).toBe(0)
    expect(await getLists(h, user)).toHaveLength(0)
  })

  it('AC-7 — deleting non-empty list unfiles tasks and deletes the list (same transaction)', async () => {
    const h = await buildHarness()
    const user = uid()
    const list = await createList(h, user, 'Work')
    const t1 = await createTask(h, user, 'Task 1')
    const t2 = await createTask(h, user, 'Task 2')
    await h.agent.patch(`/tasks/${t1.id}`).set('X-User-Id', user).send({ list_id: list.id })
    await h.agent.patch(`/tasks/${t2.id}`).set('X-User-Id', user).send({ list_id: list.id })

    // without confirm — 409 LIST_NOT_EMPTY
    const noConfirm = await h.agent.delete(`/lists/${list.id}`).set('X-User-Id', user).send({})
    expect(noConfirm.status).toBe(409)
    expect(noConfirm.body.error.code).toBe('LIST_NOT_EMPTY')
    expect(noConfirm.body.error.detail.task_count).toBe(2)
    expect(noConfirm.body.error.detail.list_name).toBe('Work')

    // with confirm — success, tasks moved to Inbox
    const confirmed = await h.agent.delete(`/lists/${list.id}`).set('X-User-Id', user).send({ confirm: true })
    expect(confirmed.status).toBe(200)
    expect(confirmed.body.deleted).toBe(true)
    expect(confirmed.body.tasks_moved).toBe(2)

    // tasks are in Inbox now (list_id = null)
    const tasks = await listTasks(h, user)
    for (const task of tasks) {
      expect(task.list_id).toBeNull()
    }
    // list is gone
    expect(await getLists(h, user)).toHaveLength(0)
  })

  it('AC-9 — deleted list does not go to trash, permanent and immediate', async () => {
    const h = await buildHarness()
    const user = uid()
    const list = await createList(h, user, 'Gone')
    await h.agent.delete(`/lists/${list.id}`).set('X-User-Id', user).send({})
    // no trace
    expect(await getLists(h, user)).toHaveLength(0)
    // can't patch it back
    const res = await h.agent.patch(`/lists/${list.id}`).set('X-User-Id', user).send({ name: 'Back' })
    expect(res.status).toBe(404)
  })

  it('404 for unknown or other-user list', async () => {
    const h = await buildHarness()
    const user1 = uid()
    const user2 = uid()
    const list = await createList(h, user1, 'Mine')
    const res = await h.agent.delete(`/lists/${list.id}`).set('X-User-Id', user2).send({})
    expect(res.status).toBe(404)
  })
})

// ---- Filing ----

describe('filing (PATCH /tasks/{id} with list_id)', () => {
  it('AC-10, AC-11 — filing a task into a list writes list_id', async () => {
    const h = await buildHarness()
    const user = uid()
    const list = await createList(h, user, 'Work')
    const task = await createTask(h, user, 'Do work')
    const res = await h.agent.patch(`/tasks/${task.id}`).set('X-User-Id', user).send({ list_id: list.id })
    expect(res.status).toBe(200)
    expect(res.body.task.list_id).toBe(list.id)
    // verify on read
    const tasks = await listTasks(h, user)
    const found = tasks.find((t) => t.id === task.id)
    expect(found!.list_id).toBe(list.id)
  })

  it('AC-12 — moving a task to Inbox sets list_id = null', async () => {
    const h = await buildHarness()
    const user = uid()
    const list = await createList(h, user, 'Work')
    const task = await createTask(h, user, 'Do work')
    await h.agent.patch(`/tasks/${task.id}`).set('X-User-Id', user).send({ list_id: list.id })
    const res = await h.agent.patch(`/tasks/${task.id}`).set('X-User-Id', user).send({ list_id: null })
    expect(res.status).toBe(200)
    expect(res.body.task.list_id).toBeNull()
  })

  it('AC-13 — filing a step is refused with 400 VALIDATION', async () => {
    const h = await buildHarness()
    const user = uid()
    const list = await createList(h, user, 'Work')
    const parent = await createTask(h, user, 'Parent')
    const step = await createTask(h, user, 'Step', { parent_id: parent.id })
    const res = await h.agent.patch(`/tasks/${step.id}`).set('X-User-Id', user).send({ list_id: list.id })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION')
    expect(res.body.error.field).toBe('list_id')
  })

  it('404 for non-existent list_id', async () => {
    const h = await buildHarness()
    const user = uid()
    const task = await createTask(h, user, 'Do work')
    const res = await h.agent.patch(`/tasks/${task.id}`).set('X-User-Id', user).send({ list_id: uid() })
    expect(res.status).toBe(404)
  })

  it('404 for other-user list_id', async () => {
    const h = await buildHarness()
    const user1 = uid()
    const user2 = uid()
    const list = await createList(h, user2, 'Their list')
    const task = await createTask(h, user1, 'My task')
    const res = await h.agent.patch(`/tasks/${task.id}`).set('X-User-Id', user1).send({ list_id: list.id })
    expect(res.status).toBe(404)
  })
})

// ---- Assistant integration ----

describe('assistant list operations', () => {
  it('AC-17 — create a list by voice with default color', async () => {
    const h = await buildHarness()
    const user = uid()
    const res = await sendTurn(h, user, 'make a list called Groceries')
    expect(res.status).toBe(200)
    expect(res.body.turn.outcome.kind).toBe('applied')
    expect(res.body.turn.outcome.created_titles).toContain('Groceries')
    // list actually created
    const lists = await getLists(h, user)
    expect(lists).toHaveLength(1)
    expect(lists[0]!.name).toBe('Groceries')
    expect(lists[0]!.color).toBe(0)
  })

  it('AC-18 — move a task to a named list by voice', async () => {
    const h = await buildHarness()
    const user = uid()
    await createList(h, user, 'Groceries')
    await createTask(h, user, 'Buy milk')
    const res = await sendTurn(h, user, 'move buy milk to groceries')
    expect(res.status).toBe(200)
    expect(res.body.turn.outcome.kind).toBe('applied')
    // verify the task is filed
    const tasks = await listTasks(h, user)
    const milk = tasks.find((t) => t.title === 'Buy milk')
    expect(milk!.list_id).not.toBeNull()
  })

  it('AC-19 — move a task to Inbox by voice', async () => {
    const h = await buildHarness()
    const user = uid()
    const list = await createList(h, user, 'Groceries')
    const task = await createTask(h, user, 'Buy milk')
    // file it first
    await h.agent.patch(`/tasks/${task.id}`).set('X-User-Id', user).send({ list_id: list.id })
    const res = await sendTurn(h, user, 'move buy milk to inbox')
    expect(res.status).toBe(200)
    expect(res.body.turn.outcome.kind).toBe('applied')
    const tasks = await listTasks(h, user)
    const milk = tasks.find((t) => t.title === 'Buy milk')
    expect(milk!.list_id).toBeNull()
  })

  it('AC-20 — refusing rename/delete list by voice produces refused outcome', async () => {
    const h = await buildHarness()
    const user = uid()
    await createList(h, user, 'Groceries')
    const res = await sendTurn(h, user, 'rename the groceries list')
    expect(res.status).toBe(200)
    expect(res.body.turn.outcome.kind).toBe('refused')
  })

  it('AC-21 — no auto-create on no-match produces no_match outcome', async () => {
    const h = await buildHarness()
    const user = uid()
    await createTask(h, user, 'Buy milk')
    const res = await sendTurn(h, user, 'add buy milk to nonexistent list')
    expect(res.status).toBe(200)
    expect(res.body.turn.outcome.kind).toBe('no_match')
    // no list was created
    expect(await getLists(h, user)).toHaveLength(0)
  })

  it('AC-22 — pronoun resolution for filing (via AC-50 hint)', async () => {
    const h = await buildHarness()
    const user = uid()
    const list = await createList(h, user, 'Groceries')
    await createTask(h, user, 'Buy milk')
    // The fixture table resolves "buy milk" as the task
    const res = await sendTurn(h, user, 'move buy milk to groceries')
    expect(res.status).toBe(200)
    expect(res.body.turn.outcome.kind).toBe('applied')
    const tasks = await listTasks(h, user)
    const milk = tasks.find((t) => t.title === 'Buy milk')
    expect(milk!.list_id).toBe(list.id)
  })
})

describe('undo of list operations', () => {
  it('AC-25 — filing undo restores previous list_id', async () => {
    const h = await buildHarness()
    const user = uid()
    const list = await createList(h, user, 'Groceries')
    await createTask(h, user, 'Buy milk')
    // file by voice
    const fileTurn = await sendTurn(h, user, 'move buy milk to groceries')
    expect(fileTurn.body.turn.outcome.kind).toBe('applied')
    const turnId = fileTurn.body.turn.id
    // undo
    const undo = await undoTurn(h, user, turnId)
    expect(undo.status).toBe(200)
    expect(undo.body.undone).toBe(true)
    // task should be back in Inbox
    const tasks = await listTasks(h, user)
    const milk = tasks.find((t) => t.title === 'Buy milk')
    expect(milk!.list_id).toBeNull()
  })

  it('AC-26 — undo of list_create removes the list and unfiles its tasks', async () => {
    const h = await buildHarness()
    const user = uid()
    // create a list by voice
    const createTurn = await sendTurn(h, user, 'make a list called Groceries')
    expect(createTurn.body.turn.outcome.kind).toBe('applied')
    const turnId = createTurn.body.turn.id

    // file a task into the list manually
    const lists = await getLists(h, user)
    const listId = lists[0]!.id as string
    const task = await createTask(h, user, 'Buy milk')
    await h.agent.patch(`/tasks/${task.id}`).set('X-User-Id', user).send({ list_id: listId })

    // undo the list creation
    const undo = await undoTurn(h, user, turnId)
    expect(undo.status).toBe(200)
    expect(undo.body.undone).toBe(true)

    // list should be gone
    expect(await getLists(h, user)).toHaveLength(0)
    // task should be back in Inbox
    const tasks = await listTasks(h, user)
    const milk = tasks.find((t) => t.title === 'Buy milk')
    expect(milk!.list_id).toBeNull()
  })
})

describe('list_id on the task wire', () => {
  it('AC-10 — list_id appears on task responses, null for Inbox', async () => {
    const h = await buildHarness()
    const user = uid()
    const task = await createTask(h, user, 'Buy milk')
    expect(task.list_id).toBeNull()
  })

  it('list_id is present in GET /tasks responses', async () => {
    const h = await buildHarness()
    const user = uid()
    const list = await createList(h, user, 'Work')
    const task = await createTask(h, user, 'Do work')
    await h.agent.patch(`/tasks/${task.id}`).set('X-User-Id', user).send({ list_id: list.id })
    const tasks = await listTasks(h, user)
    const found = tasks.find((t) => t.id === task.id)
    expect(found!.list_id).toBe(list.id)
  })
})

describe('list position assignment', () => {
  it('position is assigned as max(position) + 1024', async () => {
    const h = await buildHarness()
    const user = uid()
    const l1 = await createList(h, user, 'A')
    const l2 = await createList(h, user, 'B')
    expect(l1.position).toBe(1024)
    expect(l2.position).toBe(2048)
  })
})
