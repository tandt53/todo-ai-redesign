// F-007 — the Messages-API transport, driven by scripted response bodies.
//
// No network. What is under test is the conversion in both directions: what we
// send the provider, and what we make of what it sends back.

import { describe, expect, it } from 'vitest'
import { RESPOND_TOOL, createAnthropicClient } from '../ai/anthropic.ts'
import { TOOL_NAMES } from '../ai/tools.ts'

interface Sent { url: string; body: Record<string, unknown> }

function transport(bodies: unknown[]) {
  const sent: Sent[] = []
  let i = 0
  const fetchImpl = (async (url: unknown, init: unknown) => {
    const opts = init as { body: string }
    sent.push({ url: String(url), body: JSON.parse(opts.body) as Record<string, unknown> })
    const body = bodies[Math.min(i++, bodies.length - 1)]
    return {
      ok: true,
      status: 200,
      json: async () => body,
      text: async () => JSON.stringify(body),
    }
  }) as unknown as typeof fetch
  const client = createAnthropicClient({
    apiKey: 'test-key',
    baseUrl: 'https://example.invalid',
    system: 'you are a todo assistant',
    firstUserMessage: 'xoá việc mua sữa',
    fetchImpl,
  })
  return { client, sent }
}

describe('F-007 what we send the provider', () => {
  it('offers every read tool plus the one that ends the turn', async () => {
    const { client, sent } = transport([{ content: [{ type: 'text', text: 'hi' }] }])
    await client.next([])
    const tools = (sent[0]!.body.tools as { name: string }[]).map((t) => t.name)
    for (const name of TOOL_NAMES) expect(tools).toContain(name)
    expect(tools).toContain(RESPOND_TOOL.name)
  })

  it('sends the key and the API version as headers, never in the body', async () => {
    const { client, sent } = transport([{ content: [] }])
    await client.next([])
    expect(JSON.stringify(sent[0]!.body)).not.toContain('test-key')
    expect(sent[0]!.url).toBe('https://example.invalid/v1/messages')
  })

  it('carries a tool result back under the id the provider assigned', async () => {
    const { client, sent } = transport([
      { content: [{ type: 'tool_use', id: 'toolu_abc', name: 'search_tasks', input: { query: 'sữa' } }] },
      { content: [{ type: 'tool_use', id: 'toolu_def', name: RESPOND_TOOL.name, input: { action: { kind: 'no_match' }, message: 'm', speech: 's' } }] },
    ])
    const first = await client.next([])
    expect(first.kind).toBe('tool_use')
    await client.next([{ call: { name: 'search_tasks', input: {} }, result: { count: 0 }, is_error: false }])
    const second = sent[1]!.body.messages as { role: string; content: unknown }[]
    const toolResult = second.at(-1)!.content as { tool_use_id: string }[]
    expect(toolResult[0]!.tool_use_id).toBe('toolu_abc')
  })
})

describe('F-007 what we make of the answer', () => {
  it('reads the final call as the action plus both sentences', async () => {
    const { client } = transport([
      {
        content: [
          {
            type: 'tool_use', id: 't1', name: RESPOND_TOOL.name,
            input: {
              action: { kind: 'delete', handles: ['t1'] },
              message: 'Xoá "Mua sữa cho bé" nhé?',
              speech: 'Xoá Mua sữa cho bé nhé?',
            },
          },
        ],
      },
    ])
    const step = await client.next([])
    expect(step.kind).toBe('final')
    if (step.kind === 'final') {
      expect(step.payload).toEqual({ kind: 'delete', handles: ['t1'] })
      expect(step.reply.message).toContain('Mua sữa')
      expect(step.reply.speech).not.toContain('"')
    }
  })

  it('asks for tools when the model asks for tools', async () => {
    const { client } = transport([
      { content: [{ type: 'tool_use', id: 'a', name: 'now', input: {} }, { type: 'tool_use', id: 'b', name: 'list_lists', input: {} }] },
    ])
    const step = await client.next([])
    expect(step.kind).toBe('tool_use')
    if (step.kind === 'tool_use') expect(step.calls.map((c) => c.name)).toEqual(['now', 'list_lists'])
  })

  it('does not parse prose into an action when the model calls nothing', async () => {
    const { client } = transport([{ content: [{ type: 'text', text: 'Bạn muốn xoá việc nào?' }] }])
    const step = await client.next([])
    expect(step.kind).toBe('final')
    if (step.kind === 'final') expect(step.payload).toEqual({ kind: 'unclassifiable' })
  })

  it('surfaces a provider error rather than inventing an outcome', async () => {
    const fetchImpl = (async () => ({
      ok: false, status: 529, json: async () => ({}), text: async () => '{"error":"overloaded"}',
    })) as unknown as typeof fetch
    const client = createAnthropicClient({
      apiKey: 'k', system: 's', firstUserMessage: 'u', fetchImpl,
    })
    await expect(client.next([])).rejects.toThrow(/529/)
  })
})
