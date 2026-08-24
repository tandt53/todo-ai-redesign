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

const registry = new Map<string, ProviderFactory>()

export function registerProvider(name: string, factory: ProviderFactory): void {
  registry.set(name.toLowerCase(), factory)
}

export function knownProviders(): string[] {
  return [...registry.keys()].sort()
}

export function createModelClient(req: ClientRequest): ModelClient {
  const key = req.config.provider.trim().toLowerCase()
  const factory = registry.get(key)
  if (factory === undefined) {
    throw new Error(
      `unknown AI provider '${req.config.provider}' — registered: ${knownProviders().join(', ') || 'none'}`,
    )
  }
  return factory(req)
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
