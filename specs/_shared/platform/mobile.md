# Platform: mobile (React Native client)

Applies to `src/assistant/mobile/`. Stack: TypeScript strict, React Native.
This phase ships prototype-grade RN code whose **logic is fully unit-tested
under Node with vitest — no simulator, no emulator, no Metro** (briefing
requirement).

## Conventions

- **Everything native lives behind a port.** `TranscriptSource` (speech
  recognition + capability/permission surface — dual permission on iOS,
  single on Android, AC-21), `DurableStore` (kill-surviving storage for
  `client.pending_input` / `client.outgoing_turn` — AsyncStorage in the real
  impl), `AppLifecycle` (background/kill/foreground, audio-interruption
  events — AC-3/AC-26/AC-27), `Connectivity` (offline handover, AC-25),
  `Announcer` (screen-reader announcements — `AccessibilityInfo.
  announceForAccessibility` in the real impl; `RecordingAnnouncer` in
  `ports/app-lifecycle.ts` is the test double that captures every
  announcement for assertion, F-003 AC-12).
  Business logic imports only the port interfaces, so unit tests run in
  plain node env with test doubles — the spec's speech seam applies to
  mobile too.
- **Announcements are built, never authored at the call site.** React Native
  has no ARIA live region, so the announced string is imperative and can
  drift from what is on screen. `model/announce.ts` builds every
  announcement from the same `Message` record the conversation renders —
  one source of content, no place for drift — and marks errors `assertive`
  so they interrupt rather than queue (F-003 AC-12). Anything that announces
  goes through it.
- **Shared view model.** The conversation reducer and outcome→message
  mapping are the same contract as web (four states, messages from turn
  records); mobile adds the lifecycle rules: pending input persists across
  kill (AC-26), the outgoing turn survives until the server acks its
  `client_turn_id` (AC-27), audio interruption = cancel-while-listening with
  text preserved (AC-3).
- API calls match `specs/assistant/api-contracts.md` exactly. Testids/
  accessibility ids come from the design mockup catalogue only.
- No RN component snapshot tests this phase; component-level verification is
  QA-owned (`qa/…/automation/mobile/`). Unit tier = model + ports.

## File structure

```
src/assistant/mobile/
├── model/               # reducer + lifecycle rules (pure TS, node-testable)
├── ports/               # TranscriptSource, DurableStore, AppLifecycle, Connectivity + doubles
├── api/                 # thin typed client over api-contracts.md
├── components/          # RN screens/components (thin over model)
└── __tests__/           # node-env vitest tests for model/ports/api
```

## Test Harness

- **Dependency manifest:** `package.json` at the project root (shared;
  created by the first implementer per `_completion-protocol.md`
  "Runnable workspace obligation"). This layer's unit tests need only
  `vitest` + `typescript` — RN itself is **not** imported by `model/` or
  `ports/` code, which is what keeps the tier simulator-free.
- **Install:** `npm install`
- **Unit tests:** `npx vitest run src/assistant/mobile` (default node env —
  no jsdom, no simulator)
- **Typecheck:** `npx tsc --noEmit`
- **Env:** Node ≥ 20 (verified v22.17.0). Nothing platform-specific.

**Executed 2026-08-16** (architect-agent, scratch workspace, identical
manifest/command shape — root package.json did not exist yet):

```
$ npx vitest --version
vitest/4.1.10 darwin-arm64 node-v22.17.0
$ npx vitest run src/assistant      # node-env TS test
 Test Files  1 passed (1)
      Tests  1 passed (1)
   Duration  79ms
```

If an implementer ever needs to import an RN module in a unit test, mock it
at the port boundary instead — a test that requires a simulator does not
belong in this tier (see `_completion-protocol.md`: unit tests never need a
harness).

---

## Feature: F-005 task-detail

**There is no detail surface on the phone this phase** (F-005 `## Out of
Scope`). What reaches the phone regardless is behaviour, and it reaches it
through `_shared/`, which this client compiles.

- **AC-47's notice family is a phone obligation** — its **lifetime, reach and
  content**, not its detail-close trigger. It carries the value, names task and
  field, offers the retry, **does not self-dismiss**, and is **not cleared by
  leaving the surface**. `components.md § SaveNotice`'s lifetime rule 3 clears
  on *"leaving the surface — another collection, Settings, or Talk"*, and on the
  phone `PathSwitch` between Talk and Tasks is **one tap and is primary
  navigation**, so built to the catalogue as written a refused value is cleared
  by the next tap to Talk. That rule is routed for amendment; build to AC-47.
- **The mobile rename is a `TextInput` that unmounts on blur**, so there is no
  field for a refused or failed value to stay in (F-005 AC-2). The notice is the
  home the phone already has reserved (`tasks-save-notice`,
  `tasks-save-notice-dismiss`, recorded as designed-and-not-built).
- **The three shared write methods must read their result.** `toggleTask`,
  `editTask` and `removeTask` apply an optimistic change, `await`, and
  **discard** it — no read, no error branch, no refresh — and both call sites
  fire them as floating promises. The obligation is a **post-state**: after a
  write the server refuses, the row shows the value the server holds and the
  failure is stated — never a row that vanishes and returns at the next refresh.
- **Apply what a write returns**, including `changed` and `removed`. Without
  this a successor generated by a phone tick is never drawn, **no mutation of
  AC-39's repeat mark can turn the mobile case red**, and the AC is vacuously
  true on the platform it was created for.
- **The message-door predicate is *the task exists and is not deleted*** —
  `taskLinkState` (`mobile/model/task-link.ts`), per **F-001 AC-31 revision 7**.
  One rule, both clients; amending only the web predicate leaves the phone
  holding a collection filter the user cannot see (**L-005**).
- **The zone: report, do not compute.** `ControllerDeps.timezone` is this
  client's report; computations use `account.timezone` from `GET /account`,
  cached durably. **An offline create writes the answer rather than deferring
  it**: a task created offline while viewing Today is written locally as
  **all-day** and the replay carries `due_all_day: true`, so the row is never
  re-derived (ADR-010, F-005 AC-13/AC-14).
- **Two inline clocks on this client** — `components/TaskList.tsx`'s single
  render clock (which decides the Overdue/Today grouping) and
  `model/tasks-view.ts` — plus a defaulted one at `model/task-link.ts`. Route
  them through the existing `ControllerDeps.now` seam; do not add a second.
- **Three of AC-35's six readers are mobile files that do not go through
  `inCollection`.** In the account AC-35 names, they need **opposite** inputs:
  `model/tasks-view.ts` must return the **empty-collection** state (raw
  cardinality — `state.tasks.length > 0`), while `index.ts`'s `hasTasks` must be
  **false** (the **drawn rows**), so `a11y.ts` requires no `taskRow` /
  `taskCheckbox` ids. One rule over the three cannot hold.
- **Announcements go through `model/announce.ts`, which builds every string
  from a `Message` record.** AC-43's undo offer and AC-2's offline refusal are
  not `Message`s, so that path is **widened, not bypassed**. The existing
  `assistant-undo-button` is **not** reusable — it is emitted per conversation
  message and bound to the turn undo.
- **New ids are owed to `F-003`'s catalogue, which is closed and structurally
  asserted.** AC-9's and AC-39's mobile bounds are accessible-name assertions on
  the existing `taskRow` and need no new id; AC-42/AC-43's undo offer is an
  element that does not exist and does.
- **Tests:** `npx vitest run src/assistant/mobile` (unchanged). AC-38, AC-39,
  AC-42 and AC-43 have **no headless observable** and join `F-003 ## Verification
  status`'s device-lab debt list rather than starting a second one.
