// F-007 — the provider layer. Nothing here is about one vendor: the same
// expectations are asserted against both adapters, because a port that only
// one implementation satisfies is not a port.
//
// No network. Scripted response bodies drive the real conversion code.

import { beforeEach, describe, expect, it } from 'vitest'
import {
  capabilitiesOf,
  createModelClient,
  knownProviders,
  providerConfigFromEnv,
  registerProvider,
  type ClientRequest,
} from '../ai/provider.ts'
import '../ai/providers/index.ts'
import { RESPOND_TOOL } from '../ai/reply.ts'
import { TOOL_NAMES, TOOL_SCHEMAS } from '../ai/tools.ts'

interface Sent { url: string; headers: Record<string, string>; body: Record<string, unknown> }

/** Build a client of the named provider over a scripted transport. */
function harness(provider: string, bodies: unknown[], apiKey = 'test-key') {
  const sent: Sent[] = []
  let i = 0
  const fetchImpl = (async (url: unknown, init: unknown) => {
    const opts = init as { body: string; headers: Record<string, string> }
    sent.push({ url: String(url), headers: opts.headers, body: JSON.parse(opts.body) as Record<string, unknown> })
    const body = bodies[Math.min(i++, bodies.length - 1)]
    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) }
  }) as unknown as typeof fetch
  const req: ClientRequest = {
    config: { provider, model: 'some-model-v1', apiKey, baseUrl: 'https://example.invalid' },
    system: 'you are a todo assistant',
    firstUserMessage: 'xoá việc mua sữa',
    tools: TOOL_SCHEMAS,
    respondTool: RESPOND_TOOL,
    fetchImpl,
  }
  return { client: createModelClient(req), sent }
}

/** The same conversation, told in each provider's own wire shape. */
const SCRIPTS = {
  anthropic: {
    toolRound: { content: [{ type: 'tool_use', id: 'call_1', name: 'search_tasks', input: { query: 'sữa' } }] },
    finalRound: {
      content: [{
        type: 'tool_use', id: 'call_2', name: RESPOND_TOOL.name,
        input: { action: { kind: 'delete', handles: ['t1'] }, message: 'Xoá "Mua sữa" nhé?', speech: 'Xoá Mua sữa nhé?' },
      }],
    },
    proseOnly: { content: [{ type: 'text', text: 'Bạn muốn xoá việc nào?' }] },
    toolsOf: (b: Record<string, unknown>) => (b.tools as { name: string }[]).map((t) => t.name),
  },
  openai: {
    toolRound: {
      choices: [{ message: { role: 'assistant', content: null, tool_calls: [
        { id: 'call_1', type: 'function', function: { name: 'search_tasks', arguments: '{"query":"sữa"}' } },
      ] } }],
    },
    finalRound: {
      choices: [{ message: { role: 'assistant', content: null, tool_calls: [
        { id: 'call_2', type: 'function', function: {
          name: RESPOND_TOOL.name,
          arguments: JSON.stringify({ action: { kind: 'delete', handles: ['t1'] }, message: 'Xoá "Mua sữa" nhé?', speech: 'Xoá Mua sữa nhé?' }),
        } },
      ] } }],
    },
    proseOnly: { choices: [{ message: { role: 'assistant', content: 'Bạn muốn xoá việc nào?' } }] },
    toolsOf: (b: Record<string, unknown>) =>
      (b.tools as { function: { name: string } }[]).map((t) => t.function.name),
  },
} as const

for (const provider of ['anthropic', 'openai'] as const) {
  const S = SCRIPTS[provider]

  describe(`F-007 ${provider} — the same port, the same behaviour`, () => {
    it('offers every read tool plus the one that ends the turn', async () => {
      const { client, sent } = harness(provider, [S.proseOnly])
      await client.next([])
      const names = S.toolsOf(sent[0]!.body)
      for (const n of TOOL_NAMES) expect(names).toContain(n)
      expect(names).toContain(RESPOND_TOOL.name)
    })

    it('sends the configured model, never a compiled-in one', async () => {
      const { client, sent } = harness(provider, [S.proseOnly])
      await client.next([])
      expect(sent[0]!.body.model).toBe('some-model-v1')
      expect(JSON.stringify(sent[0]!.body)).not.toContain('claude-opus')
    })

    it('honours the configured base url', async () => {
      const { client, sent } = harness(provider, [S.proseOnly])
      await client.next([])
      expect(sent[0]!.url.startsWith('https://example.invalid/')).toBe(true)
    })

    it('keeps the key out of the request body', async () => {
      const { client, sent } = harness(provider, [S.proseOnly])
      await client.next([])
      expect(JSON.stringify(sent[0]!.body)).not.toContain('test-key')
    })

    it('asks for tools when the model asks for tools', async () => {
      const { client } = harness(provider, [S.toolRound])
      const step = await client.next([])
      expect(step.kind).toBe('tool_use')
      if (step.kind === 'tool_use') {
        expect(step.calls[0]!.name).toBe('search_tasks')
        expect(step.calls[0]!.input).toEqual({ query: 'sữa' })
      }
    })

    it('carries a tool result back under the id the server assigned', async () => {
      const { client, sent } = harness(provider, [S.toolRound, S.finalRound])
      await client.next([])
      await client.next([{ call: { name: 'search_tasks', input: {} }, result: { count: 0 }, is_error: false }])
      expect(JSON.stringify(sent[1]!.body.messages)).toContain('call_1')
    })

    it('reads the final call as the action plus both sentences', async () => {
      const { client } = harness(provider, [S.finalRound])
      const step = await client.next([])
      expect(step.kind).toBe('final')
      if (step.kind === 'final') {
        expect(step.payload).toEqual({ kind: 'delete', handles: ['t1'] })
        expect(step.reply.message).toContain('Mua sữa')
        expect(step.reply.speech).not.toContain('"')
      }
    })

    it('does not parse prose into an action when the model calls nothing', async () => {
      const { client } = harness(provider, [S.proseOnly])
      const step = await client.next([])
      expect(step.kind).toBe('final')
      if (step.kind === 'final') expect(step.payload).toEqual({ kind: 'unclassifiable' })
    })

    it('surfaces a transport error rather than inventing an outcome', async () => {
      const fetchImpl = (async () => ({
        ok: false, status: 529, json: async () => ({}), text: async () => '{"error":"overloaded"}',
      })) as unknown as typeof fetch
      const client = createModelClient({
        config: { provider, model: 'm', apiKey: 'k' },
        system: 's', firstUserMessage: 'u', tools: TOOL_SCHEMAS, respondTool: RESPOND_TOOL, fetchImpl,
      })
      await expect(client.next([])).rejects.toThrow(/529/)
    })
  })
}

describe('F-007 caching is handled per provider, not assumed', () => {
  it('anthropic marks where the stable prefix ends, or nothing caches at all', async () => {
    const { client, sent } = harness('anthropic', [SCRIPTS.anthropic.proseOnly])
    await client.next([])
    const system = sent[0]!.body.system as { type: string; cache_control?: unknown }[]
    // Block-array form, not a bare string: a string carries no marker.
    expect(Array.isArray(system)).toBe(true)
    expect(system[0]!.cache_control).toEqual({ type: 'ephemeral' })
    // The breakpoint sits at the END of system, so it covers tools + system —
    // the request renders tools, then system, then messages.
    expect(sent[0]!.body.tools).toBeDefined()
  })

  it('an openai-compatible request carries no cache parameter, because there is none', async () => {
    const { client, sent } = harness('openai', [SCRIPTS.openai.proseOnly])
    await client.next([])
    expect(JSON.stringify(sent[0]!.body)).not.toContain('cache_control')
  })

  it('every registered provider declares what it does about caching', () => {
    for (const name of knownProviders()) {
      const cap = capabilitiesOf(name)
      expect(['explicit-breakpoints', 'automatic', 'none'], name).toContain(cap.cache)
      // The loop cannot run without tool calling, so a provider that lacks it
      // must say so rather than be discovered at runtime.
      expect(cap.toolCalling, name).toBe(true)
    }
  })

  it('names what is registered when asked about a provider that is not', () => {
    expect(() => capabilitiesOf('nope')).toThrow(/unknown AI provider 'nope'/)
  })
})

describe('F-007 an OpenAI-compatible server needs no code', () => {
  it('is reachable by name, and points wherever configuration says', async () => {
    expect(knownProviders()).toContain('openai-compatible')
    const sent: string[] = []
    const fetchImpl = (async (url: unknown) => {
      sent.push(String(url))
      return { ok: true, status: 200, json: async () => SCRIPTS.openai.proseOnly, text: async () => '' }
    }) as unknown as typeof fetch
    const client = createModelClient({
      config: { provider: 'openai-compatible', model: 'qwen2.5:14b', apiKey: '', baseUrl: 'http://localhost:11434' },
      system: 's', firstUserMessage: 'u', tools: TOOL_SCHEMAS, respondTool: RESPOND_TOOL, fetchImpl,
    })
    await client.next([])
    expect(sent[0]).toBe('http://localhost:11434/v1/chat/completions')
  })

  it('omits the authorization header entirely when there is no key', async () => {
    let headers: Record<string, string> = {}
    const fetchImpl = (async (_u: unknown, init: unknown) => {
      headers = (init as { headers: Record<string, string> }).headers
      return { ok: true, status: 200, json: async () => SCRIPTS.openai.proseOnly, text: async () => '' }
    }) as unknown as typeof fetch
    const client = createModelClient({
      config: { provider: 'openai-compatible', model: 'm', apiKey: '', baseUrl: 'http://localhost:11434' },
      system: 's', firstUserMessage: 'u', tools: TOOL_SCHEMAS, respondTool: RESPOND_TOOL, fetchImpl,
    })
    await client.next([])
    expect(Object.keys(headers).map((k) => k.toLowerCase())).not.toContain('authorization')
  })

  it('survives a model that emits malformed tool arguments', async () => {
    const body = {
      choices: [{ message: { role: 'assistant', content: null, tool_calls: [
        { id: 'c1', type: 'function', function: { name: 'search_tasks', arguments: '{not json' } },
      ] } }],
    }
    const { client } = harness('openai', [body])
    const step = await client.next([])
    expect(step.kind).toBe('tool_use')
    if (step.kind === 'tool_use') expect(step.calls[0]!.input).toEqual({})
  })
})

describe('F-007 configuration, with no compiled-in default', () => {
  it('refuses to guess a provider or a model', () => {
    expect(() => providerConfigFromEnv({})).toThrow(/AI_PROVIDER and AI_MODEL/)
    expect(() => providerConfigFromEnv({ AI_PROVIDER: 'anthropic' })).toThrow(/AI_MODEL/)
    expect(() => providerConfigFromEnv({ AI_MODEL: 'x' })).toThrow(/AI_PROVIDER/)
  })

  it('reads provider, model, base url and max tokens', () => {
    const cfg = providerConfigFromEnv({
      AI_PROVIDER: 'openai-compatible', AI_MODEL: 'llama3.3:70b',
      AI_BASE_URL: 'http://localhost:11434', AI_API_KEY: 'k', AI_MAX_TOKENS: '2048',
    })
    expect(cfg).toEqual({
      provider: 'openai-compatible', model: 'llama3.3:70b',
      baseUrl: 'http://localhost:11434', apiKey: 'k', maxTokens: 2048,
    })
  })

  it('falls back to the vendor\'s conventional key name, so nothing has to be renamed', () => {
    const a = providerConfigFromEnv({ AI_PROVIDER: 'anthropic', AI_MODEL: 'm', ANTHROPIC_API_KEY: 'from-vendor-var' })
    expect(a.apiKey).toBe('from-vendor-var')
    const o = providerConfigFromEnv({ AI_PROVIDER: 'openai', AI_MODEL: 'm', OPENAI_API_KEY: 'oai' })
    expect(o.apiKey).toBe('oai')
  })

  it('rejects a nonsense token budget instead of sending it', () => {
    expect(() => providerConfigFromEnv({ AI_PROVIDER: 'openai', AI_MODEL: 'm', AI_MAX_TOKENS: 'lots' })).toThrow(/positive integer/)
  })

  it('names what is registered when asked for something that is not', () => {
    expect(() =>
      createModelClient({
        config: { provider: 'hal9000', model: 'm', apiKey: 'k' },
        system: 's', firstUserMessage: 'u', tools: TOOL_SCHEMAS, respondTool: RESPOND_TOOL,
      }),
    ).toThrow(/unknown AI provider 'hal9000'.*anthropic/)
  })

  it('takes a provider nobody shipped', async () => {
    registerProvider(
      'my-gateway',
      () => ({
        next: async () => ({ kind: 'final', payload: { kind: 'query' }, reply: { message: 'm', speech: 's' } }),
      }),
      { cache: 'none', toolCalling: true },
    )
    const client = createModelClient({
      config: { provider: 'my-gateway', model: 'whatever', apiKey: '' },
      system: 's', firstUserMessage: 'u', tools: TOOL_SCHEMAS, respondTool: RESPOND_TOOL,
    })
    expect((await client.next([])).kind).toBe('final')
  })
})
