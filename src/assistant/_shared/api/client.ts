// Thin typed client over specs/assistant/api-contracts.md. The client never
// invents shapes (platform web.md): request bodies carry exactly the fields
// the contract names, responses are trusted as the wire types.
//
// `fetchFn` is the module's API seam — unit tests mock the API here, no live
// server needed (web.md Test Harness).

import type {
  SessionReadWire,
  TaskWire,
  TurnRequestBody,
  TurnResponseWire,
  UndoOutcomeWire,
} from '../types.ts'

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

export type ApiResult<T> =
  | { kind: 'ok'; value: T }
  | {
      kind: 'http-error'
      status: number
      code: string
      message: string
      detail?: Record<string, unknown>
      /** full parsed body — 502 AI_ERROR / 500 APPLY_FAILED carry {error, turn} */
      body: unknown
    }
  | { kind: 'network'; error: unknown }

export interface TaskCreateBody {
  /** Optional client-generated uuid (api-contracts, supporting endpoints): the
   * offline local path creates the task under a real id and replays the create
   * on reconnect — there is no temporary-id mapping. A colliding id answers
   * `409 TASK_ID_EXISTS`, which a client replaying its own create reads as its
   * already-synced ack. */
  id?: string
  title: string
  due_at?: string | null
  priority?: string | null
  status?: string
}

export interface TaskPatchBody {
  title?: string
  due_at?: string | null
  reminder_at?: string | null
  priority?: string | null
  status?: string
}

export class AssistantApi {
  private readonly base: string
  private readonly userId: string
  private readonly fetchFn: FetchLike

  constructor(opts: { baseUrl?: string; userId: string; fetchFn?: FetchLike }) {
    this.base = opts.baseUrl ?? ''
    this.userId = opts.userId
    this.fetchFn = opts.fetchFn ?? ((url, init) => globalThis.fetch(url, init))
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
    let res: Response
    try {
      res = await this.fetchFn(`${this.base}${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          'X-User-Id': this.userId,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch (error) {
      return { kind: 'network', error }
    }
    let parsed: unknown = null
    try {
      parsed = await res.json()
    } catch {
      parsed = null
    }
    if (res.ok) return { kind: 'ok', value: parsed as T }
    const err = (parsed as { error?: { code?: string; message?: string; detail?: Record<string, unknown> } } | null)?.error
    return {
      kind: 'http-error',
      status: res.status,
      code: err?.code ?? 'UNKNOWN',
      message: err?.message ?? `HTTP ${res.status}`,
      detail: err?.detail,
      body: parsed,
    }
  }

  /** POST /assistant/turn — one conversation turn; answers are normal turns. */
  postTurn(body: TurnRequestBody): Promise<ApiResult<TurnResponseWire>> {
    return this.request('POST', '/assistant/turn', body)
  }

  /** GET /assistant/session — resume, or the clean-start boundary (AC-28). */
  getSession(): Promise<ApiResult<SessionReadWire>> {
    return this.request('GET', '/assistant/session')
  }

  /** POST /assistant/session/close */
  closeSession(sessionId: string): Promise<ApiResult<unknown>> {
    return this.request('POST', '/assistant/session/close', {
      session_id: sessionId,
      reason: 'user_closed',
    })
  }

  /** POST /assistant/turn/{turn_id}/undo (AC-5..8) */
  undoTurn(turnId: string, via: 'tap' | 'voice'): Promise<ApiResult<UndoOutcomeWire>> {
    return this.request('POST', `/assistant/turn/${turnId}/undo`, { via })
  }

  // ---- manual path (AC-18) — /tasks only, never /assistant/* ----

  listTasks(): Promise<ApiResult<{ tasks: TaskWire[] }>> {
    return this.request('GET', '/tasks')
  }

  createTask(body: TaskCreateBody): Promise<ApiResult<{ task: TaskWire }>> {
    return this.request('POST', '/tasks', body)
  }

  patchTask(id: string, body: TaskPatchBody): Promise<ApiResult<{ task: TaskWire }>> {
    return this.request('PATCH', `/tasks/${id}`, body)
  }

  deleteTask(id: string): Promise<ApiResult<{ task: TaskWire }>> {
    return this.request('DELETE', `/tasks/${id}`)
  }
}
