// The OpenAI Chat Completions shape, with tool calling.
//
// One adapter, many servers: OpenAI itself, and every project that copied the
// endpoint — Ollama, vLLM, LM Studio, OpenRouter, Together, Groq, llama.cpp.
// They differ in host and model id, both of which are configuration, so they
// need no code here. That is the point of pointing `AI_BASE_URL` at them.
//
// Two shape differences from Anthropic worth naming, because they are where a
// port like this usually breaks: the tool schema is `parameters`, not
// `input_schema`; and arguments arrive as a JSON **string**, not an object, so
// a model that emits malformed JSON must be reported rather than crash the turn.

import type { ClientRequest, ProviderFactory } from '../provider.ts'
import type { ModelClient } from '../loop.ts'
import type { ToolCall } from '../tools.ts'
import type { ReplyText } from '../reply.ts'

const DEFAULT_BASE = 'https://api.openai.com'

interface WireToolCall {
  id?: string
  type?: string
  function?: { name?: string; arguments?: string }
}

interface WireMessage {
  role?: string
  content?: string | null
  tool_calls?: WireToolCall[]
}

function parseArgs(raw: string | undefined): Record<string, unknown> {
  if (raw === undefined || raw.trim() === '') return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

export const openAiCompatibleProvider: ProviderFactory = (req: ClientRequest): ModelClient => {
  const doFetch = req.fetchImpl ?? fetch
  const base = (req.config.baseUrl ?? DEFAULT_BASE).replace(/\/+$/, '')
  const tools = [...req.tools, req.respondTool].map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.schema },
  }))
  const messages: Record<string, unknown>[] = [
    { role: 'system', content: req.system },
    { role: 'user', content: req.firstUserMessage },
  ]
  let pendingIds: string[] = []

  return {
    async next(results) {
      if (results.length > 0) {
        // One `tool` message per call, each keyed to the id the server gave —
        // unlike Anthropic, where the whole round is a single user message.
        for (const [i, r] of results.entries()) {
          messages.push({
            role: 'tool',
            tool_call_id: pendingIds[i] ?? `unknown_${i}`,
            content: JSON.stringify(r.is_error ? { error: r.result } : r.result),
          })
        }
      }

      const headers: Record<string, string> = { 'content-type': 'application/json' }
      // A local server usually wants no key at all, and sending an empty bearer
      // is rejected by some of them — so the header is omitted, not blanked.
      if (req.config.apiKey !== '') headers.authorization = `Bearer ${req.config.apiKey}`

      const res = await doFetch(`${base}/v1/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: req.config.model,
          messages,
          tools,
          ...(req.config.maxTokens === undefined ? {} : { max_tokens: req.config.maxTokens }),
          ...(req.config.extra ?? {}),
        }),
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`${req.config.provider} ${res.status}: ${body.slice(0, 400)}`)
      }
      const json = (await res.json()) as { choices?: { message?: WireMessage }[] }
      const msg = json.choices?.[0]?.message ?? {}
      messages.push({
        role: 'assistant',
        content: msg.content ?? null,
        ...(msg.tool_calls === undefined ? {} : { tool_calls: msg.tool_calls }),
      })

      const wireCalls = msg.tool_calls ?? []
      const respond = wireCalls.find((c) => c.function?.name === req.respondTool.name)
      if (respond !== undefined) {
        const input = parseArgs(respond.function?.arguments)
        const reply: ReplyText = {
          message: typeof input.message === 'string' ? input.message : '',
          speech: typeof input.speech === 'string' ? input.speech : '',
        }
        return { kind: 'final', payload: input.action ?? { kind: 'no_match' }, reply }
      }

      pendingIds = wireCalls.map((c) => c.id ?? '')
      const calls: ToolCall[] = wireCalls.map((c) => ({
        name: c.function?.name ?? '',
        input: parseArgs(c.function?.arguments),
      }))
      if (calls.length === 0) {
        const said = (msg.content ?? '').trim()
        return {
          kind: 'final',
          payload: { kind: 'unclassifiable' },
          reply: {
            message: said === '' ? 'Mình chưa hiểu ý bạn.' : said,
            speech: 'Mình chưa hiểu ý bạn.',
          },
        }
      }
      return { kind: 'tool_use', calls }
    },
  }
}
