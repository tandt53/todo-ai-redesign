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
- API calls match `docs/specs/assistant/api-contracts.md` exactly; the client
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
  for unit tests; e2e (Playwright) is QA-owned under `docs/qa/…/automation/e2e/`.

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

---

## Feature: F-005 task-detail

- **The detail is one application state placed by CSS at both widths**
  (F-005 AC-45). `ShellSurface` is `'talk' | 'tasks' | 'settings'` and the
  layout branch is a **container query with no width read in JavaScript**. Do
  not introduce one — not in a hook, not in a media-query listener, not in a
  resize observer. Crossing `breakpoints.split` while the detail is open changes
  nothing about what it holds: same task, same focused field, same dirty value,
  same uncommitted repeat preview, same outstanding notice.
- **The closing affordance is unconditionally available** (F-005 AC-2, F-001
  AC-24 rev 5). Closing is never held over an in-flight or failed write; the
  value moves into the notice instead.
- **The message-door predicate is *the task exists and is not deleted*** —
  `canReveal` (`web/shell.ts`), per **F-001 AC-31 revision 7**. It is **not**
  gated on the collection currently shown, and this contract must not re-narrow
  it. The collection switch belongs to the single `revealTask` routine, not to a
  second gate beside it, and the same predicate binds the phone
  (`mobile/model/task-link.ts`) — one rule, two sites (**L-005**).
- **The notice mechanism lives in `_shared/`, which the mobile client
  compiles** (F-005 AC-47). It has to observe every write to the task's field —
  the retry, an assistant turn, an undo, a background refresh — and only the
  shared controller and `state.tasks` see all four. React state owned by the
  detail cannot see a turn's write. **The retry from the notice and the retry
  from the field are one write path called from two places.**
- **The client applies what a write returns** — `task`, every member of
  `changed`, and it drops every id in `removed` (F-005 AC-2, AC-26). Today the
  three shared write methods `await` the result and discard it, with no refresh;
  that is the receiver half, and without it AC-39 is vacuously true on mobile.
- **`ControllerDeps.timezone` is what this client *reports*; what it *computes
  with* is `account.timezone` from `GET /account`, cached durably.** Never
  `Intl.DateTimeFormat().resolvedOptions().timeZone` for a computation — that is
  the *one row, three answers* source (ADR-010).
- **One clock seam per side, widened rather than duplicated.**
  `ControllerDeps.now` already exists, is stored and defaulted, and already
  feeds `dueAtForCollection` on both clients. The five inline `new Date()` sites
  and the nine defaulted `now: Date = new Date()` parameters are what make a
  missed injection silently wall-clock instead of a type error — route them
  through the existing seam. **Do not build a second one** (L-004).
- **The harness door is `window.__assistantSeams.setClock({at, zone})**, behind
  the existing `?testMode=1` / `?qaUser=` guard (api-contracts § Harness doors).
  Paired with the server's `POST /__qa__/set-clock`, an e2e run holds both sides
  at one instant and one zone.
- **Five readers decide behaviour from raw row cardinality and never consult
  `inCollection`** (F-005 AC-35). On web: `TasksSurface.tsx`'s `nothingAnywhere`
  / `loading` / `failedBlank` trio. In the account AC-35 names — every parent
  excluded from the collection on screen — `nothingAnywhere` is **false**, so
  the surface renders the empty-collection state, not the first-run one.
- **`pushLocalTasks`'s replay literal is a sixteenth field list and produces no
  compile error when a field is missed** (every field on `TaskCreateBody` is
  optional). F-005 widens it on the **create** path by `parent_id`,
  `step_order` and `due_all_day` (AC-14, AC-13). What was declined at OQ6 is
  queue-and-replay for **edits**; this widening is required.
- **Tests:** `npx vitest run src/assistant/web` (unchanged). AC-15's pointer
  reorder is a **web e2e** case only — jsdom does not exercise a path-based
  pointer gesture — while **AC-16's move mode is the unit-testable half** and is
  where the mutation coverage for ordering lives.
