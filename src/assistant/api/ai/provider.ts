// Which model answers, and from where — resolved from configuration, never
// compiled in (owner, 2026-08-24: "đừng fix cứng 1 AI provider hay model").
//
// The seam that makes this cheap already exists: `ModelClient` in loop.ts is
// four lines and knows nothing about any vendor, and the tool catalogue is
// plain JSON Schema. A provider is therefore one file that converts in two
// directions, and adding one changes nothing else.
//
// **There is no default model and no default provider.** A fallback here is the
// hard-coding this file exists to remove: it would run somebody's traffic
// against a vendor they never chose, and the failure would look like a working
// system. Absent configuration is an error that names what is missing.

import type { ModelClient } from './loop.ts'
import type { ToolSpec } from './tools.ts'

export interface ProviderConfig {
  /** registry key — `anthropic`, `openai`, or any OpenAI-compatible server */
  provider: string
  /** the model id, verbatim as that provider names it */
  model: string
  apiKey: string
  /** override the vendor's default host: a gateway, a proxy, or a local server */
  baseUrl?: string
  maxTokens?: number
  /** provider-specific extras passed through untouched */
  extra?: Record<string, unknown>
}

export interface ClientRequest {
  config: ProviderConfig
  system: string
  firstUserMessage: string
  tools: readonly ToolSpec[]
  /** the tool a model calls to finish the turn — same contract for every provider */
  respondTool: ToolSpec
  fetchImpl?: typeof fetch
}

export type ProviderFactory = (req: ClientRequest) => ModelClient

/**
 * What a provider does differently, declared rather than assumed.
 *
 * This exists because the three shapes below are NOT interchangeable and the
 * difference is invisible until the bill arrives:
 *
 * - `explicit-breakpoints` - nothing is cached unless the request marks where
 *   the stable prefix ends (Anthropic). Send no marker and you pay full price
 *   on every round while believing caching is on.
 * - `automatic` - the server caches a long-enough prefix by itself and takes no
 *   parameter (OpenAI, DeepSeek). There is nothing to send.
 * - `none` - no prompt caching at all (most local servers).
 */
export interface ProviderCapabilities {
  cache: 'explicit-breakpoints' | 'automatic' | 'none'
  /** shortest prefix that caches at all, when the provider publishes one */
  cacheMinTokens?: number
  /** false means the loop cannot run against it - the whole design needs tools */
  toolCalling: boolean
}

interface Entry {
  factory: ProviderFactory
  capabilities: ProviderCapabilities
}

const registry = new Map<string, Entry>()

export function registerProvider(
  name: string,
  factory: ProviderFactory,
  capabilities: ProviderCapabilities,
): void {
  registry.set(name.toLowerCase(), { factory, capabilities })
}

/** What the named provider does differently. Throws for an unknown name. */
export function capabilitiesOf(name: string): ProviderCapabilities {
  const entry = registry.get(name.trim().toLowerCase())
  if (entry === undefined) {
    throw new Error(
      `unknown AI provider '${name}' - registered: ${knownProviders().join(', ') || 'none'}`,
    )
  }
  return entry.capabilities
}

export function knownProviders(): string[] {
  return [...registry.keys()].sort()
}

export function createModelClient(req: ClientRequest): ModelClient {
  const key = req.config.provider.trim().toLowerCase()
  const entry = registry.get(key)
  if (entry === undefined) {
    throw new Error(
      `unknown AI provider '${req.config.provider}' — registered: ${knownProviders().join(', ') || 'none'}`,
    )
  }
  return entry.factory(req)
}

/**
 * Fail now, at startup, on anything that would fail on the first user's turn.
 *
 * The registry lookup happens per turn, so an unknown provider name otherwise
 * starts a server that says `hal9000/x` in its log and answers every request
 * with "I did not understand". Measured: it did exactly that until this
 * function existed.
 */
export function assertUsable(config: ProviderConfig): void {
  const cap = capabilitiesOf(config.provider)
  if (!cap.toolCalling) {
    throw new Error(
      `provider '${config.provider}' does not support tool calling, which this assistant requires`,
    )
  }
  if (config.model.trim() === '') throw new Error('AI_MODEL is empty')
}

/**
 * Read the configuration out of the environment.
 *
 * `AI_PROVIDER` and `AI_MODEL` are required and have no defaults. The key is
 * looked for under `AI_API_KEY` first, then under the vendor's conventional
 * name, so an existing `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` keeps working
 * without being renamed. `AI_BASE_URL` points at a gateway, a proxy or a local
 * server — it is what makes an OpenAI-compatible entry cover Ollama, vLLM,
 * LM Studio, OpenRouter and Together without a line of code each.
 */
export function providerConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): ProviderConfig {
  const provider = env.AI_PROVIDER?.trim()
  const model = env.AI_MODEL?.trim()
  const missing: string[] = []
  if (provider === undefined || provider === '') missing.push('AI_PROVIDER')
  if (model === undefined || model === '') missing.push('AI_MODEL')
  if (missing.length > 0) {
    throw new Error(
      `AI is not configured: set ${missing.join(' and ')}. Registered providers: ${knownProviders().join(', ') || 'none'}`,
    )
  }
  const vendorKey = `${provider!.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_API_KEY`
  const apiKey = env.AI_API_KEY?.trim() ?? env[vendorKey]?.trim() ?? ''
  const maxTokensRaw = env.AI_MAX_TOKENS?.trim()
  const maxTokens = maxTokensRaw === undefined || maxTokensRaw === '' ? undefined : Number(maxTokensRaw)
  if (maxTokens !== undefined && (!Number.isInteger(maxTokens) || maxTokens <= 0)) {
    throw new Error(`AI_MAX_TOKENS must be a positive integer, got '${maxTokensRaw}'`)
  }
  const baseUrl = env.AI_BASE_URL?.trim()
  return {
    provider: provider!,
    model: model!,
    apiKey,
    ...(baseUrl === undefined || baseUrl === '' ? {} : { baseUrl }),
    ...(maxTokens === undefined ? {} : { maxTokens }),
  }
}
