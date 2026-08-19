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

---

## Feature: F-005 task-detail

Shapes are `specs/assistant/api-contracts.md § Feature F-005`; fields are
`data-model.md § Feature F-005`. Nothing here restates them — this section is
the conventions an implementer would otherwise have to invent.

- **One validator, two doors.** `taskChangesFrom` holds the field rules today
  and is called **only from the HTTP handlers**; `applyEdit` assigns straight
  onto the row. Extract the rules into one named validator that **both** doors
  call (F-005 AC-40). A grep for its name must return the HTTP handler *and*
  the turn path. Same rule, same rejected value, **outcome stated per path** —
  `400 VALIDATION` with a field name to a client that sent a bad body, the
  `refused` outcome to a person who spoke a well-formed sentence. This is
  **L-005**'s remedy applied before the bug, on the door AC-36 widens.
- **One installer for the zone.** `recordClientZone(state, userId, reported)`
  is called from the auth step, before routing, for **every** request. Both
  reporting channels (`X-Timezone`, the turn body's `timezone`) go through it.
  Do not read either one anywhere else; every computation reads
  `account.timezone`.
- **Plan, capture, apply.** The turn engine gains a plan phase (ADR-013). The
  plan is a pure function of the resolved targets and current state and
  performs no writes; **apply consumes the planned set and never re-derives
  it.** Two implementations of "which completions generate and which parents
  cascade" is the duplication this project keeps paying for (L-004).
- **`DIFF_FIELDS` splits into two constants** and `NewTaskFields` widens
  (api-contracts § The turn path). `RECURRENCE_MEMBERS` is the single
  enumeration the validator, the differ and the serializer all read — do not
  write the six names a fourth time.
- **Multi-row writes.** Every mutating handler returns `{task, changed}` and,
  where a row was hard-removed, `removed`. Build the response from the rows the
  write actually touched; never from a re-read of the store.
- **Canonicalise, do not reject, a non-canonical set.** `repeat_weekdays` and
  `repeat_month_days` are sorted, de-duplicated and joined on write (ADR-011),
  so stored values are byte-comparable and `taskEquals`'s `===` stays correct.
- **Soft deletes mint one gesture id** per gesture, written on every row the
  gesture trashes, in the same transaction as `deleted_at` (ADR-012).
- **`ever_completed` is set by the transition, never by a recount** (ADR-014).
- **Migrations: none.** The store is a JSON snapshot behind the `Store` port
  (ADR-001) and there is no migration mechanism. Every F-005 field is
  nullable-or-defaulted on the 790 existing rows and the read rules cover them:
  `priority` `null` → `none`, absent `due_all_day` → resolved or `null`, absent
  `delete_gesture_id` → a singleton restore. **Do not write a backfill** —
  ADR-009's precedent (*past states are not rewritten so an enum reads tidily*)
  and ADR-012's rejection of every inferable membership key.
- **`__qa__` endpoints are not served by `createApp`.** The seed path, the
  clock setter and the store re-open live in the QA harness
  (`tests/harness/qa-test-server.ts`), which wraps the app and
  writes through the `Store` port. Adding them to the production app would put
  a validation bypass on the shipped surface.

### Tests

Command unchanged: `npx vitest run src/assistant/api`. Two shapes worth naming
because the natural test passes without them:

- **One case per door, structurally distinct** (L-005, L-006). AC-38's cold
  open and resume are two doors; AC-40 is one case per rule attempted through
  the **turn** path, since the HTTP path already passes. Do not parameterise
  over a shared setup — a shared setup is what hides the door nobody guarded.
- **AC-46 needs two cases and one absence**: a turn that completes a repeating
  task and a turn that completes a parent, each undone; plus **no step title
  appears in the reverted turn's outcome message** for a parent with eight
  steps.
