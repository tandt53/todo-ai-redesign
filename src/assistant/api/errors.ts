// Error envelope per api-contracts.md ## Conventions:
//   { error: { code, message, field?, detail? } }
// plus optional extra top-level body fields (502 AI_ERROR carries { error, turn }).
// Stack traces never reach clients (platform doc).

export interface ApiErrorOpts {
  field?: string
  detail?: Record<string, unknown>
  /** extra top-level body fields alongside `error` (e.g. the 502 body's `turn`) */
  bodyExtra?: Record<string, unknown>
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly opts: ApiErrorOpts

  constructor(status: number, code: string, message: string, opts: ApiErrorOpts = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.opts = opts
  }

  body(): Record<string, unknown> {
    const error: Record<string, unknown> = { code: this.code, message: this.message }
    if (this.opts.field !== undefined) error.field = this.opts.field
    if (this.opts.detail !== undefined) error.detail = this.opts.detail
    return { error, ...(this.opts.bodyExtra ?? {}) }
  }
}

export const validation = (message: string, field?: string): ApiError =>
  new ApiError(400, 'VALIDATION', message, field === undefined ? {} : { field })

export const unauthenticated = (): ApiError =>
  new ApiError(401, 'UNAUTHENTICATED', 'missing X-User-Id header')

export const notFound = (what: string): ApiError => new ApiError(404, 'NOT_FOUND', what)

export const conflict = (code: string, message: string, opts: ApiErrorOpts = {}): ApiError =>
  new ApiError(409, code, message, opts)
