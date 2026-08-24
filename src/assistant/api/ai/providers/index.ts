// The registry's contents. Importing this module is what makes a provider
// reachable by name; nothing else in the AI layer imports a vendor file.
//
// Adding one is this file plus one adapter — and if the vendor speaks the
// OpenAI Chat Completions shape, not even that: point `AI_BASE_URL` at it and
// set `AI_PROVIDER=openai-compatible`.

import { registerProvider } from '../provider.ts'
import { registerStt, registerTts } from '../speech.ts'
import { anthropicProvider } from './anthropic.ts'
import { openAiCompatibleProvider } from './openai-compatible.ts'
import {
  deepgramSpeak,
  deepgramTranscribe,
  elevenLabsSpeak,
  openAiSpeak,
  openAiTranscribe,
} from './speech-adapters.ts'

// Anthropic caches nothing unless the request says where the stable prefix
// ends, and the minimum cacheable prefix is ~1024 tokens.
registerProvider('anthropic', anthropicProvider, {
  cache: 'explicit-breakpoints',
  cacheMinTokens: 1024,
  toolCalling: true,
})

// OpenAI caches a long-enough prefix on its own and takes no parameter for it.
registerProvider('openai', openAiCompatibleProvider, {
  cache: 'automatic',
  cacheMinTokens: 1024,
  toolCalling: true,
})

// The same adapter under a name that says what it is, for a self-hosted or
// third-party server that copied the endpoint. `cache: 'none'` is the honest
// default for that population - a local llama.cpp or Ollama caches nothing, and
// a gateway that does will simply do it without being asked.
registerProvider('openai-compatible', openAiCompatibleProvider, {
  cache: 'none',
  toolCalling: true,
})

// ---- hearing --------------------------------------------------------------
// Both are batch: a finished clip in, a transcript out. Neither transcribes
// while the user is still talking - that is a websocket, and it is not built.
// The capability says so rather than letting a caller find out by trying.
registerStt('openai', openAiTranscribe, { streaming: false, billedBy: 'minute', reportsLanguage: true })
registerStt('openai-compatible', openAiTranscribe, { streaming: false, billedBy: 'minute', reportsLanguage: true })
registerStt('deepgram', deepgramTranscribe, { streaming: false, billedBy: 'minute', reportsLanguage: false })

// ---- speaking -------------------------------------------------------------
registerTts('openai', openAiSpeak, { streaming: false, billedBy: 'character' })
registerTts('openai-compatible', openAiSpeak, { streaming: false, billedBy: 'character' })
registerTts('deepgram', deepgramSpeak, { streaming: false, billedBy: 'character' })
registerTts('elevenlabs', elevenLabsSpeak, { streaming: false, billedBy: 'character' })

export { anthropicProvider, openAiCompatibleProvider }
export {
  deepgramSpeak,
  deepgramTranscribe,
  elevenLabsSpeak,
  openAiSpeak,
  openAiTranscribe,
}
