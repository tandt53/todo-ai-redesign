// STT and TTS adapters. Each vendor's wire shape lives here and nowhere else.
//
// Three shapes cover most of the market:
//   - OpenAI-compatible audio endpoints (`/v1/audio/transcriptions`, `/v1/audio/speech`)
//     which OpenAI, Groq, and several local servers all implement;
//   - Deepgram, which takes raw audio as the body rather than multipart;
//   - ElevenLabs, whose speech endpoint puts the voice id in the PATH.
//
// The differences are not cosmetic, which is why each gets a function rather
// than a shared one with flags: multipart vs raw body, query params vs JSON,
// where the language goes, and what comes back all differ.

import type {
  SpeakRequest,
  Speech,
  TranscribeRequest,
  Transcript,
} from '../speech.ts'

const trimBase = (url: string | undefined, fallback: string): string =>
  (url ?? fallback).replace(/\/+$/, '')

async function failIfNotOk(res: { ok: boolean; status: number; text: () => Promise<string> }, who: string): Promise<void> {
  if (res.ok) return
  const body = await res.text().catch(() => '')
  throw new Error(`${who} ${res.status}: ${body.slice(0, 400)}`)
}

// ---- OpenAI-compatible: hearing --------------------------------------------

/**
 * `POST /v1/audio/transcriptions`, multipart. The file part must carry a
 * filename with a real extension - several servers reject a nameless part, and
 * some sniff the format from the extension rather than the content type.
 */
export async function openAiTranscribe(req: TranscribeRequest): Promise<Transcript> {
  const doFetch = req.fetchImpl ?? fetch
  const base = trimBase(req.config.baseUrl, 'https://api.openai.com')
  const ext = (req.mimeType.split('/')[1] ?? 'webm').split(';')[0]!
  const form = new FormData()
  form.append('file', new Blob([req.audio as BlobPart], { type: req.mimeType }), `audio.${ext}`)
  form.append('model', req.config.model)
  form.append('response_format', 'verbose_json')
  if (req.language !== undefined) {
    // OpenAI takes ISO-639-1 here, not BCP-47: `vi`, not `vi-VN`.
    form.append('language', req.language.split('-')[0]!)
  }
  const headers: Record<string, string> = {}
  if (req.config.apiKey !== '') headers.authorization = `Bearer ${req.config.apiKey}`

  const res = await doFetch(`${base}/v1/audio/transcriptions`, { method: 'POST', headers, body: form })
  await failIfNotOk(res as never, req.config.provider)
  const json = (await (res as unknown as { json: () => Promise<unknown> }).json()) as {
    text?: string
    language?: string
    duration?: number
  }
  return {
    text: json.text ?? '',
    language: json.language ?? null,
    seconds: typeof json.duration === 'number' ? json.duration : null,
  }
}

// ---- OpenAI-compatible: speaking -------------------------------------------

/** `POST /v1/audio/speech`, JSON in, audio bytes out. */
export async function openAiSpeak(req: SpeakRequest): Promise<Speech> {
  const doFetch = req.fetchImpl ?? fetch
  const base = trimBase(req.config.baseUrl, 'https://api.openai.com')
  const format = req.format ?? 'mp3'
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (req.config.apiKey !== '') headers.authorization = `Bearer ${req.config.apiKey}`

  const res = await doFetch(`${base}/v1/audio/speech`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: req.config.model,
      input: req.text,
      ...(req.voice === undefined ? {} : { voice: req.voice }),
      response_format: format,
      ...(req.config.extra ?? {}),
    }),
  })
  await failIfNotOk(res as never, req.config.provider)
  const buf = await (res as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer()
  return {
    audio: new Uint8Array(buf),
    mimeType: format === 'wav' ? 'audio/wav' : format === 'opus' ? 'audio/opus' : 'audio/mpeg',
    // Billed by character, and the count is OURS to record: the response body is
    // audio, so nothing comes back to read it from.
    characters: [...req.text].length,
  }
}

// ---- Deepgram: hearing ------------------------------------------------------

/**
 * `POST /v1/listen`. Raw audio as the body - NOT multipart - with everything
 * else in the query string, and a `Token` authorization scheme rather than
 * `Bearer`. Both are easy to get wrong from an OpenAI-shaped mental model.
 */
export async function deepgramTranscribe(req: TranscribeRequest): Promise<Transcript> {
  const doFetch = req.fetchImpl ?? fetch
  const base = trimBase(req.config.baseUrl, 'https://api.deepgram.com')
  const params = new URLSearchParams({ model: req.config.model, smart_format: 'true' })
  if (req.language !== undefined) params.set('language', req.language)

  const res = await doFetch(`${base}/v1/listen?${params.toString()}`, {
    method: 'POST',
    headers: { authorization: `Token ${req.config.apiKey}`, 'content-type': req.mimeType },
    body: req.audio as BodyInit,
  })
  await failIfNotOk(res as never, 'deepgram')
  const json = (await (res as unknown as { json: () => Promise<unknown> }).json()) as {
    results?: { channels?: { alternatives?: { transcript?: string }[] }[] }
    metadata?: { duration?: number }
  }
  const alt = json.results?.channels?.[0]?.alternatives?.[0]
  return {
    text: alt?.transcript ?? '',
    // Deepgram names the language only when asked to detect one; with an
    // explicit `language` it echoes nothing, so report what we asked for rather
    // than inventing a detection that did not happen.
    language: req.language ?? null,
    seconds: typeof json.metadata?.duration === 'number' ? json.metadata.duration : null,
  }
}

// ---- Deepgram Aura: speaking ------------------------------------------------

/** `POST /v1/speak`. The voice IS the model id here (e.g. `aura-2-thalia-en`). */
export async function deepgramSpeak(req: SpeakRequest): Promise<Speech> {
  const doFetch = req.fetchImpl ?? fetch
  const base = trimBase(req.config.baseUrl, 'https://api.deepgram.com')
  const params = new URLSearchParams({ model: req.voice ?? req.config.model })
  if (req.format !== undefined) params.set('encoding', req.format)

  const res = await doFetch(`${base}/v1/speak?${params.toString()}`, {
    method: 'POST',
    headers: { authorization: `Token ${req.config.apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ text: req.text }),
  })
  await failIfNotOk(res as never, 'deepgram')
  const buf = await (res as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer()
  return { audio: new Uint8Array(buf), mimeType: 'audio/mpeg', characters: [...req.text].length }
}

// ---- ElevenLabs: speaking ---------------------------------------------------

/**
 * `POST /v1/text-to-speech/{voice_id}`. The voice is in the PATH and the model
 * in the body, which is the reverse of Deepgram - and the key header is
 * `xi-api-key`, not an authorization scheme at all.
 */
export async function elevenLabsSpeak(req: SpeakRequest): Promise<Speech> {
  const doFetch = req.fetchImpl ?? fetch
  const base = trimBase(req.config.baseUrl, 'https://api.elevenlabs.io')
  const voice = req.voice ?? (req.config.extra?.['voice_id'] as string | undefined)
  if (voice === undefined || voice === '') {
    throw new Error('elevenlabs needs a voice id - pass `voice`, or set extra.voice_id')
  }
  const res = await doFetch(`${base}/v1/text-to-speech/${encodeURIComponent(voice)}`, {
    method: 'POST',
    headers: { 'xi-api-key': req.config.apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      text: req.text,
      model_id: req.config.model,
      ...(req.config.extra ?? {}),
    }),
  })
  await failIfNotOk(res as never, 'elevenlabs')
  const buf = await (res as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer()
  return { audio: new Uint8Array(buf), mimeType: 'audio/mpeg', characters: [...req.text].length }
}
