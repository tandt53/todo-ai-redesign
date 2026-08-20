# Run record: F-001 web e2e suite — phase: execute

| Field | Value |
|---|---|
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Agent | qa-web-agent |
| Phase | execute (T-007e, dispatched by orchestrator after Gate 2 found the authored suite had never actually run — `@playwright/test` wasn't installed, no `playwright.config.ts`) |
| Date | 2026-08-16 |
| Suite | `tests/assistant/e2e/F-001-voice-assistant-view.spec.ts` (34 tests covering the 32 authored TCs — TC-013/TC-014 split into lettered sub-cases) |
| Command | `npm run test:e2e` (`playwright test`) |
| Result | **34 / 34 PASS**, stable across 6 consecutive full-suite runs (plus 3 additional isolated re-runs of the two tests that needed script fixes, and 3 more isolated re-runs of TC-029 after its network-simulation rewrite — 9 total clean runs of the previously-flaky tests) |
| Project gate | `npm run test:all` (vitest) → 213/213 PASS, 10/10 files — unaffected by this suite (see "Harness setup" for why) |

## Harness setup (this dispatch's scope, per the orchestrator's briefing)

The orchestrator's dispatch included standing up the harness, since
`docs/specs/_shared/platform/web.md ## Test Harness` delegates "e2e (Playwright) is
QA-owned" to this agent, not architect or web-agent.

1. **`npm install -D @playwright/test`** — already present in `package.json`
   from an earlier partial setup; installed clean. `npx playwright install
   chromium --dry-run` showed chromium 1234 already cached
   (`~/Library/Caches/ms-playwright/chromium-1234`); verified it actually
   launches headless (`chromium.launch()` → loaded a data: URL, read its
   text). No browser download was needed in this sandbox.
2. **`playwright.config.ts`** (root) — `webServer` array starts two
   processes so the orchestrator never manages background processes:
   - The assistant API, via **`tests/harness/qa-test-server.ts`**
     — a new QA-owned harness, **not** the plain `npm run dev:assistant`
     entrypoint. Rationale (documented in the file's header comment): the
     plain entrypoint (`src/assistant/api/server.ts`) hardcodes `systemClock`
     and the static canonical `FIXTURE_TABLE`, exposing neither an AI-call
     counter nor an injectable idle-close timer over HTTP — both named as
     required seams in the spec's `## Test strategy`. The harness reuses the
     real `createApp(deps)` composition root (the same public,
     dependency-injected factory `src/assistant/api/__tests__/helpers.ts`
     uses for the unit suite) with a `FakeClock` and a counting `Interpreter`
     wrapper, plus two control endpoints: `GET /__qa__/ai-calls` and
     `POST /__qa__/advance-clock`. It also appends `QA_EXTRA_ROWS` to the
     canonical fixture table — the spec's own sanctioned extension mechanism
     ("QA may extend it with their own rows via the FixtureInterpreter
     constructor"). No file under `src/` was modified.
   - The web app via `npm run dev:web` (Vite dev server) rather than a
     build+preview step, for one less stale-build variable in this first
     execute pass; its proxy already targets `:4460`, the harness's port.
   - `workers: 1` (deliberate): the harness's AI-call counter and FakeClock
     are process-global, not per-account, so parallel workers could cross
     contaminate those two specific signals. Test *data* isolation is still
     per-account (`qaweb-tc*@qa.example.com`, `_qa-foundations.md` §10).
3. **`vitest.config.ts`** (root, new) — `test.exclude` covers
   `docs/qa/**/automation/e2e/**` and `docs/qa/**/automation/harness/**`. Root cause:
   vitest's default include (`**/*.{test,spec}.*`) can't distinguish a
   Playwright spec from a vitest spec by filename — both use `*.spec.ts`.
   Before this file existed, `vitest run` parsed the Playwright file, ran
   zero of its tests (Playwright's `test()` isn't vitest's), and Gate 2 read
   that as red.
4. **`package.json`** — added `test:e2e` (`playwright test`) and
   `test:e2e:harness` (manual harness start, for debugging).
5. **Speech seam** — already built by web-agent as `window.__assistantSeams`
   behind a `?qaUser=`/`testMode` guard (`src/assistant/web/seams.ts`); no
   setup needed beyond loading the page with `?qaUser=`, which
   `AssistantPage.open()` does. `tests/assistant/pages/AssistantPage.ts`
   `bindSeams()` was rewritten from its authoring-phase placeholder (which
   threw) to a real binding against that global plus the harness's two
   `/__qa__/*` endpoints.

## The authoring-phase premise that didn't survive contact with the real app

The authored suite (T-007, phase: author) invented its own utterances (e.g.
`"push the qaweb budget review to 4pm and add qaweb pick up the birthday cake
on Saturday"`) and its own seed titles, assuming the fixture-stub Interpreter
would accept anything. In reality `FixtureInterpreter`
(`src/assistant/api/ports/fixture-interpreter.ts`) matches only against the
static canonical table (`ports/fixture-table.ts`); anything else interprets
as `no_match`. Every test was remapped onto canonical rows (`"add a task to
buy milk"`, `"plan the week"`, `"mark the shopping done"`, `"delete the
shopping tasks"`, `"delete the meeting"`, `"delete the report task"`,
`"fail once then add wine"`, the undo tripwires, the answer-classification
rows) plus three `QA_EXTRA_ROWS` for shapes the canonical table doesn't
enumerate (documented in `qa-test-server.ts`):

- an exact 2-task delete (`"delete the qaweb pair"`) — the canonical table
  has 1-target and 3-target delete rows but no exact 2-target row, needed for
  AC-9's `>1`-vs-`1` boundary at its tightest edge;
- two delayed rows (`"qaweb delayed bulk delete"`, `"qaweb delayed
  failure"`, both 150ms) — the canonical table's only delay row is a create,
  and AC-3's cancel-while-thinking race needs a delayed question outcome and
  a delayed failed outcome too.

**Also discovered:** a single interpretation can only be ONE kind
(create/edit/delete/clarify/query/answer — `Interpretation` in
`ports/interpreter.ts`), so the authored TC-001 premise (one turn produces
both an edit and a create) is impossible against the real contract. TC-001
now proves the same claim — atomic same-turn multi-row visibility — with
`"plan the week"` (one turn, four created rows).

Full utterance→scenario mapping: `docs/qa/_shared/fixtures/web/assistant-web-fixtures.json`.
This mirrors what **qa-api-agent's own execute-phase run found independently**
(`docs/qa/assistant/runs/2026-08-16-api-execute.md`): the authored api suite had
guessed at a title-keyed interpreter port instead of the real handle-based
one. Two independent authoring-phase drafts made the same category of
mistake (assuming instead of observing the real interpretation contract) —
worth a LEARNINGS entry (see below).

## Script bugs found and fixed during this pass (not product bugs)

Per `_qa-foundations.md` §8, each classified before touching anything.

1. **TC-001 flaky `expectThinking()`.** `"plan the week"` is a zero-delay
   canonical row against a real in-process server; the thinking flash could
   resolve inside a single Playwright poll interval and never be observed.
   Fix: dropped the assertion for this zero-delay scenario (the thinking
   transition itself is covered by delayed rows in TC-005/TC-031).
2. **`AssistantPage.renameTaskByTitle` stale locator.** `TaskRow.tsx` swaps
   the row's title text for an `<input>` in edit mode, so a `hasText`-filtered
   row locator re-evaluated *after* clicking Edit matched zero rows (the text
   it filters on is gone) — every rename hung until the 30s test timeout.
   Fix: locate the edit `<textbox>` by its accessible name (`Edit
   "${oldTitle}"`, which the input shares with the button that opened it and
   which doesn't change until Enter/blur) instead of re-filtering the row.
   Hit in TC-006 and TC-020.
3. **TC-030 turn/foreground timing tie.** The harness's `FakeClock` only
   moves when explicitly advanced — unlike a real wall clock, a session's
   *first* turn (which also creates the session, `engine/sessions.ts
   openSession`) resolves at the exact same instant as
   `session.last_foreground_at` (both stamped from the same frozen `at`
   inside one `store.transact`), and the boundary's late-outcome filter is a
   strict `>` (`engine/sessions.ts closeSession`). A real server never hits
   this tie (real clocks always tick between two requests). Fix: send a
   throwaway first turn to create the session, `advanceClockMs(2000)`, *then*
   send the turn actually asserted as a late outcome. (Also reordered the
   pending-question turn to be *last*: turns.ts auto-binds any subsequent
   turn to the newest unresolved question and supersedes it (AC-10's own
   rule), so a question can only survive to be declined-by-close if nothing
   follows it — the original ordering accidentally superseded its own
   question via the next turn, which is the product working correctly, not a
   bug.)
4. **TC-029's original in-flight-queue technique didn't reproduce the
   condition at all.** `context.setOffline(true)` does not abort a request
   already dispatched to this same-origin/loopback dev server in this
   environment — verified with a network trace: `POST /assistant/turn`
   returned 200 well after `setOffline(true)`, regardless of added
   server-side delay (tried 150ms and 1000ms). This meant the
   queued-notice assertion either silently skipped (in a best-effort form) or
   never fired at all (in a strict form) — a false-green risk per
   `_qa-foundations.md` §3.9 ("could this pass for the wrong reason?"). Fixed
   by using `page.route('**/assistant/turn', route => route.abort(...))` for
   a deterministic one-shot network failure, which is also a more precise
   technique for this exact scenario than network emulation. Verified 3×
   isolated + present in every full-suite run since (9 clean runs total).

## Evidence of real assertions (false-green defenses actually exercised)

- **AC-4 no-fabrication**: TC-006 asserts the created row carries no
  `assistant-diff-old` chip and the edited row's `assistant-diff-old`/`-new`
  chips hold the real old/new title text, not just "a chip exists".
- **AC-4 attribution scope**: TC-006 hand-renames an unrelated seeded task
  first and asserts it carries no `Edited` badge from the AI turn.
- **AC-9/AC-12 boundary**: TC-012 proves the exact edge (2 asks, 1 applies)
  using a QA_EXTRA row, not just "some N asks, some other N applies".
- **AC-10 one-shot**: TC-016 replays the literal turn a stale tap would have
  sent via `page.request` directly (bypassing the UI's own disabled-chip
  guard) to prove server-side enforcement, not just that the UI hides the
  button.
- **AC-14 honesty**: TC-018 asserts the *exact* heard-transcript string
  appears quoted, not just "some reply rendered".
- **AC-18 zero AI calls**: TC-020 asserts both a harness-side cumulative
  counter delta of exactly 0 *and* zero observed `/assistant/*` requests —
  two independent proofs of the same negative claim.
- **AC-16/AC-5/AC-10 once-only**: TC-032 double-clicks send/undo/affirm and
  asserts exactly one row/state-change resulted, not merely "no crash".

## Product bugs filed

None. Zero real defects found against the running app in this pass — every
red result during triage was traced to the test's own setup or technique
(see "Script bugs" above), confirmed by re-reading the relevant AC and the
real component/engine source before concluding so (triage protocol,
`_qa-foundations.md` §8).

## Known limitation (disclosed, not silently absorbed)

**AC-8's "stale affordance" refusal path (409 `not_newest`) is structurally
unreachable from the web UI.** The Undo button only ever renders for the
*current* newest mutating turn (`model/reducer.ts undoableTurnId` — the
component never keeps a reference to an older turn's button once a newer one
supersedes it), so a race where the user clicks a stale Undo affordance
cannot be driven through real UI interaction; it would require bypassing the
UI with a raw API call, which stops being a web e2e test of that path. This
is arguably good design (the race is impossible by construction) rather than
a gap — but AC-8's refusal-message text for that specific reason is unverified
at the web e2e layer. Suggest: the api suite (`tests/assistant/api/`)
is the correct owner for exercising the raw 409 `not_newest` response shape.

## Follow-up suggestions

- Add an exact 2-target delete row to the canonical fixture table
  (`src/assistant/api/ports/fixture-table.ts`) so AC-9's tightest boundary
  doesn't need a QA_EXTRA_ROWS workaround.
- If AC-28's *idle-specific* (as opposed to explicit-close) auto-close ever
  needs coverage independent of the injectable-clock seam, no further work is
  needed — `qa-test-server.ts`'s `/__qa__/advance-clock` already exercises the
  real `lazyIdleClose` path with `close_reason: "idle"` (confirmed in TC-011,
  TC-030 — both assert `"Session ended — idle"` / real idle-close behavior,
  not a stand-in).

## Memory entry

```markdown
---
## 2026-08-16 | qa-web-agent | T-007e
Type: pattern
Tags: [qa-execute-phase, fixture-stub, playwright, F-001]
Summary: Two independent QA agents (api and web) authored suites against an
imagined shape of the fixture-stub Interpreter, then both discovered at
execute time that it's a STATIC canonical table with a fixed, small
utterance set (not a permissive stub) — same root cause, same fix pattern
(map onto canonical rows + a documented, spec-sanctioned QA_EXTRA_ROWS
extension), found independently on the same day.
Lesson: when a spec's Test strategy says "the stub replaces model
interpretation" (or similar), the authoring phase should read the actual
stub's matching rule (exact-match table vs. permissive regex vs. LLM-backed)
before designing test data — not just note that a stub exists. This is a
candidate LEARNINGS.md entry the orchestrator should consider adding
(spec-wide, not agent-specific): "phase: author QA dispatches for a
fixture-stubbed AI/interpreter layer should read the stub's actual matching
implementation, not just its existence, before writing test utterances."
---
```
