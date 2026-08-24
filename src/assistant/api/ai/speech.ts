// The other two AI roles: hearing (STT) and speaking (TTS).
//
// The owner's picture is three models - transcript, reasoning, speak - and this
// file is roles one and three. It deliberately mirrors `provider.ts`: a small
// port, a registry keyed by name, capabilities declared rather than assumed,
// and no default provider or model anywhere.
//
// **These are the UPGRADE tier, not the floor.** `CLAUDE.md ## Project` requires
// every basic action to work with the AI off or offline, and the platform's own
// recognizer and synthesiser are what satisfy that. Nothing here is required for
// the product to function; it is what makes it better when there is a network.

export interface SpeechConfig {
  /** registry key - `openai-compatible`, `deepgram`, `elevenlabs`, ... */
  provider: string
  /** the model or voice-engine id, verbatim as that provider names it */
  model: string
  apiKey: string
  /** a gateway, a proxy, or a local server */
  baseUrl?: string
  /** provider-specific extras, passed through untouched */
  extra?: Record<string, unknown>
}

// ---- hearing ---------------------------------------------------------------

export interface TranscribeRequest {
  audio: Uint8Array
  /** e.g. `audio/webm`, `audio/wav`, `audio/mp4` */
  mimeType: string
  /**
   * BCP-47, e.g. `vi-VN`. Optional, and worth passing: left to auto-detect,
   * a five-second Vietnamese utterance is regularly heard as another language.
   */
  language?: string
  config: SpeechConfig
  fetchImpl?: typeof fetch
}

export interface Transcript {
  text: string
  /** what the provider says it heard, when it reports one */
  language: string | null
  /** billable audio length; null when the provider does not report it */
  seconds: number | null
}

export type SttFactory = (req: TranscribeRequest) => Promise<Transcript>

// ---- speaking --------------------------------------------------------------

export interface SpeakRequest {
  text: string
  /** provider-specific voice id; omitted means that provider's default */
  voice?: string
  /** `mp3` | `wav` | `opus` - what the caller wants back */
  format?: string
  config: SpeechConfig
  fetchImpl?: typeof fetch
}

export interface Speech {
  audio: Uint8Array
  mimeType: string
  /** billable length, which every TTS vendor charges by */
  characters: number
}

export type TtsFactory = (req: SpeakRequest) => Promise<Speech>

// ---- capabilities ----------------------------------------------------------

export interface SpeechCapabilities {
  /** can it transcribe while the user is still speaking, or only a finished clip */
  streaming: boolean
  /** what this adapter charges by, so the ledger prices it correctly */
  billedBy: 'minute' | 'character'
  /** true when the provider names a language rather than guessing */
  reportsLanguage?: boolean
}

interface SttEntry { transcribe: SttFactory; capabilities: SpeechCapabilities }
interface TtsEntry { speak: TtsFactory; capabilities: SpeechCapabilities }

const sttRegistry = new Map<string, SttEntry>()
const ttsRegistry = new Map<string, TtsEntry>()

export function registerStt(
  name: string,
  transcribe: SttFactory,
  capabilities: SpeechCapabilities,
): void {
  sttRegistry.set(name.toLowerCase(), { transcribe, capabilities })
}

export function registerTts(
  name: string,
  speak: TtsFactory,
  capabilities: SpeechCapabilities,
): void {
  ttsRegistry.set(name.toLowerCase(), { speak, capabilities })
}

export const knownStt = (): string[] => [...sttRegistry.keys()].sort()
export const knownTts = (): string[] => [...ttsRegistry.keys()].sort()

function pick<T>(map: Map<string, T>, name: string, kind: string, known: () => string[]): T {
  const entry = map.get(name.trim().toLowerCase())
  if (entry === undefined) {
    throw new Error(
      `unknown ${kind} provider '${name}' - registered: ${known().join(', ') || 'none'}`,
    )
  }
  return entry
}

// `async`, not a plain function returning a promise: an unknown provider must
// REJECT, not throw synchronously. A caller writing `await transcribe(...)`
// inside try/catch would otherwise be hit by a throw before the await, which is
// the same bug in a different disguise on every call site.
export async function transcribe(req: TranscribeRequest): Promise<Transcript> {
  return pick(sttRegistry, req.config.provider, 'STT', knownStt).transcribe(req)
}

export async function speak(req: SpeakRequest): Promise<Speech> {
  return pick(ttsRegistry, req.config.provider, 'TTS', knownTts).speak(req)
}

export const sttCapabilities = (name: string): SpeechCapabilities =>
  pick(sttRegistry, name, 'STT', knownStt).capabilities

export const ttsCapabilities = (name: string): SpeechCapabilities =>
  pick(ttsRegistry, name, 'TTS', knownTts).capabilities

// ---- configuration ---------------------------------------------------------

/**
 * Read one role's configuration. `prefix` is `STT` or `TTS`, so the two roles
 * are configured independently - which is the point: hearing and speaking are
 * different vendors more often than not, and forcing one choice on both is how
 * a product ends up with a good ear and a bad voice.
 *
 * Returns null when the role is not configured at all. That is not an error:
 * the platform floor is the default, and a server with no STT configured simply
 * does not offer server-side transcription.
 */
export function speechConfigFromEnv(
  prefix: 'STT' | 'TTS',
  env: Record<string, string | undefined> = process.env,
): SpeechConfig | null {
  const provider = env[`${prefix}_PROVIDER`]?.trim()
  const model = env[`${prefix}_MODEL`]?.trim()
  if ((provider ?? '') === '' && (model ?? '') === '') return null
  if ((provider ?? '') === '' || (model ?? '') === '') {
    throw new Error(
      `${prefix} is half-configured: set both ${prefix}_PROVIDER and ${prefix}_MODEL, or neither`,
    )
  }
  const vendorKey = `${provider!.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_API_KEY`
  const baseUrl = env[`${prefix}_BASE_URL`]?.trim()
  return {
    provider: provider!,
    model: model!,
    apiKey: env[`${prefix}_API_KEY`]?.trim() ?? env[vendorKey]?.trim() ?? '',
    ...(baseUrl === undefined || baseUrl === '' ? {} : { baseUrl }),
  }
}
