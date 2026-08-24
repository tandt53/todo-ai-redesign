// Production wiring + bind only (platform doc). Dev persistence via the JSON
// snapshot at data/assistant.json (ADR-001).
//
// **Which interpreter runs is configuration, not a code change.** Set
// AI_PROVIDER and AI_MODEL and the model-backed one runs; leave them unset and
// the fixture stub does, exactly as before. Nothing else in the turn path
// differs between the two - that is what the `Interpreter` port was for.

import { createServer } from 'node:http'
import { createApp } from './app.ts'
import { createModelInterpreter } from './ai/interpreter.ts'
import { assertUsable, providerConfigFromEnv } from './ai/provider.ts'
import { capFromEnv, fallbackFromEnv } from './ai/resilience.ts'
import './ai/providers/index.ts'
import { FixtureInterpreter } from './ports/fixture-interpreter.ts'
import { FIXTURE_TABLE } from './ports/fixture-table.ts'
import type { Interpreter } from './ports/interpreter.ts'
import { systemClock } from './ports/clock.ts'
import { MemoryStore } from './store/memory-store.ts'
import { DEFAULT_IDLE_CLOSE_MS } from './engine/sessions.ts'

const port = Number(process.env.PORT ?? 4460)
const store = new MemoryStore({ snapshotPath: 'data/assistant.json' })

/**
 * The app owns the usage ledger, and the interpreter reports into it - so the
 * sink is handed over at construction rather than either one importing the
 * other. It is assigned before the first request can arrive, because the server
 * does not listen until after createApp returns.
 */
let sink: Parameters<NonNullable<Parameters<typeof createApp>[0]['onAiTurn']>>[0] | null = null

function buildInterpreter(): { interpreter: Interpreter; describe: string } {
  const configured = (process.env.AI_PROVIDER ?? '').trim() !== ''
  if (!configured) {
    return {
      interpreter: new FixtureInterpreter(FIXTURE_TABLE),
      describe: 'fixture interpreter (set AI_PROVIDER and AI_MODEL for a real model)',
    }
  }
  // Throws, loudly, on a half-configured or unknown provider. Falling back to
  // the fixture here would start a server that looks like it has AI and does
  // not - the failure would be discovered by a user, not by a log line.
  const config = providerConfigFromEnv()
  assertUsable(config)
  const fallback = fallbackFromEnv()
  if (fallback !== null) assertUsable(fallback)
  const cap = capFromEnv()
  return {
    interpreter: createModelInterpreter({
      config,
      store,
      clock: systemClock,
      fallback,
      cap,
      onTurn: (userId, telemetry) => sink?.(userId, telemetry),
    }),
    describe:
      `${config.provider}/${config.model}` +
      (fallback === null ? '' : ` (fallback ${fallback.provider}/${fallback.model})`) +
      (cap.perUserDailyUsd === undefined ? '' : ` (cap $${cap.perUserDailyUsd}/user/day)`),
  }
}

const { interpreter, describe } = buildInterpreter()

const app = createApp({
  store,
  interpreter,
  clock: systemClock,
  idleCloseMs: DEFAULT_IDLE_CLOSE_MS,
  onAiTurn: (s) => { sink = s },
})

createServer(app).listen(port, () => {
  console.log(`assistant prototype server listening on http://localhost:${port}`)
  console.log(`  interpreter: ${describe}`)
})
