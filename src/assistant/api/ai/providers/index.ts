// The registry's contents. Importing this module is what makes a provider
// reachable by name; nothing else in the AI layer imports a vendor file.
//
// Adding one is this file plus one adapter — and if the vendor speaks the
// OpenAI Chat Completions shape, not even that: point `AI_BASE_URL` at it and
// set `AI_PROVIDER=openai-compatible`.

import { registerProvider } from '../provider.ts'
import { anthropicProvider } from './anthropic.ts'
import { openAiCompatibleProvider } from './openai-compatible.ts'

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

export { anthropicProvider, openAiCompatibleProvider }
