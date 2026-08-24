// F-007 - the hearing and speaking roles.
//
// No network: scripted transports drive the real conversion code. What is under
// test is the part that differs per vendor, because that is where a port like
// this actually breaks - multipart versus raw body, where the language goes,
// which header carries the key, and what comes back.

import { describe, expect, it } from 'vitest'
import '../ai/providers/index.ts'
import {
  knownStt,
  knownTts,
  registerStt,
  speak,
  speechConfigFromEnv,
  sttCapabilities,
  transcribe,
  ttsCapabilities,
  type SpeechConfig,
} from '../ai/speech.ts'

const AUDIO = new Uint8Array([1, 2, 3, 4, 5])

interface Seen { url: string; headers: Record<string, string>; body: unknown; method: string }

function transport(response: unknown, opts: { binary?: boolean } = {}) {
  const seen: Seen[] = []
  const fetchImpl = (async (url: unknown, init: unknown) => {
    const i = init as { method: string; headers?: Record<string, string>; body?: unknown }
    seen.push({ url: String(url), headers: i.headers ?? {}, body: i.body, method: i.method })
    return {
      ok: true,
      status: 200,
      json: async () => response,
      text: async () => JSON.stringify(response),
      arrayBuffer: async () => new Uint8Array([9, 9, 9]).buffer,
    }
  }) as unknown as typeof fetch
  return { seen, fetchImpl, binary: opts.binary === true }
}

const cfg = (over: Partial<SpeechConfig>): SpeechConfig => ({
  provider: 'openai', model: 'm', apiKey: 'k', baseUrl: 'https://example.invalid', ...over,
})

// ---- hearing ---------------------------------------------------------------

describe('F-007 STT - OpenAI-compatible', () => {
  it('sends multipart with a named file, and asks for verbose json', async () => {
    const t = transport({ text: 'buy milk', language: 'vietnamese', duration: 4.2 })
    const out = await transcribe({
      audio: AUDIO, mimeType: 'audio/webm', language: 'vi-VN',
      config: cfg({}), fetchImpl: t.fetchImpl,
    })
    expect(out).toEqual({ text: 'buy milk', language: 'vietnamese', seconds: 4.2 })
    expect(t.seen[0]!.url).toBe('https://example.invalid/v1/audio/transcriptions')
    expect(t.seen[0]!.body).toBeInstanceOf(FormData)
    const form = t.seen[0]!.body as FormData
    expect(form.get('model')).toBe('m')
    expect(form.get('response_format')).toBe('verbose_json')
    // ISO-639-1, not BCP-47: this endpoint rejects `vi-VN`.
    expect(form.get('language')).toBe('vi')
    expect((form.get('file') as File).name).toBe('audio.webm')
  })

  it('omits the key header entirely for a local server', async () => {
    const t = transport({ text: '' })
    await transcribe({
      audio: AUDIO, mimeType: 'audio/wav',
      config: cfg({ provider: 'openai-compatible', apiKey: '', baseUrl: 'http://localhost:8080' }),
      fetchImpl: t.fetchImpl,
    })
    expect(Object.keys(t.seen[0]!.headers).map((k) => k.toLowerCase())).not.toContain('authorization')
  })

  it('reports a missing duration as null rather than zero', async () => {
    const t = transport({ text: 'x' })
    const out = await transcribe({ audio: AUDIO, mimeType: 'audio/webm', config: cfg({}), fetchImpl: t.fetchImpl })
    expect(out.seconds).toBeNull()
  })
})

describe('F-007 STT - Deepgram', () => {
  it('sends raw audio as the body, params in the query, and a Token scheme', async () => {
    const t = transport({
      results: { channels: [{ alternatives: [{ transcript: 'call mom' }] }] },
      metadata: { duration: 3.1 },
    })
    const out = await transcribe({
      audio: AUDIO, mimeType: 'audio/webm', language: 'vi',
      config: cfg({ provider: 'deepgram', model: 'nova-3' }), fetchImpl: t.fetchImpl,
    })
    expect(out).toEqual({ text: 'call mom', language: 'vi', seconds: 3.1 })
    // NOT multipart - the audio is the body.
    expect(t.seen[0]!.body).toBe(AUDIO)
    expect(t.seen[0]!.url).toContain('model=nova-3')
    expect(t.seen[0]!.url).toContain('language=vi')
    // `Token`, not `Bearer`.
    expect(t.seen[0]!.headers.authorization).toBe('Token k')
    expect(t.seen[0]!.headers['content-type']).toBe('audio/webm')
  })

  it('does not claim a detected language it was never given', async () => {
    const t = transport({ results: { channels: [{ alternatives: [{ transcript: 'x' }] }] } })
    const out = await transcribe({
      audio: AUDIO, mimeType: 'audio/webm',
      config: cfg({ provider: 'deepgram', model: 'nova-3' }), fetchImpl: t.fetchImpl,
    })
    expect(out.language).toBeNull()
  })
})

// ---- speaking --------------------------------------------------------------

describe('F-007 TTS - OpenAI-compatible', () => {
  it('posts the text and returns audio bytes with a matching mime type', async () => {
    const t = transport(null)
    const out = await speak({
      text: 'Added Buy milk.', voice: 'alloy', format: 'wav',
      config: cfg({}), fetchImpl: t.fetchImpl,
    })
    expect(out.audio).toEqual(new Uint8Array([9, 9, 9]))
    expect(out.mimeType).toBe('audio/wav')
    expect(t.seen[0]!.url).toBe('https://example.invalid/v1/audio/speech')
    const body = JSON.parse(t.seen[0]!.body as string) as Record<string, unknown>
    expect(body).toMatchObject({ model: 'm', input: 'Added Buy milk.', voice: 'alloy', response_format: 'wav' })
  })

  it('counts characters the way a person would, not the way UTF-16 does', async () => {
    const t = transport(null)
    // 'Done' is two code units in UTF-16 but one character each to a biller.
    const out = await speak({ text: 'All done', config: cfg({}), fetchImpl: t.fetchImpl })
    expect(out.characters).toBe([...'All done'].length)
  })
})

describe('F-007 TTS - Deepgram Aura', () => {
  it('puts the voice in the query and the text in the body', async () => {
    const t = transport(null)
    await speak({
      text: 'all done', voice: 'aura-2-thalia-en',
      config: cfg({ provider: 'deepgram', model: 'aura-2' }), fetchImpl: t.fetchImpl,
    })
    expect(t.seen[0]!.url).toContain('model=aura-2-thalia-en')
    expect(JSON.parse(t.seen[0]!.body as string)).toEqual({ text: 'all done' })
    expect(t.seen[0]!.headers.authorization).toBe('Token k')
  })
})

describe('F-007 TTS - ElevenLabs', () => {
  it('puts the voice in the PATH and the model in the body', async () => {
    const t = transport(null)
    await speak({
      text: 'hello', voice: 'voice-123',
      config: cfg({ provider: 'elevenlabs', model: 'eleven_flash_v2_5' }), fetchImpl: t.fetchImpl,
    })
    expect(t.seen[0]!.url).toBe('https://example.invalid/v1/text-to-speech/voice-123')
    expect(JSON.parse(t.seen[0]!.body as string)).toMatchObject({ text: 'hello', model_id: 'eleven_flash_v2_5' })
    // Not an authorization scheme at all.
    expect(t.seen[0]!.headers['xi-api-key']).toBe('k')
  })

  it('says what is missing instead of posting to a path with an empty segment', async () => {
    const t = transport(null)
    await expect(
      speak({ text: 'x', config: cfg({ provider: 'elevenlabs', model: 'm' }), fetchImpl: t.fetchImpl }),
    ).rejects.toThrow(/needs a voice id/)
  })
})

// ---- the registry ----------------------------------------------------------

describe('F-007 the speech registry', () => {
  it('holds both roles, separately', () => {
    expect(knownStt()).toEqual(['deepgram', 'openai', 'openai-compatible'])
    expect(knownTts()).toEqual(['deepgram', 'elevenlabs', 'openai', 'openai-compatible'])
  })

  it('declares how each is billed, so the ledger can price it', () => {
    for (const n of knownStt()) expect(sttCapabilities(n).billedBy, n).toBe('minute')
    for (const n of knownTts()) expect(ttsCapabilities(n).billedBy, n).toBe('character')
  })

  it('admits that none of them streams yet, rather than being found out at runtime', () => {
    for (const n of knownStt()) expect(sttCapabilities(n).streaming, n).toBe(false)
  })

  it('names what is registered when asked for something that is not', async () => {
    await expect(
      transcribe({ audio: AUDIO, mimeType: 'audio/webm', config: cfg({ provider: 'hal' }) }),
    ).rejects.toThrow(/unknown STT provider 'hal'.*deepgram/)
  })

  it('takes an adapter nobody shipped', async () => {
    registerStt('my-asr', async () => ({ text: 'from my own house', language: 'vi', seconds: 1 }),
      { streaming: true, billedBy: 'minute' })
    const out = await transcribe({ audio: AUDIO, mimeType: 'audio/webm', config: cfg({ provider: 'my-asr' }) })
    expect(out.text).toBe('from my own house')
    expect(sttCapabilities('my-asr').streaming).toBe(true)
  })

  it('surfaces a provider error rather than returning an empty transcript', async () => {
    const fetchImpl = (async () => ({
      ok: false, status: 503, json: async () => ({}), text: async () => 'busy',
    })) as unknown as typeof fetch
    await expect(
      transcribe({ audio: AUDIO, mimeType: 'audio/webm', config: cfg({}), fetchImpl }),
    ).rejects.toThrow(/503/)
  })
})

describe('F-007 speech configuration', () => {
  it('is absent, not broken, when the role is not configured', () => {
    expect(speechConfigFromEnv('STT', {})).toBeNull()
    expect(speechConfigFromEnv('TTS', {})).toBeNull()
  })

  it('configures the two roles independently', () => {
    const env = {
      STT_PROVIDER: 'deepgram', STT_MODEL: 'nova-3', DEEPGRAM_API_KEY: 'dg',
      TTS_PROVIDER: 'elevenlabs', TTS_MODEL: 'eleven_flash_v2_5', ELEVENLABS_API_KEY: 'el',
    }
    expect(speechConfigFromEnv('STT', env)).toEqual({ provider: 'deepgram', model: 'nova-3', apiKey: 'dg' })
    expect(speechConfigFromEnv('TTS', env)).toEqual({ provider: 'elevenlabs', model: 'eleven_flash_v2_5', apiKey: 'el' })
  })

  it('refuses a half-configured role instead of running with a guess', () => {
    expect(() => speechConfigFromEnv('STT', { STT_PROVIDER: 'deepgram' })).toThrow(/half-configured/)
    expect(() => speechConfigFromEnv('TTS', { TTS_MODEL: 'x' })).toThrow(/half-configured/)
  })

  it('prefers the role key over the vendor key', () => {
    const c = speechConfigFromEnv('STT', {
      STT_PROVIDER: 'deepgram', STT_MODEL: 'nova-3', STT_API_KEY: 'role', DEEPGRAM_API_KEY: 'vendor',
    })
    expect(c!.apiKey).toBe('role')
  })
})
