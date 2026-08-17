# Platform: web (React client)

Applies to `src/assistant/web/`. Stack: TypeScript strict, React function
components + hooks. No state library — the conversation view model is a
reducer (four states: idle / listening / thinking / error; everything else is
messages derived from turn records).

## Conventions

- **View model first.** All conversation logic (state transitions per the
  spec flowchart, outcome→message mapping, undo-affordance rule) lives in
  plain TS modules (`model/`), unit-tested under node env without React.
  Components are thin renderers over the view model.
- **Ports for platform capability:** `TranscriptSource` (real impl: Web
  Speech API; capability-detected, never UA-sniffed — AC-20), and
  `DurableStore` (real impl: `localStorage`) for `client.pending_input` and
  `client.outgoing_turn` (data-model.md, client stores). Tests inject
  scripted transcript sources and failure/permission/capability injection —
  the spec's speech test seam (AC-2, AC-20–22).
- API calls match `specs/assistant/api-contracts.md` exactly; the client
  never invents shapes. Manual list operations call `/tasks…` directly —
  zero assistant/AI involvement (AC-18).
- Accessibility is contract: controls keyboard-operable with name/role/value
  and visible labels matching accessible names (AC-19); testids come from
  the design mockup catalogue only — never invented.

## File structure

```
src/assistant/web/
├── model/               # reducer, message mapping, undo window, offline handover
├── ports/               # TranscriptSource, DurableStore interfaces + test doubles
├── api/                 # thin typed client over api-contracts.md
├── components/          # conversation surface, composer, mic, list
└── __tests__/           # node-env model tests + jsdom component tests
```

## Test Harness

- **Dependency manifest:** `package.json` at the project root (shared with
  backend/mobile; created by the first implementer per
  `_completion-protocol.md`). Expected dev deps for this layer: `vitest`,
  `jsdom`, `typescript` (+ `@testing-library/react` if component tests need
  queries beyond raw DOM).
- **Install:** `npm install`
- **Unit tests:** `npx vitest run src/assistant/web`
- **Environment rule:** model/port tests run in the default node env;
  component tests declare `// @vitest-environment jsdom` at the top of the
  file (no global config needed).
- **Typecheck:** `npx tsc --noEmit`
- **Env:** Node ≥ 20 (verified v22.17.0). No browser or dev server needed
  for unit tests; e2e (Playwright) is QA-owned under `qa/…/automation/e2e/`.

**Executed 2026-08-16** (architect-agent, scratch workspace, same manifest
and command shape — root package.json did not exist yet):

```
$ npx vitest run src/assistant/web    # jsdom smoke: @vitest-environment jsdom
 Test Files  1 passed (1)
      Tests  1 passed (1)
   Duration  353ms (environment 264ms)
```

vitest/4.1.10, jsdom installed as a dev dep; node-env run also verified
(79ms, 1 passed).
