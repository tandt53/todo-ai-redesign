# F-001 voice-assistant-view — web test cases (index)

**Authored:** 2026-08-16 by qa-web-agent (T-007, phase: author) · **Executed:** 2026-08-16 by qa-web-agent (T-007e, phase: execute) · **Re-executed:** 2026-08-16 by qa-web-agent (T-016, phase: execute v2 — Vietnamese copy sync + WCAG 4.1.3) · **Re-executed:** 2026-08-17 by qa-web-agent (T-070b, phase: execute v3 — ADR-008 English copy sync) · **Spec:** `docs/specs/assistant/F-001-voice-assistant-view.md` rev 3 · **Mockup:** `docs/design/assistant/screens/voice-assistant-view.html` (22 testids, 17 states)
**Automation:** `tests/assistant/e2e/F-001-voice-assistant-view.spec.ts` (50 tests) + `tests/assistant/pages/AssistantPage.ts` — **49/50 PASS**, run via `npm run test:e2e`. The one failure is **TC-047 / BUG-006**, a product defect in AC-30(h); the 36 pre-AC-30 tests are all green.
**Harness:** `tests/harness/qa-test-server.ts` (QA-owned; real app + FakeClock + AI-call counter — see its header comment) + `npm run dev:web`, both auto-started by `playwright.config.ts`
**Fixtures:** `docs/qa/_shared/fixtures/web/assistant-web-fixtures.json` (rewritten at execute time — canonical/QA_EXTRA utterance mapping) · **Namespace:** `qaweb-` (users `qaweb-tc{nn}@qa.example.com`)
**AC-30 added:** 2026-08-17 by qa-web-agent (T-085, author + execute — TC-035..TC-048)
**Run records:** `docs/qa/assistant/runs/2026-08-17-web-ac30.md` (AC-30 — tier split, BUG-006, four script bugs, falsifiability checks, T-079 handling) · `docs/qa/assistant/runs/2026-08-16-web-execute.md` (first execute pass) · `docs/qa/assistant/runs/2026-08-16-web-execute-v2.md` (T-016 copy sync + 4.1.3, mutation checks, drift notes, zero product bugs filed) · `docs/qa/assistant/runs/2026-08-17-web-execute-v3.md` (T-070b English copy sync — before/after numbers, the stale-harness contamination finding, and the green-but-impossible fixtures found outside this scope).

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

## Test cases (48, all P1, status active)

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
| TC-035 | At-bottom within the 48-unit slack — arrival brought on screen | AC-30 | boundary |
| TC-036 | Outside the slack — the view holds, affordance appears | AC-30 | boundary |
| TC-037 | Reading history — arrival lands below the fold, nothing moves | AC-30 | happy |
| TC-038 | The affordance overlays; it never reflows the read message | AC-30 | regression |
| TC-039 | N arrivals, exactly one affordance, no re-mount | AC-30 | boundary |
| TC-040 | "Waiting on you" is distinguishable from "something arrived" | AC-30 | happy |
| TC-041 | At 375px the question stays legible on a second line | AC-30 | accessibility |
| TC-042 | Activating it goes to the bottom and dismisses it (keyboard) | AC-30, AC-19 | happy |
| TC-043 | Reaching the bottom by hand dismisses it identically | AC-30 | happy |
| TC-044 | Reduce-motion: clause (b)'s follow, no animation | AC-30, AC-19 | accessibility |
| TC-045 | Reduce-motion: clause (f)'s activation, no animation | AC-30, AC-19 | accessibility |
| TC-046 | Reduce-motion: clause (h)'s submit, no animation | AC-30, AC-19 | accessibility |
| TC-047 | Own send scrolls to the bottom, clears the affordance — **FAILING, BUG-006** | AC-30 | happy |
| TC-048 | A submit that appends nothing scrolls nothing | AC-30, AC-3 | negative |

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

## AC-30 — following new messages (added 2026-08-17, T-085)

AC-30 arrived after Gate 1, from the owner decision resolving BUG-004
(`reports/owner-decision-2026-08-17-new-message-affordance.md`), and it is the
one AC in this feature whose subject is the **scroll viewport** rather than
model state or rendered output. That matters for where its coverage can live.

**Why none of the existing 34 cases could have caught BUG-004.** Every
assertion in this suite before T-085 asked whether a message was PRESENT. A
message rendered 176px below the fold satisfies `toHaveCount(1)`, satisfies a
text filter, and satisfies `toBeVisible()` — Playwright's visibility means
rendered and unhidden, not inside the scrolled viewport. So TC-035..TC-048
compare **rectangles**, and compute clause (a)'s `distance_from_bottom` off the
live layout rather than approximating it with a visibility check.

**Tier split, stated so the duplication is deliberate rather than accidental.**
web-agent's unit tier can falsify the arithmetic of (a), the sample ordering,
`scroll_offset` for (c), the node count for (d), the label/accent/accessible
name for (e), both dismissal paths in (f), the three scroll paths in (g) and
(h)'s anchor. Only a browser can falsify: that a message is actually **on
screen** (TC-035/036/037/042/043/047), that the pill **overlays rather than
reflows** the pane (TC-038), that the two-line clamp keeps the question legible
at 375px with real text shaping (TC-041), and that an animated scroll **lands
where it claims** (TC-044/045/046, and BUG-006). Those nine cases are the ones
that only exist at this tier; the rest re-check unit-covered properties against
real layout and real arrivals, which is cheap here and is how TC-039 found its
setup was measuring the wrong scenario.

**Clause coverage.** (a) TC-035, TC-036 · (b) TC-035, TC-044 · (c) TC-036,
TC-037, TC-038 · (d) TC-039 · (e) TC-040, TC-041 · (f) TC-042, TC-043, TC-045 ·
(g) TC-044, TC-045, TC-046 · (h) TC-046, TC-047, TC-048. Every clause has at
least one case that can execute; none is covered only by inspection.

**One clause is covered only indirectly, and this is the place to say so.**
Clause (a)'s "sampled immediately **before** the append" is not directly
observable from the browser — the sample is internal. TC-035 falsifies the
wrong ordering by its consequence: a post-append sample reports every user as
not-at-bottom, so an arrival at `distance_from_bottom = 40` would show an
affordance and stay off screen, which TC-035 fails on. The direct assertion on
the ordering belongs to the unit tier and stays there.

**Design copy is parsed, not retyped.** TC-040 and TC-041 read the NMA-NEW /
NMA-WAITING labels, the accessible-name literals and the `question` accent from
`docs/design/_shared/components.md` and `docs/design/_shared/tokens.json` at run time
(L-008), so they fail when the **upstream** artifact moves — the direction drift
travels. The parser raises rather than matching nothing (L-007).

## Mockup state → TC coverage map (all 19 states)

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
| nma-new | TC-035, TC-036, TC-037, TC-038, TC-039, TC-040, TC-042, TC-043 |
| nma-waiting | TC-040, TC-041 |

## Named WCAG criteria (AC-19)

2.1.1 → TC-021 · 4.1.2 → TC-022 · 1.4.3 → TC-023 · 2.5.3 → TC-024 · **4.1.3 → TC-033, TC-034**

All five criteria AC-19 names by name now have automated coverage. 4.1.3 was the gap this task closed: the surface gained `role="log"` + `aria-live="polite"` on the conversation and `role="alert"` on errors (web-agent, T-015c), and TC-033/TC-034 verify containment, content, politeness and focus-stability rather than the mere presence of the attributes. AC-19's "verified against a real screen reader" clause is **not** satisfied by automation alone — a manual AT pass stays open (run record v2).

## Copy language

The product ships **English** (ADR-008 / `reports/owner-decision-2026-08-17-english-first.md`, superseding the 2026-08-16 decision that put the copy into Vietnamese). Per F-001 ## Conversation model ("Naming convention"), the spec's English words are concept names, and user-visible wording is owned by `docs/design/_shared/components.md`. Every quoted string in these TC files and in the automation is therefore traceable to the design system or the mockup — task titles ("Buy milk") are fixture data, not copy, and stay as they are.

**One consequence worth naming, because it is not a copy change.** ADR-008 also retired the Vietnamese voice-undo phrase `hoàn tác`: AC-5's undo vocabulary is now `undo` alone (`UNDO_PHRASES`, `src/assistant/api/engine/normalize.ts:9`). That phrase was recognizer INPUT, not shipped copy, so it is a behaviour change rather than a translation. TC-008 kept its case and its guarantee — an undo phrase never becomes a task, never reaches the model, and refuses visibly when out of window — and now exercises it over a one-member vocabulary; see that file's Vocabulary note. The api tier owns the complementary negative (`tests/assistant/api/…:781`, "the retired phrase is an ordinary turn: interpreted, no_match, reverts nothing"), so the web tier does not duplicate it.

**Where the catalogue does not reach.** Three strings asserted by the automation have no published home in `docs/design/_shared/components.md` or the mockups and were taken from the implementation, per this task's rule that the implementation wins unless it contradicts the catalogue: the already-resolved outcome head ("That question was already answered"), the transient-mode mic accessible name ("Microphone is temporarily unavailable"), and the manual add-task form's field/button ("New task name" / "Save"). Reported to design as catalogue gaps rather than absorbed silently.

## Selector-contract requests — RESOLVED (design-agent, 2026-08-16)

All three authoring-round requests landed in the mockups (catalogue now 22 ids): `assistant-message-bubble` (exemplar-once on assistant message containers), `assistant-diff-old` / `assistant-diff-new`, `assistant-row-badge`, and `assistant-cancel-button` (the AC-3 thinking-state cancel pill; listening-cancel stays the mic tap). The POM and spec use them; `getByText` remains only where the copy itself is the assertion (e.g. TC-018's verbatim transcript echo).
