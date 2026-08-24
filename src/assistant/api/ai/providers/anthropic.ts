// Anthropic Messages API, with tool use. One of several — see provider.ts.
//
// Everything vendor-shaped is in this file: the header names, the version
// pin, `input_schema`, and the content-block layout. The loop, the tools and
// the reply rules never see any of it.

import type { ClientRequest, ProviderFactory } from '../provider.ts'
import type { ModelClient } from '../loop.ts'
import type { ToolCall } from '../tools.ts'
import type { ReplyText } from '../reply.ts'
import type { ModelUsage } from '../usage.ts'

const API_VERSION = '2023-06-01'
const DEFAULT_BASE = 'https://api.anthropic.com'

/** Anthropic reports cache reads separately from ordinary input, so the two are
 *  summed into `input_tokens` and the cached half is also carried on its own. */
function usageOf(u: Record<string, unknown> | undefined): ModelUsage | undefined {
  if (u === undefined) return undefined
  const n = (k: string): number => (typeof u[k] === 'number' ? (u[k] as number) : 0)
  const cached = n('cache_read_input_tokens')
  return {
    input_tokens: n('input_tokens') + cached + n('cache_creation_input_tokens'),
    cached_input_tokens: cached,
    output_tokens: n('output_tokens'),
  }
}

interface Block {
  type: string
  id?: string
  name?: string
  input?: Record<string, unknown>
  text?: string
}

export const anthropicProvider: ProviderFactory = (req: ClientRequest): ModelClient => {
  const doFetch = req.fetchImpl ?? fetch
  const base = (req.config.baseUrl ?? DEFAULT_BASE).replace(/\/+$/, '')
  const tools = [...req.tools, req.respondTool].map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.schema,
  }))
  const messages: { role: 'user' | 'assistant'; content: unknown }[] = [
    { role: 'user', content: req.firstUserMessage },
  ]
  // Provider-assigned ids for the previous round's tool_use blocks, in the order
  // the loop hands results back. Held here because the loop deliberately knows
  // nothing about any wire shape.
  let pendingIds: string[] = []

  return {
    async next(results) {
      if (results.length > 0) {
        messages.push({
          role: 'user',
          content: results.map((r, i) => ({
            type: 'tool_result',
            tool_use_id: pendingIds[i] ?? `unknown_${i}`,
            is_error: r.is_error,
            content: JSON.stringify(r.result),
          })),
        })
      }

      const res = await doFetch(`${base}/v1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': req.config.apiKey,
          'anthropic-version': API_VERSION,
        },
        body: JSON.stringify({
          model: req.config.model,
          max_tokens: req.config.maxTokens ?? 1024,
          system: req.system,
          tools,
          messages,
          ...(req.config.extra ?? {}),
        }),
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`anthropic ${res.status}: ${body.slice(0, 400)}`)
      }
      const json = (await res.json()) as { content?: Block[]; usage?: Record<string, unknown> }
      const blocks = json.content ?? []
      const usage = usageOf(json.usage)
      messages.push({ role: 'assistant', content: blocks })

      const uses = blocks.filter((b) => b.type === 'tool_use')
      const respond = uses.find((b) => b.name === req.respondTool.name)
      if (respond !== undefined) {
        const input = respond.input ?? {}
        const reply: ReplyText = {
          message: typeof input.message === 'string' ? input.message : '',
          speech: typeof input.speech === 'string' ? input.speech : '',
        }
        return { kind: 'final', payload: input.action ?? { kind: 'no_match' }, reply, ...(usage === undefined ? {} : { usage }) }
      }

      pendingIds = uses.map((b) => b.id ?? '')
      const calls: ToolCall[] = uses.map((b) => ({ name: b.name ?? '', input: b.input ?? {} }))
      if (calls.length === 0) {
        const said = blocks.filter((b) => b.type === 'text').map((b) => b.text ?? '').join(' ').trim()
        return {
          kind: 'final',
          payload: { kind: 'unclassifiable' },
          reply: {
            message: said === '' ? 'Mình chưa hiểu ý bạn.' : said,
            speech: 'Mình chưa hiểu ý bạn.',
          },
          ...(usage === undefined ? {} : { usage }),
        }
      }
      return { kind: 'tool_use', calls, ...(usage === undefined ? {} : { usage }) }
    },
  }
}
