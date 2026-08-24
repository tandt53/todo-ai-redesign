// The registry's contents. Importing this module is what makes a provider
// reachable by name; nothing else in the AI layer imports a vendor file.
//
// Adding one is this file plus one adapter — and if the vendor speaks the
// OpenAI Chat Completions shape, not even that: point `AI_BASE_URL` at it and
// set `AI_PROVIDER=openai-compatible`.

import { registerProvider } from '../provider.ts'
import { anthropicProvider } from './anthropic.ts'
import { openAiCompatibleProvider } from './openai-compatible.ts'

registerProvider('anthropic', anthropicProvider)
registerProvider('openai', openAiCompatibleProvider)
// The same adapter under a name that says what it is, for a self-hosted or
// third-party server that copied the endpoint.
registerProvider('openai-compatible', openAiCompatibleProvider)

export { anthropicProvider, openAiCompatibleProvider }
