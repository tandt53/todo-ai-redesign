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
