// Production wiring + bind only (platform doc). Dev persistence via the JSON
// snapshot at data/assistant.json (ADR-001).
//
// This phase ships the fixture-stub Interpreter only — the briefing forbids
// real AI provider calls here. The real Anthropic-backed Interpreter replaces
// the stub behind the same port in a later phase, reading ANTHROPIC_API_KEY
// from the environment and INTERPRETER_DEFAULTS (model resolved server-side,
// never chosen by the client — api-contracts.md).

import { createServer } from 'node:http'
import { createApp } from './app.ts'
import { FixtureInterpreter } from './ports/fixture-interpreter.ts'
import { FIXTURE_TABLE } from './ports/fixture-table.ts'
import { systemClock } from './ports/clock.ts'
import { MemoryStore } from './store/memory-store.ts'
import { DEFAULT_IDLE_CLOSE_MS } from './engine/sessions.ts'

const port = Number(process.env.PORT ?? 4460)

const app = createApp({
  store: new MemoryStore({ snapshotPath: 'data/assistant.json' }),
  interpreter: new FixtureInterpreter(FIXTURE_TABLE),
  clock: systemClock,
  idleCloseMs: DEFAULT_IDLE_CLOSE_MS,
})

createServer(app).listen(port, () => {
  console.log(`assistant prototype server listening on http://localhost:${port}`)
})
