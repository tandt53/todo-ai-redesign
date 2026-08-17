# F-001 voice-assistant-view — web test cases (index)

**Authored:** 2026-08-16 by qa-web-agent (T-007, phase: author) · **Executed:** 2026-08-16 by qa-web-agent (T-007e, phase: execute) · **Re-executed:** 2026-08-16 by qa-web-agent (T-016, phase: execute v2 — Vietnamese copy sync + WCAG 4.1.3) · **Spec:** `specs/assistant/F-001-voice-assistant-view.md` rev 3 · **Mockup:** `design/assistant/screens/voice-assistant-view.html` (22 testids, 17 states)
**Automation:** `qa/assistant/automation/e2e/F-001-voice-assistant-view.spec.ts` (36 tests) + `qa/assistant/automation/pages/AssistantPage.ts` — **36/36 PASS** (3 consecutive clean runs), run via `npm run test:e2e`
**Harness:** `qa/assistant/automation/harness/qa-test-server.ts` (QA-owned; real app + FakeClock + AI-call counter — see its header comment) + `npm run dev:web`, both auto-started by `playwright.config.ts`
**Fixtures:** `qa/_shared/fixtures/web/assistant-web-fixtures.json` (rewritten at execute time — canonical/QA_EXTRA utterance mapping) · **Namespace:** `qaweb-` (users `qaweb-tc{nn}@qa.example.com`)
**Run records:** `qa/assistant/runs/2026-08-16-web-execute.md` (first execute pass) · `qa/assistant/runs/2026-08-16-web-execute-v2.md` (T-016 copy sync + 4.1.3, mutation checks, drift notes, zero product bugs filed).

## Execution-phase note

The authoring-phase draft invented its own utterances/seed titles, assuming
the fixture-stub Interpreter would accept anything. The real
`FixtureInterpreter` matches only a static canonical table
(`src/assistant/api/ports/fixture-table.ts`); every test below was remapped
onto canonical rows plus three `QA_EXTRA_ROWS` the harness adds (the spec's
own sanctioned extension mechanism). The TC files below are otherwise
unchanged from authoring — their AC coverage, mockup-state coverage, and
pass/fail semantics all still hold; only the concrete utterance/seed data
each automated test drives changed. Each TC's `Automation` field now reads
`automated`. Full details: the run record linked above.

## Test cases (34, all P1, status active)

| TC | Title | ACs | Type |
|----|-------|-----|------|
| TC-001 | Applied turn — same-turn list update | AC-1, AC-4 | happy |
| TC-002 | Question turn applies nothing | AC-1, AC-9 | negative |
| TC-003 | Listening live transcript; empty → idle, no turn | AC-2, AC-29 | happy |
| TC-004 | Cancel while listening keeps words | AC-3 | edge |
| TC-005 | Cancel while thinking — late outcome renders | AC-3, AC-29 | edge |
| TC-006 | Attribution anatomy; internal refs never render | AC-4 | negative |
| TC-007 | Undo by tap — full-turn revert, read-back | AC-5, AC-7 | happy |
| TC-008 | Undo by voice — never becomes a task | AC-5, AC-8 | edge |
| TC-009 | Undo skips modified task, named | AC-7 | edge |
| TC-010 | Nothing reverted — never dressed as success | AC-7 | negative |
| TC-011 | Undo window ends visibly; stale refusal visible | AC-8, AC-28 | boundary |
| TC-012 | Bulk delete asks (2) vs single applies (1) | AC-9, AC-4 | boundary |
| TC-013 | Affirmative executes (full anatomy); negative declines | AC-10, AC-11, AC-5 | happy |
| TC-014 | Supersede declines visibly, command proceeds | AC-10, AC-11, AC-13 | edge |
| TC-015 | Unclassifiable stays pending; zero deletion | AC-10 | negative |
| TC-016 | Already-resolved never executes | AC-10, AC-11 | negative |
| TC-017 | Clarify — real candidates; tap sends literal text | AC-13, AC-1 | happy |
| TC-018 | No-match quotes transcript verbatim; bounded no-mutation | AC-14 | negative |
| TC-019 | Typed parity — same path and shape | AC-17 | happy |
| TC-020 | Manual path — zero AI calls (counter-proven) | AC-18 | happy |
| TC-021 | WCAG 2.1.1 keyboard operability | AC-19 | accessibility |
| TC-022 | WCAG 4.1.2 name/role/value | AC-19 | accessibility |
| TC-023 | WCAG 1.4.3 contrast (both themes) | AC-19 | accessibility |
| TC-024 | WCAG 2.5.3 label-in-name | AC-19 | accessibility |
| TC-025 | No capability — mic hidden, no error; text-only payload | AC-20 | edge |
| TC-026 | Permission denied — dimmed, re-grant path, typing intact | AC-21 | negative |
| TC-027 | Transient failure — dimmed, distinguishable, recovers | AC-22 | negative |
| TC-028 | AI error — retry same id, words kept, list usable | AC-24, AC-29 | negative |
| TC-029 | Offline — handover, local no-AI path, visible replay | AC-25 | edge |
| TC-030 | Clean start — exactly one boundary message | AC-28 | edge |
| TC-031 | Four states only — bounded transition sweep | AC-29, AC-2 | edge |
| TC-032 | Rapid actions execute once only | AC-5, AC-10, AC-16 | edge |
| TC-033 | WCAG 4.1.3 status messages via live region | AC-19 | accessibility |
| TC-034 | WCAG 4.1.3 error announced immediately, once | AC-19 | accessibility |

## AC → TC coverage map (all 22 web-tagged ACs; every AC has ≥ 1 P1 TC)

| AC | Covered by |
|----|-----------|
| AC-1 | TC-001, TC-002, TC-017 |
| AC-2 | TC-003, TC-031 |
| AC-3 | TC-004, TC-005 |
| AC-4 | TC-001, TC-006, TC-012 |
| AC-5 | TC-007, TC-008, TC-013, TC-032 |
| AC-7 | TC-007, TC-009, TC-010 |
| AC-8 | TC-008, TC-011 |
| AC-9 | TC-002, TC-012 |
| AC-10 | TC-013, TC-014, TC-015, TC-016, TC-032 |
| AC-11 | TC-013, TC-014, TC-016 |
| AC-13 | TC-014, TC-017 |
| AC-14 | TC-018 |
| AC-17 | TC-019 |
| AC-18 | TC-020 |
| AC-19 | TC-021, TC-022, TC-023, TC-024, TC-033, TC-034 |
| AC-20 | TC-025 |
| AC-21 | TC-026 |
| AC-22 | TC-027 |
| AC-24 | TC-028 |
| AC-25 | TC-029 |
| AC-28 | TC-030, TC-011 |
| AC-29 | TC-031, TC-003, TC-005, TC-028 |

Not web-tagged (owned by other platforms, no web TC by design): AC-6, AC-12, AC-15, AC-16*, AC-23 (api); AC-26, AC-27 (mobile).
*AC-16 is api-tagged; TC-028/TC-032 assert its web-visible face (same `client_turn_id` on retry/duplicate) without claiming AC-16 coverage.

## Mockup state → TC coverage map (all 17 states)

| State | Covered by |
|-------|-----------|
| idle-empty | TC-031 (first-run invitation + empty list) |
| idle-tasks | TC-001 (resting surface), TC-020 |
| listening | TC-003, TC-004 |
| thinking | TC-001, TC-005, TC-031 |
| applied-diff | TC-001, TC-006, TC-007 |
| question-confirm | TC-002, TC-012, TC-013 |
| question-clarify | TC-017, TC-014 |
| declined-superseded | TC-014 |
| reverted | TC-007, TC-009 |
| nothing-reverted | TC-010, TC-008 (local nothing-to-undo exchange) |
| no-match | TC-018 |
| error | TC-028, TC-031 |
| offline | TC-029 |
| boundary | TC-030 |
| mic-permission | TC-026 |
| mic-transient | TC-027 |
| mic-hidden | TC-025 |

## Named WCAG criteria (AC-19)

2.1.1 → TC-021 · 4.1.2 → TC-022 · 1.4.3 → TC-023 · 2.5.3 → TC-024 · **4.1.3 → TC-033, TC-034**

All five criteria AC-19 names by name now have automated coverage. 4.1.3 was the gap this task closed: the surface gained `role="log"` + `aria-live="polite"` on the conversation and `role="alert"` on errors (web-agent, T-015c), and TC-033/TC-034 verify containment, content, politeness and focus-stability rather than the mere presence of the attributes. AC-19's "verified against a real screen reader" clause is **not** satisfied by automation alone — a manual AT pass stays open (run record v2).

## Copy language

The product ships **Vietnamese**. Per F-001 ## Conversation model ("Naming convention"), the spec's English words are concept names, and user-visible wording is owned by `design/_shared/components.md`. Every quoted string in these TC files and in the automation is therefore traceable to the design system or the mockup — task titles ("Buy milk") are fixture data, not copy, and stay as they are.

## Selector-contract requests — RESOLVED (design-agent, 2026-08-16)

All three authoring-round requests landed in the mockups (catalogue now 22 ids): `assistant-message-bubble` (exemplar-once on assistant message containers), `assistant-diff-old` / `assistant-diff-new`, `assistant-row-badge`, and `assistant-cancel-button` (the AC-3 thinking-state cancel pill; listening-cancel stays the mic tap). The POM and spec use them; `getByText` remains only where the copy itself is the assertion (e.g. TC-018's verbatim transcript echo).
