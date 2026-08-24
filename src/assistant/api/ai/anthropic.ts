// The real model transport (F-007): Anthropic Messages API with tool use.
//
// It is the only file here that touches the network, and it is deliberately
// thin — it converts between the Messages wire shape and `ModelStep`, and
// nothing else. Every rule about how many rounds to run, what a reply must look
// like and which facts get checked lives in loop.ts and reply.ts, where it is
// tested without a network.
//
// `fetch` is injected rather than reached for, so a test can drive the real
// conversion code with a scripted response body.

import { INTERPRETER_DEFAULTS } from '../ports/interpreter.ts'
import { TOOL_SCHEMAS, type ToolCall } from './tools.ts'
import type { ModelClient, ModelStep } from './loop.ts'
import type { ReplyText } from './reply.ts'

const API_VERSION = '2023-06-01'
const DEFAULT_BASE = 'https://api.anthropic.com'

export interface AnthropicOptions {
  apiKey: string
  baseUrl?: string
  model?: string
  maxTokens?: number
  system: string
  /** the user's utterance and whatever eager context the engine already built */
  firstUserMessage: string
  fetchImpl?: typeof fetch
}

/**
 * The model ends a turn by calling this, rather than by writing prose we then
 * parse. Two reasons: a tool call is schema-validated by the provider, so a
 * malformed final answer is retried by the model rather than by us; and it puts
 * the actions, the targets and BOTH sentences in one structure — the whole
 * point of the shape the owner chose.
 */
export const RESPOND_TOOL = {
  name: 'respond',
  description:
    'Finish the turn. Call this exactly once, when you know what should happen and what to say. Everything you decided goes in one call: the action, the tasks it targets, and both sentences.',
  input_schema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'object',
        description:
          'What should happen, in the engine\'s vocabulary: {kind: "create"|"edit"|"delete"|"clarify"|"query"|"no_match"|"answer"|"list_create"|"list_move"|"list_refuse"|"trash_read", ...}. Address tasks by handle, never by id.',
      },
      message: {
        type: 'string',
        description:
          'What the user reads in the chat. Your own words. Name the tasks you are acting on, in quotes, exactly as their titles read.',
      },
      speech: {
        type: 'string',
        description:
          'What is read aloud. ONE plain sentence — no markdown, no bullet list, no line breaks, no parentheses. It is heard by someone whose eyes and hands are elsewhere, so it carries the point and drops the detail.',
      },
    },
    required: ['action', 'message', 'speech'],
  },
}

interface WireContentBlock {
  type: string
  id?: string
  name?: string
  input?: Record<string, unknown>
  text?: string
}

export function createAnthropicClient(opts: AnthropicOptions): ModelClient {
  const doFetch = opts.fetchImpl ?? fetch
  const base = (opts.baseUrl ?? process.env.ANTHROPIC_BASE_URL ?? DEFAULT_BASE).replace(/\/+$/, '')
  const messages: { role: 'user' | 'assistant'; content: unknown }[] = [
    { role: 'user', content: opts.firstUserMessage },
  ]
  // Provider-assigned ids for the previous round's tool_use blocks, in the order
  // the loop will hand results back. Held here because the loop deliberately
  // knows nothing about the wire shape.
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
          'x-api-key': opts.apiKey,
          'anthropic-version': API_VERSION,
        },
        body: JSON.stringify({
          model: opts.model ?? INTERPRETER_DEFAULTS.model,
          max_tokens: opts.maxTokens ?? INTERPRETER_DEFAULTS.max_tokens,
          system: opts.system,
          tools: [...TOOL_SCHEMAS, RESPOND_TOOL],
          messages,
        }),
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`anthropic ${res.status}: ${body.slice(0, 400)}`)
      }
      const json = (await res.json()) as { content?: WireContentBlock[] }
      const blocks = json.content ?? []
      messages.push({ role: 'assistant', content: blocks })

      const uses = blocks.filter((b) => b.type === 'tool_use')
      const respond = uses.find((b) => b.name === RESPOND_TOOL.name)
      if (respond !== undefined) {
        const input = respond.input ?? {}
        const reply: ReplyText = {
          message: typeof input.message === 'string' ? input.message : '',
          speech: typeof input.speech === 'string' ? input.speech : '',
        }
        return { kind: 'final', payload: input.action ?? { kind: 'no_match' }, reply }
      }

      pendingIds = uses.map((b) => b.id ?? '')
      const calls: ToolCall[] = uses.map((b) => ({
        name: b.name ?? '',
        input: b.input ?? {},
      }))
      if (calls.length === 0) {
        // The model wrote prose and called nothing. That is not a turn outcome,
        // so say what is missing rather than parsing the prose into one.
        const said = blocks.filter((b) => b.type === 'text').map((b) => b.text ?? '').join(' ').trim()
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

export type ModelStepForTest = ModelStep
