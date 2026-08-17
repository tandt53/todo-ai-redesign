# Platform: backend (prototype server)

Applies to `src/assistant/api/` (MANIFEST `module_src` + `api/`). Stack:
TypeScript strict, Node ≥ 20, `node:http` — no framework (ADR-001).

## Conventions

- **Ports over globals.** `Interpreter`, `Clock`, `Store`, and config
  (`idleCloseMs`, `interpreter.model`) are constructor-injected into the app
  factory. Production wiring lives in one place (`server.ts`); tests build
  the app with the fixture Interpreter, fake Clock, and memory Store.
- **App factory pattern:** `createApp(deps): http.RequestListener` — tests
  drive it in-process with supertest; `server.ts` binds it to a port
  (default 4460) for dev.
- Every endpoint shape comes from `specs/assistant/api-contracts.md` —
  never invented (ethos §9). Entity shapes from `specs/assistant/data-model.md`.
- Errors always use the error envelope; codes exactly as the contract table.
- The serial queue is per-account; nothing may read task state for a turn
  outside its queue slot (OQ 7 freshness).

## File structure

```
src/assistant/api/
├── server.ts            # bind + production wiring only
├── app.ts               # createApp(deps) — routing, auth, validation
├── engine/              # turn engine: apply, undo, questions, dedupe, sessions
├── ports/               # Interpreter, Clock, Store interfaces + fixture stub
├── store/               # memory store + JSON snapshot adapter (data/assistant.json)
└── __tests__/           # unit + supertest integration tests
```

## Test Harness

- **Dependency manifest:** `package.json` at the **project root** (single
  package, no workspaces). It does not exist yet — per
  `_completion-protocol.md` "Runnable workspace obligation", the first
  implementer creates it listing only imported deps. Expected dev deps:
  `vitest`, `typescript`, `supertest`, `@types/supertest`, `@types/node`.
- **Install:** `npm install`
- **Unit/integration tests:** `npx vitest run src/assistant/api`
- **Single file:** `npx vitest run src/assistant/api/__tests__/<file>.test.ts`
- **Typecheck:** `npx tsc --noEmit`
- **Env:** Node ≥ 20 (verified v22.17.0), npm 10.9.2. No env vars needed for
  tests (fixture Interpreter — no `ANTHROPIC_API_KEY`); dev server against
  the real model reads `ANTHROPIC_API_KEY` from the environment.

**Executed 2026-08-16** (architect-agent, in a scratch workspace with this
exact manifest/command shape — project root had no package.json yet):

```
$ npx vitest --version
vitest/4.1.10 darwin-arm64 node-v22.17.0
$ npx vitest run src/assistant
 Test Files  1 passed (1)
      Tests  1 passed (1)
   Duration  79ms
```

Integration tests use supertest **in-process** against `createApp(...)` — no
listening port, no network, so they count as unit-tier tests and never
require a running harness (C5 runs them for real).
