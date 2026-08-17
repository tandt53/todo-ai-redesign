# Task Queue
<!-- Orchestrator writes and archives. Sub-agents read the task assigned to them. -->
<!-- Hard limit: 300 lines. Orchestrator auto-archives when exceeded (see below). -->

## Format

One table. Status is a **column**, not a section — a task never moves between
tables, only its `Status` cell changes. Moving rows between sections drops
columns and duplicates tasks; changing one cell cannot fail that way.

```
| ID | Title | Module | Feature | Agent | Pri | Depends | Status | Artifacts | Outcome |
```

- **Module** — business domain this task targets (e.g. `auth`, `payments`, `_shared`). Orchestrator assigns at dispatch.
- **Feature** — feature ID this task belongs to (e.g. `F-003`) or `—` for cross-cutting tasks.
- **Pri** — `P0` … `P3`. Drives selection order.
- **Depends** — comma-separated task IDs that must be `DONE` before this task is selectable; `—` if none.
- **Status** — `PENDING` · `IN_PROGRESS` · `PARTIAL` · `BLOCKED` · `DONE` · `CANCELLED`
- **Artifacts** — real paths the task produced, resolvable through `MANIFEST ## Paths`. `—` until the task has produced something.
- **Outcome** — exactly one line, including a measurement (`5/7 AC`, `12 tests pass`, `exit 0`). `—` while pending.

Task statuses and agent-return statuses are different vocabularies that overlap.
An agent returns `DONE | PARTIAL | BLOCKED` (plus `APPROVE | REJECT` for gate
agents) in its `---METRICS---` block; the orchestrator maps that onto the
`Status` column here. `PENDING`, `IN_PROGRESS` and `CANCELLED` are queue states
that no agent ever returns.

The orchestrator is the sole dispatcher. Sub-agents do not claim tasks themselves — they receive a briefing via `BRIEFING.md` and act on it.

### Status is derived, not declared

The orchestrator sets `Status` from the evidence in the agent's return, not from
the agent's own wording:

| `files_created` + `files_modified` | Coverage of in-scope ACs | → `Status` |
|---|---|---|
| empty | — | `BLOCKED` |
| non-empty | below 100% | `PARTIAL` |
| non-empty | 100% | `DONE` |

An agent that reports `status: DONE` while listing no files has not completed a
task — it has produced an analysis. Record it as `BLOCKED` with the blocker
named. The full rule, including the confidence interaction, is in
`agents/_completion-protocol.md ## Status is derived from evidence`.

`Artifacts` is what makes this checkable: every `DONE` or `PARTIAL` row must name
at least one path, and every path named must exist on disk.

## Selection order

`"next"` picks the head of this ordering — see `.claude/ORCHESTRATION.md` Step 2
for the executable version:

```
candidates = rows where Status == PENDING and every ID in Depends is DONE
sort candidates by (Pri asc, row order asc)
pick head
```

`Depends` is mandatory for any task whose input is produced by another task.
Without it the queue can hand an agent a task whose input does not exist yet, and
an agent facing a missing input tends to invent one rather than return `BLOCKED`.

## Archival (automatic)

The orchestrator runs this check at the start of every session:
- If TASKS.md total line count > 300, **or** rows with `Status` = `DONE` exceed 50:
  1. Read `TASKS-archive.md` (create if missing)
  2. Move `DONE` rows older than 14 days (or all of them if ages unclear) into `TASKS-archive.md`, grouped by ISO week
  3. Leave a single line here: `<!-- N tasks archived — see TASKS-archive.md -->`

## QA phase: two dispatches per platform

Each platform QA agent (qa-api-agent, qa-web-agent, qa-mobile-agent) is dispatched **twice per feature**:

1. **Authoring phase** (`phase: author` in BRIEFING.md) — runs in parallel with the matching implementer. Writes markdown test cases in `{qa}/{module}/F-{id}/{platform}/`, drafts automation scripts. No test harness needed.
2. **Execution phase** (`phase: execute` in BRIEFING.md) — runs **in parallel** after all implementers return and the orchestrator brings up the test harness. All three QA agents execute simultaneously with namespaced test data (see `_qa-foundations.md` section 10). Runs tests, triages failures, files bugs with layer attribution.

A single feature with api + web + mobile therefore generates **6 QA tasks** (3 authoring + 3 execution) in addition to implementer tasks. The orchestrator creates them automatically; spec-agent and architect-agent do not.

The execution task depends on its authoring task — record that in `Depends`, so
the queue cannot dispatch execution before the test cases exist.

## Merge gate (hard rule, enforced by orchestrator)

A task that completes a feature cannot be set to `Status` = `DONE` until **all** of:
1. At least one P1 test case exists in `{qa}/{module}/F-{id}/{platform}/` for every (AC, platform) pair declared in the feature spec's AC platform tags
2. Reviewer-agent C2 (per-platform AC coverage) passes
3. Reviewer-agent C3 (API contract consistency, uses qa-api-agent's tests as evidence) passes
4. Test suite runs clean (reviewer-agent C5)
5. No open bugs in the feature spec's `## Links.known_bugs` (non-empty is a WARNING, not an auto-fail, but it surfaces to the human reviewer)

If any gate fails, the task stays `IN_PROGRESS` and a follow-up task is dispatched: bug fixes go to the implementer named in the bug's `layer:` field; coverage gaps go to the matching platform QA agent.

---

## Tasks

| ID | Title | Module | Feature | Agent | Pri | Depends | Status | Artifacts | Outcome |
|----|-------|--------|---------|-------|-----|---------|--------|-----------|---------|
| T-018 | Spec F-003 mobile surface (carries AC-26/27) | assistant | F-003 | spec-agent | P1 | — | DONE | specs/assistant/F-003-mobile-surface.md, specs/assistant/index.md | 137 lines, 12 ACs; parity table classifies all 29 F-001 ACs (21 as-is + 6 clause-added + 2 moved); ios/android split explicit; spec-check exit 0 |
| T-019 | Mobile implementation (React Native) | assistant | F-003 | mobile-agent | P2 | T-018 | DONE | src/assistant/mobile/, src/assistant/_shared/ | shared extraction (mobile controller EXTENDS shared, no 2nd reducer); 92 mobile tests; web 98/98 + api 73/73 + e2e 36/36 unbroken; found BUG-001 |
| T-025 | Invert QA KNOWN-OPEN pin now that BUG-001 is fixed | assistant | F-003 | qa-mobile-agent | P1 | — | DONE | qa/assistant/automation/mobile/F-003-mobile-surface.spec.ts, qa/assistant/F-003/mobile/TC-040-foreground-is-a-reconnect-for-offline-creates.md, qa/assistant/F-003/mobile/index.md, qa/assistant/runs/2026-08-17-mobile-execute.md | pin -> 5 contract-derived assertions; added TC-040 after finding every reconnect assertion passed regardless of onForeground; 111/111, 3 mutation checks |
| T-027 | Fix C9 (client.permission_state in data-model) + add announce port to platform doc | assistant | F-003 | architect-agent | P1 | T-022 | DONE | specs/assistant/data-model.md, specs/_shared/platform/mobile.md | permission_state row w/ both platform asymmetries; Announcer port + build-dont-author convention; routed 2 follow-ups |
| T-028 | ADR: accept the metro/image-size advisory with review conditions (C7, owner decision) | assistant | F-003 | architect-agent | P1 | T-022 | DONE | specs/_shared/adr/ADR-007-accept-metro-image-size-advisory.md | 66 lines (6 over house limit, accepted by orchestrator rather than dropping a required pin); found the only offered fix is a DOWNGRADE to RN 0.72.17; C7 conditional pass bounded to the exact current audit shape |
| T-029 | Fix F-003 Data lead sentence (3rd client row is new, not pre-existing) | assistant | F-003 | spec-agent | P2 | T-027 | DONE | specs/assistant/F-003-mobile-surface.md | lead sentence corrected; agent verified data-model.md:133 really carries the row before asserting it; spec-check exit 0 |
| T-030 | Move the 7 permission-copy strings into components.md | assistant | F-003 | design-agent | P2 | T-027 | DONE | design/_shared/components.md, design/assistant/screens/voice-assistant-view-ios.html, design/assistant/screens/voice-assistant-view-android.html | 7-row catalogue + 1 adjacent AC-4 string; found 2 real mockup drifts incl. an iOS message that violated AC-2 by not naming which permission; design-check 18/0 held |
| T-031 | Re-point permissions.ts to cite components.md | assistant | F-003 | mobile-agent | P2 | T-030 | DONE | src/assistant/mobile/model/permissions.ts, src/assistant/mobile/__tests__/permissions.test.ts | CATALOGUE keyed by design row IDs, template removed; tests PARSE components.md so a hand-copy cannot pass; 448/448, mutation-proved both ways; found an 8th unenumerated iOS tuple |
| T-033 | Decide + publish the 8th iOS permission row (mic denied + speech never asked) | assistant | F-003 | design-agent | P1 | T-031 | DONE | design/_shared/components.md | IOS-MIC-UNASKED published; ruled row-not-spec-clause (forcing both dialogs would spend iOS last prompt on an inert grant); CTA=Settings, AND-DENIED keeps its exclusive label; recorded why the 4 iOS rows converge for two different reasons |
| T-035 | Clarify AC-2 wording to license the early-exit request flow | assistant | F-003 | spec-agent | P2 | T-033 | DONE | specs/assistant/F-003-mobile-surface.md | AC-2 now licenses sequential-with-early-exit; the mic-denied/speech-unasked state named a legitimate resting state; spec-check exit 0 |
| T-034 | Implement the 8th row + CTA rule | assistant | F-003 | mobile-agent | P1 | T-033 | DONE | src/assistant/mobile/model/permissions.ts, src/assistant/mobile/controller.ts, src/assistant/mobile/__tests__/permissions.test.ts | IOS-MIC-UNASKED implemented, ctaTarget decoupled from canRequest, selection keys on full tuple; found+fixed a live bug (nothing-denied rendered IOS-SPEECH, claiming a never-asked grant was off); 453/453, 3 mutations proved |
| T-032 | Gate: F-003 structural re-verify | assistant | F-003 | reviewer-agent | P2 | T-028,T-029,T-030,T-034 | DONE | reports/review-F-003-2026-08-17-v2.md, specs/_shared/LEARNINGS.md | STRUCTURAL-PASS 14/14; falsified the parse-catalogue claim (4 tests red on a 1-token change); self-corrected 2 pass-1 claims; C7 conditional per ADR-007; L-008 appended |
| T-036 | Gate 3: product review for F-003 | assistant | F-003 | product-agent | P1 | T-032 | DONE | reports/product-review-F-003-2026-08-17.md | APPROVED 0H/4M/5L; found a tautological assertion in QA automation (backIsBackgroundTransition(): true asserted toBe(true)) by mutation, orchestrator verified; answered all 3 gate questions |
| T-037 | Fix M1+M2: tautological AC-11 assertion, tested_by gap, unlinked touch-target copies | assistant | F-003 | qa-mobile-agent | P1 | T-036 | DONE | qa/assistant/automation/mobile/F-003-mobile-surface.spec.ts, qa/assistant/F-003/mobile/TC-032-touch-targets-hit-area.md, qa/assistant/F-003/mobile/TC-036-system-back-never-destructive.md | found a 2nd tautology; real decision-table + 5 behavioural tests; mockup CSS parsed w/ non-vacuity guard, all 4 drift directions caught; 120/120, test:all 462/462 |
| T-040 | styles.ts should import PAINTED instead of restating it | assistant | F-003 | mobile-agent | P2 | T-037 | DONE | src/assistant/mobile/model/touch.ts, src/assistant/mobile/components/styles.ts, src/assistant/mobile/__tests__/touch-keyboard-back.test.ts | paintedBox() single accessor, 5 boxes derived, zero literals left; retry corrected 96->80; kept 2 values explicit with stated reasons; mutation-proved |
| T-043 | Invert or retire the now-vacuous PAINTED/StyleSheet drift detector | assistant | F-003 | qa-mobile-agent | P2 | T-040 | DONE | qa/assistant/automation/mobile/F-003-mobile-surface.spec.ts, qa/assistant/F-003/mobile/TC-032-touch-targets-hit-area.md, qa/assistant/runs/2026-08-17-mobile-execute.md | retired as superseded, handoff PROVEN by mutation (literal reintroduced -> unit tier red); now parses design section Touch; permission-cta asserted absent so T-042 forces it; removed a self-written assertion that would have frozen an unstated rule |
| T-041 | Publish the 4 unsourced widths in components.md | assistant | F-003 | design-agent | P2 | T-037 | DONE | design/_shared/components.md | 4 widths published in their own table (content floors, not touch minimums); refused to ratify retry=96, measured 81.9, published 80; task-row 320 re-based to narrowest supported device width |
| T-042 | Re-measure assistant-permission-cta floor from the shortest of its 3 labels | assistant | F-003 | design-agent | P3 | T-041 | PENDING | — | — |
| T-038 | Record motion/haptics phase boundary + reduced-motion precondition | assistant | F-003 | design-agent | P2 | T-036 | DONE | design/_shared/DESIGN.md, design/_shared/tokens.json | motion stack declared-not-installed recorded as a phase boundary; reduced-motion + haptics made a precondition on the first mobile animation; DESIGN.md 46/100 lines |
| T-039 | Add Verification status block; leave AC-9/10/11/12 unticked pending device pass | assistant | F-003 | spec-agent | P1 | T-036 | DONE | specs/assistant/F-003-mobile-surface.md | AC-1..8 ticked, AC-9..12 left unticked; Verification status placed right after the checkboxes; added beyond brief: a ticked box is not a device pass either (5 ticked ACs carry device residue); no counts embedded since numbers drift |
| T-026 | Mobile onForeground must also sync local creates | assistant | F-003 | mobile-agent | P2 | — | DONE | src/assistant/mobile/controller.ts, src/assistant/mobile/__tests__/lifecycle.test.ts, src/assistant/mobile/__tests__/_helpers.ts | syncLocalTasks inside the same gateForeground installer, creates before queued turn; 2 regression tests modelling silent reconnect (no onChange callback), mutation-proved |
| T-020 | QA mobile: author test cases | assistant | F-003 | qa-mobile-agent | P2 | T-018 | PARTIAL | qa/assistant/F-003/mobile/, qa/assistant/automation/mobile/F-003-mobile-surface.spec.ts, qa/_shared/fixtures/mobile/F-003-mobile-fixtures.json | 39 P1 TCs covering 12 F-003 + all 29 F-001 parity ACs; ran automation 29/32 (2 fails await T-019 code, 1 real contract drift); device-lab debt documented per L-003 |
| T-020b | Decide android accessibility-identity attribute (resource-id vs contentDescription) | assistant | F-003 | architect-agent | P1 | T-020 | DONE | specs/assistant/F-003-mobile-surface.md | resource-id (via testID) carries identity, contentDescription carries TalkBack announcement, non-conflation pinned; AC-12's two halves were mutually unsatisfiable as written |
| T-020c | Android mockup: move 22 ids to resource-id | assistant | F-003 | design-agent | P1 | T-020b | DONE | design/assistant/screens/voice-assistant-view-android.html | 22 ids moved to resource-id, aria-label untouched (18 byte-identical), header note fixed; falsification-tested that the rename is what restores C14 detection |
| T-021 | QA mobile: execute | assistant | F-003 | qa-mobile-agent | P2 | T-019,T-020 | PARTIAL | qa/assistant/automation/mobile/F-003-mobile-surface.spec.ts, qa/assistant/F-003/mobile/, qa/assistant/runs/2026-08-17-mobile-execute.md, qa/_shared/bugs/BUG-002-cold-open-accepts-input-before-session-read.md | suite 32->106 assertions, 105/106; filed BUG-002 (HIGH); BUG-001 pinned by KNOWN-OPEN test; 34/39 automated, device-lab debt unchanged |
| T-024 | Fix BUG-002: cold open must read session before accepting input | assistant | F-003 | mobile-agent | P1 | T-021 | DONE | src/assistant/mobile/controller.ts, src/assistant/mobile/__tests__/lifecycle.test.ts | root cause: gate duplicated in 2 entry points, drifted; consolidated into one installer; QA TC-030 green untouched; 5 regression tests mutation-proved |
| T-022 | Structural review C1-C14 for F-003 | assistant | F-003 | reviewer-agent | P3 | T-021,T-024,T-025,T-026 | PARTIAL | reports/review-F-003-2026-08-17.md, specs/_shared/LEARNINGS.md | STRUCTURAL-FAIL 12/14; C9 (client.permission_state missing from data-model), C7 (7 high npm audit via metro, needs human call); C2 41/41, C5 all 6 suites green; overturned 2 tool false-positives; L-005/6/7 appended |
<!-- 34 F-001 tasks archived 2026-08-17 — see TASKS-archive.md -->
<!-- Examples — the parser strips HTML comments, so these never dispatch:
| T-00X | Crawl existing app for QA knowledge | — | — | qa-explorer-agent | P2 | — | PENDING | — | — |
-->
