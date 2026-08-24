// F-007 - the whole path, through the real HTTP endpoint.
//
// Everything before this file tested a part. This drives POST /assistant/turn
// with a model-backed interpreter installed and asserts the three things that
// only work if the parts are actually connected: the task changes, the ledger
// records what it cost, and the two sentences come back on the turn.
//
// The model is scripted. Everything else - the app, the queue, the turn engine,
// the store, the tools, the bridge, the checks and the ledger - is real.

import { createServer, globalAgent, type Server } from 'node:http'
import { randomUUID } from 'node:crypto'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent.js'
import { describe, expect, it, onTestFinished } from 'vitest'
import { createApp } from '../app.ts'
import { createModelInterpreter } from '../ai/interpreter.ts'
import { registerProvider } from '../ai/provider.ts'
import '../ai/providers/index.ts'
import { FakeClock } from '../ports/clock.ts'
import { MemoryStore } from '../store/memory-store.ts'
import type { PriceTable } from '../ai/usage.ts'

;(globalAgent as unknown as { keepAlive: boolean }).keepAlive = false

/** Priced per generated provider name, so the ledger has a real rate to use. */
const priceFor = (provider: string): PriceTable => ({
  [`${provider}/model-v1`]: { input: 5, output: 25, cached_input: 0.5 },
})

let seq = 0

/** An app whose interpreter is a scripted model, wired exactly as server.ts wires it. */
async function wired(steps: unknown[]) {
  const name = `wired-${seq++}`
  let i = 0
  registerProvider(name, () => ({ next: async () => steps[Math.min(i++, steps.length - 1)] as never }),
    { cache: 'none', toolCalling: true })

  const store = new MemoryStore()
  const clock = new FakeClock()
  let sink: Parameters<NonNullable<Parameters<typeof createApp>[0]['onAiTurn']>>[0] | null = null
  const interpreter = createModelInterpreter({
    config: { provider: name, model: 'model-v1', apiKey: '' },
    store, clock,
    onTurn: (userId, t) => sink?.(userId, t),
  })
  const app = createApp({
    store, interpreter, clock, idleCloseMs: 180_000, prices: priceFor(name),
    onAiTurn: (s) => { sink = s },
  })
  const server: Server = createServer(app)
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })
  onTestFinished(() => new Promise<void>((resolve) => {
    server.closeAllConnections()
    server.close(() => resolve())
  }))
  const agent = (request.agent(server) as unknown as InstanceType<typeof TestAgent>)
    .set('X-Timezone', 'UTC') as unknown as InstanceType<typeof TestAgent>
  return { agent, store, clock, provider: name }
}

const REPLY = { message: 'Added "Buy milk".', speech: 'Added Buy milk.' }

const sendTurn = (agent: InstanceType<typeof TestAgent>, user: string, transcript: string) =>
  agent.post('/assistant/turn').set('X-User-Id', user).send({
    client_turn_id: randomUUID(), transcript, source: 'voice',
  })

describe('F-007 the model actually drives a turn', () => {
  it('creates the task the model asked for, and says so in both channels', async () => {
    const { agent } = await wired([
      { kind: 'final',
        payload: { kind: 'create', tasks: [{ title: 'Buy milk' }] },
        reply: REPLY,
        usage: { input_tokens: 1500, cached_input_tokens: 1100, output_tokens: 90 } },
    ])
    const user = `u${seq}@x.com`

    const res = await sendTurn(agent, user, 'add a task to buy milk')
    expect(res.status).toBe(200)
    expect(res.body.turn.outcome.kind).toBe('applied')
    // The two sentences ride back on the turn - no second request.
    expect(res.body.turn.reply).toEqual(REPLY)

    const tasks = await agent.get('/tasks').set('X-User-Id', user)
    expect(tasks.body.tasks.map((t: { title: string }) => t.title)).toContain('Buy milk')
  })

  it('records what the turn cost, per user, in the ledger', async () => {
    const { agent, provider } = await wired([
      { kind: 'final',
        payload: { kind: 'create', tasks: [{ title: 'Buy milk' }] },
        reply: REPLY,
        usage: { input_tokens: 1500, cached_input_tokens: 1100, output_tokens: 90 } },
    ])
    const user = `u${seq}@x.com`
    await sendTurn(agent, user, 'add a task to buy milk')

    const usage = await agent.get('/usage?bucket=total&by=model').set('X-User-Id', user)
    expect(usage.status).toBe(200)
    expect(usage.body.groups).toHaveLength(1)
    const g = usage.body.groups[0]
    expect(g).toMatchObject({
      key: `${provider}/model-v1`, calls: 1, rounds: 1,
      input_tokens: 1500, cached_input_tokens: 1100, output_tokens: 90,
    })
    //   fresh   400 x $5/M   = $0.0020
    //   cached 1100 x $0.5/M = $0.00055
    //   output   90 x $25/M  = $0.00225
    expect(g.cost_usd).toBeCloseTo(0.0048, 6)
    expect(g.unpriced_calls).toBe(0)
  })

  it('a session read replays the sentences, so history is not lost', async () => {
    const { agent } = await wired([
      { kind: 'final', payload: { kind: 'create', tasks: [{ title: 'Buy milk' }] }, reply: REPLY },
    ])
    const user = `u${seq}@x.com`
    await sendTurn(agent, user, 'add a task to buy milk')

    const session = await agent.get('/assistant/session').set('X-User-Id', user)
    const turns = session.body.session.messages as { reply: unknown }[]
    expect(turns.at(-1)!.reply).toEqual(REPLY)
  })

  it('lets the model look things up before deciding', async () => {
    const { agent } = await wired([
      { kind: 'tool_use', calls: [{ name: 'now', input: {} }] },
      { kind: 'final', payload: { kind: 'create', tasks: [{ title: 'Take the bins out' }] }, reply: {
        message: 'Added "Take the bins out".', speech: 'Added Take the bins out.' } },
    ])
    const user = `u${seq}@x.com`
    await sendTurn(agent, user, 'remind me to take the bins out tonight')

    const usage = await agent.get('/usage?bucket=total').set('X-User-Id', user)
    expect(usage.body.groups[0]).toMatchObject({ rounds: 2, tool_calls: 1 })
  })

  it('changes nothing when the model returns an action the engine does not know', async () => {
    const { agent } = await wired([
      { kind: 'final', payload: { kind: 'wipe_the_account' }, reply: REPLY,
        usage: { input_tokens: 800, cached_input_tokens: 0, output_tokens: 30 } },
    ])
    const user = `u${seq}@x.com`
    const res = await sendTurn(agent, user, 'delete everything')

    expect(res.status).toBe(200)
    expect(res.body.turn.outcome.kind).toBe('no_match')
    // The sentence described something that did not happen, so it is withheld.
    expect(res.body.turn.reply).toBeNull()

    const tasks = await agent.get('/tasks').set('X-User-Id', user)
    expect(tasks.body.tasks).toHaveLength(0)

    // A refused turn was still paid for, and the ledger says so.
    const usage = await agent.get('/usage?bucket=total').set('X-User-Id', user)
    expect(usage.body.groups[0]).toMatchObject({ calls: 1, input_tokens: 800 })
  })

  it('withholds a sentence that names a task it is not touching', async () => {
    const { agent } = await wired([
      { kind: 'final', payload: { kind: 'create', tasks: [{ title: 'Buy milk' }] },
        reply: { message: 'Deleted "Call mom".', speech: 'Done.' } },
    ])
    const user = `u${seq}@x.com`
    const res = await sendTurn(agent, user, 'add a task to buy milk')
    expect(res.body.turn.outcome.kind).toBe('no_match')
    expect(res.body.turn.reply).toBeNull()
  })

  it('stays up when the provider is down, and bills nothing for it', async () => {
    const name = `dead-${seq++}`
    registerProvider(name, () => ({ next: async () => { throw new Error('503 upstream') } }),
      { cache: 'none', toolCalling: true })
    const store = new MemoryStore()
    const clock = new FakeClock()
    let sink: Parameters<NonNullable<Parameters<typeof createApp>[0]['onAiTurn']>>[0] | null = null
    const app = createApp({
      store, clock, idleCloseMs: 180_000, prices: priceFor(name),
      interpreter: createModelInterpreter({
        config: { provider: name, model: 'model-v1', apiKey: '' },
        store, clock, onTurn: (u, t) => sink?.(u, t),
      }),
      onAiTurn: (s) => { sink = s },
    })
    const server = createServer(app)
    await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', () => resolve()) })
    onTestFinished(() => new Promise<void>((resolve) => {
      server.closeAllConnections(); server.close(() => resolve())
    }))
    const agent = (request.agent(server) as unknown as InstanceType<typeof TestAgent>)
      .set('X-Timezone', 'UTC') as unknown as InstanceType<typeof TestAgent>
    const user = `u${seq}@x.com`

    const res = await sendTurn(agent, user, 'add something')
    // Not a 500: the user gets a turn that says it did not understand.
    expect(res.status).toBe(200)
    expect(res.body.turn.outcome.kind).toBe('no_match')

    const usage = await agent.get('/usage?bucket=total').set('X-User-Id', user)
    expect(usage.body.groups[0]).toMatchObject({ calls: 1, input_tokens: 0, output_tokens: 0 })
    expect(usage.body.groups[0].cost_usd).toBe(0)
  })

  it('keeps one account\'s turns off another account\'s ledger', async () => {
    const { agent } = await wired([
      { kind: 'final', payload: { kind: 'create', tasks: [{ title: 'Buy milk' }] }, reply: REPLY,
        usage: { input_tokens: 100, cached_input_tokens: 0, output_tokens: 10 } },
    ])
    const a = `a${seq}@x.com`
    const b = `b${seq}@x.com`
    await sendTurn(agent, a, 'add a task')
    await sendTurn(agent, a, 'add another task')
    await sendTurn(agent, b, 'add a task')

    const forA = await agent.get('/usage?bucket=total').set('X-User-Id', a)
    const forB = await agent.get('/usage?bucket=total').set('X-User-Id', b)
    expect(forA.body.groups[0].calls).toBe(2)
    expect(forB.body.groups[0].calls).toBe(1)
  })
})
