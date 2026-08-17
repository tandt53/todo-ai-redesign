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
| T-001 | Spec the voice-first assistant view | assistant | F-001 | spec-agent | P0 | — | DONE | specs/assistant/F-001-voice-assistant-view.md, specs/assistant/index.md | 13 AC / 6 tensions; cites UC-52,54; flagged 11-uc-conversation.md gap |
| T-002 | Gate 1 multi-lens spec review | assistant | F-001 | orchestrator | P0 | T-001 | DONE | reports/gate1-review-F-001.md | GATE CLOSED at round cap: 2 rounds, 123 findings routed, 2 owner decisions, 0 unresolved HIGH |
| T-002b | Spec revision from Gate 1 findings | assistant | F-001 | spec-agent | P0 | T-002 | DONE | specs/assistant/F-001-voice-assistant-view.md | rev2: 29 ACs (was 13), C1-C12 all closed, 3 contradictions gone, spec-check exit 0, 191 lines |
| T-002c | Gate 1 re-review (round 2 of max 2) | assistant | F-001 | orchestrator | P0 | T-002b | DONE | reports/gate1-review-F-001.md | 9/9 lenses; r1 clusters all closed; 15H/21M/8L new -> 7 clusters, no conflicts |
| T-002d | Final spec revision (round-2 findings) | assistant | F-001 | spec-agent | P0 | T-002c | DONE | specs/assistant/F-001-voice-assistant-view.md | rev3: R1-R7 + 21 same-pass edits landed, 198 lines, 29 ACs stable, spec-check exit 0 |
| T-003 | Design system (phase system) | _shared | F-001 | design-agent | P1 | T-002 | DONE | design/_shared/DESIGN.md, design/_shared/tokens.json, design/_shared/components.md | Aurora-disciplined identity, 13 components, 47/47 WCAG pairs pass, DESIGN.md 44 lines |
| T-004 | Architecture + contracts | assistant | F-001 | architect-agent | P1 | T-002 | DONE | specs/_shared/ARCHITECTURE.md, specs/assistant/api-contracts.md, specs/assistant/data-model.md, specs/_shared/adr/, specs/_shared/platform/ | 12 files, 7/7 OQs answered, R1-R7 zero-drift, harness smoke 2/2 pass |
| T-005 | Screen mockups (phase screens) | assistant | F-001 | design-agent | P1 | T-003 | DONE | design/assistant/screens/voice-assistant-view.html, design/assistant/screens/voice-assistant-view-ios.html, design/assistant/screens/voice-assistant-view-android.html | 3 variants x 17 states, design-check 18/0/6skip, 17-testid catalogue, OQ1: inline list + drawer |
| T-006b | Backend prototype server per ADR-001 | assistant | F-001 | backend-agent | P2 | T-004 | DONE | src/assistant/api/ | 8 endpoints, 9 rules, 5 mid-flight pins absorbed, vitest 65/65, tsc clean, mutation check ran; also created root package.json/tsconfig per platform doc |
| T-007b | QA api: author test cases | assistant | F-001 | qa-api-agent | P2 | T-002,T-004 | DONE | qa/assistant/F-001/api/, qa/assistant/automation/api/F-001-voice-assistant-view.spec.ts | 39 P1 TCs, 16/16 api ACs, 23/23 error rows, 24-row fixture table; 5 contract gaps routed to architect |
| T-006 | Web implementation | assistant | F-001 | web-agent | P2 | T-004,T-005 | PARTIAL | src/assistant/web/ | 12 files: model/reducer/api-client/seams/stores + 2 components; no React deps, no app shell, no tests; agent died on session limit |
| T-006c | Finish web implementation | assistant | F-001 | web-agent | P2 | T-006 | DONE | src/assistant/web/ | app shell + components + 94 tests; orchestrator re-ran: web 94/94, api 68/68; 22/22 testids; fixed 2 bugs in T-006 output |
| T-006d | Align confirm-chip labels with design copy | assistant | F-001 | backend-agent | P2 | T-006c | DONE | src/assistant/api/engine/turns.ts, src/assistant/api/ports/fixture-interpreter.ts, src/assistant/api/ports/fixture-table.ts | server-owned labels w/ real count; vi ừ/không added; 5 new tests |
| T-006e | Fix api test-harness port flake (426 vs 404) | assistant | F-001 | backend-agent | P3 | T-006b | DONE | src/assistant/api/__tests__/helpers.ts | root cause: supertest per-request server + Node keep-alive port reuse; fixed single-server-per-harness; orchestrator verified 5/5 clean re-runs, agent ran 20/20 |
| T-007 | QA web: author test cases | assistant | F-001 | qa-web-agent | P2 | T-002,T-005 | DONE | qa/assistant/F-001/web/, qa/assistant/automation/e2e/F-001-voice-assistant-view.spec.ts | 32 P1 TCs, 22/22 web ACs, tsc clean, 3 testid/affordance requests routed to design |
| T-008 | Structural review C1-C14 | assistant | F-001 | reviewer-agent | P3 | T-006c,T-006b,T-006d,T-006e,T-007,T-007b | PARTIAL | reports/review-F-001-2026-08-16.md, specs/_shared/LEARNINGS.md | STRUCTURAL-FAIL 10/14; fails: C1,C2 (mobile scope, needs human), C8 (no Ops), C9 (3 doc/code drifts); code+tests need no changes |
| T-008b | Fix C8 Ops + C9.3 spec sentence | assistant | F-001 | spec-agent | P1 | T-008 | DONE | specs/assistant/F-001-voice-assistant-view.md | Ops section added, AC-7 baseline corrected to post-apply, spec-check exit 0 |
| T-008c | Fix C9.1/C9.2/C9.3 contract+data-model | assistant | F-001 | architect-agent | P1 | T-008 | DONE | specs/assistant/api-contracts.md, specs/assistant/data-model.md | 500 INTERNAL documented, boundary_late+last_foreground_at added, AC-7 baseline corrected |
| T-008d | Investigate+fix new AC-15 test timeout flake (orchestrator-found, not in review report) | assistant | F-001 | backend-agent | P1 | T-008 | DONE | src/assistant/api/__tests__/helpers.ts | root cause: IPv6 wildcard bind + supertest double-listen race + unrelated playwright server on same port; fixed w/ explicit 127.0.0.1 bind + awaited listening event; orchestrator verified 15/15 + agent 30/30 |
| T-008f | Retag 24 ACs to (api, web); mobile deferred to F-002+ | assistant | F-001 | spec-agent | P1 | T-008b | DONE | specs/assistant/F-001-voice-assistant-view.md | 22 ACs retagged (api,web); AC-26/27 marked RESERVED for mobile follow-up; Out of Scope + Data table fixed; spec-check exit 0 |
| T-008e | Gate 3 structural re-verify | assistant | F-001 | reviewer-agent | P2 | T-008f,T-008c,T-008d | PARTIAL | reports/review-F-001-2026-08-16-v2.md, specs/_shared/LEARNINGS.md | STRUCTURAL-FAIL 12/14 (was 10/14); mobile+C8+3xC9 confirmed fixed; NEW: C5 (qa automation never executed, 2 bugs), C9 (4 more undocumented turn fields) |
| T-009 | Fix + run qa-api automation (execute phase) | assistant | F-001 | qa-api-agent | P1 | T-008e | DONE | qa/assistant/automation/api/F-001-voice-assistant-view.spec.ts, qa/assistant/runs/2026-08-16-api-execute.md | rewired handle-based port, fixed 3 script bugs + 1 false-green, 46/46, npm test:all 213/213 |
| T-009b | Sync TC-10/TC-30 markdown to corrected single-pending-question scenario | assistant | F-001 | qa-api-agent | P2 | T-009 | DONE | qa/assistant/F-001/api/TC-10-serial-order-and-answer-binding.md, qa/assistant/F-001/api/TC-30-explicit-close-declines-idempotent.md, qa/assistant/F-001/api/index.md | docs now match the automation; why-note added so it does not read as a weakened test; F-001 api tiers 46/46 + 73/73 |
| T-010 | Bring up Playwright harness + run qa-web automation (execute phase) | assistant | F-001 | qa-web-agent | P1 | T-008e | DONE | qa/assistant/automation/e2e/, qa/assistant/runs/2026-08-16-web-execute.md | harness built from scratch (also created root playwright.config.ts, vitest.config.ts per platform doc delegation); 34/34 e2e pass (orchestrator re-ran independently, real chromium); fixed 4 script bugs; npm test:all 213/213 |
| T-013 | Add exact 2-target delete row to canonical fixture table | assistant | F-001 | backend-agent | P3 | T-009 | PENDING | — | — |
| T-011 | Fix C9: 4 missing assistant_turn fields in data-model.md | assistant | F-001 | architect-agent | P1 | T-008e | DONE | specs/assistant/data-model.md | post_apply/created_ids/pending_op/caused_resolutions added; post_apply row closes the AC-7 baseline loop |
| T-012 | Gate 4 structural re-verify | assistant | F-001 | reviewer-agent | P2 | T-009,T-010,T-011 | DONE | reports/review-F-001-2026-08-16-v3.md, specs/_shared/LEARNINGS.md | STRUCTURAL-PASS 14/14; orchestrator independently re-verified test:all 213/213, tsc clean, no C12 mutation left behind |
| T-014 | Gate 3: final product review | assistant | F-001 | product-agent | P1 | T-012 | PARTIAL | reports/product-review-F-001-final-2026-08-16.md | CHANGES REQUESTED 2H+4M+5L; H1 locale mismatch (owner: translate to Vietnamese), H2 WCAG 4.1.3 missing |
| T-015a | Extend AC-19 (4.1.3) + confirm no other spec English-copy leaks | assistant | F-001 | spec-agent | P1 | T-014 | DONE | specs/assistant/F-001-voice-assistant-view.md | AC-19 gained 4.1.3; added Naming convention paragraph (concept names vs UI copy/locale); 1 literal-string leak fixed in Out of Scope; spec-check exit 0 |
| T-015b | Translate bulkDeleteOptions to Vietnamese | assistant | F-001 | backend-agent | P1 | T-014 | DONE | src/assistant/api/engine/turns.ts | Xoá N việc / Giữ lại; qa-api automation reads options positionally, unaffected (46/46); flagged mixed-language risk in web headline for T-015c |
| T-015c | Translate all web UI copy to Vietnamese + add aria-live for outcomes (4.1.3) + fix leaked "turn" word | assistant | F-001 | web-agent | P1 | T-014 | DONE | src/assistant/web/ | full Vietnamese pass, role=log+aria-live+role=alert wiring, self-proved via mutation (5/98 fail on 3 targeted breaks), turn-leak fixed; 217/217, tsc clean |
| T-015e | Translate UNSUPPORTED_QUERY_ALTERNATIVE to Vietnamese | assistant | F-001 | backend-agent | P2 | T-015c | BLOCKED | — | first attempt returned confused/hallucinated (claimed npm test:all doesn't exist, referenced an unrelated project) — orchestrator disbelieved the factual claims but the process point (contract embeds the literal English string) was valid and verified; redirected as T-015f+T-015g |
| T-015f | Translate the contract-documented unsupported_query alternative text | assistant | F-001 | architect-agent | P1 | T-015e | DONE | specs/assistant/data-model.md, specs/assistant/api-contracts.md | alternative value now "danh sách và bộ lọc trên màn hình" in both docs |
| T-015g | Implement turns.ts to match the corrected contract | assistant | F-001 | backend-agent | P1 | T-015f | DONE | src/assistant/api/engine/turns.ts, src/assistant/api/__tests__/turn.test.ts | contract value implemented; api unit 73/73; left 1 qa/-owned stale assertion for T-016 (correct scope boundary) |
| T-015d | Update 3 mockups: Vietnamese copy + fix listening-Undo discrepancy + boundary hairline + clarify caption | assistant | F-001 | design-agent | P1 | T-014 | DONE | design/assistant/screens/ (3 files) | 17 states x 3 files Vietnamese; M2 fixed in listening+mic-hidden (orchestrator briefing error caught+corrected); M3+M4 fixed; design-check 18/0/6skip held |
| T-016 | Sync qa-web automation to translated strings; add 4.1.3 TC; re-execute | assistant | F-001 | qa-web-agent | P1 | T-015b,T-015c,T-015g | DONE | qa/assistant/automation/e2e/F-001-voice-assistant-view.spec.ts, qa/assistant/F-001/web/ (19 edited + TC-033/034 new), qa/assistant/runs/2026-08-16-web-execute-v2.md | 36/36 (orchestrator re-ran, real chromium); 3 self-proved mutations; found spelling drift Xóa/Xoá + Đang nghĩ/Đang xử lý (non-blocking, routed to Gate 5) |
| T-017 | Gate 5: final product review re-verify | assistant | F-001 | product-agent | P2 | T-016,T-016b,T-015d | DONE | reports/product-review-F-001-final-2026-08-16-v2.md | APPROVED; 0 HIGH, 2 MEDIUM (M5/M6, non-blocking); orchestrator re-verified test:all 217/217; screen-reader pass + M5/M6 routed to sign-off checklist |
| T-016b | Sync qa-api automation to translated strings; re-execute | assistant | F-001 | qa-api-agent | P1 | T-015f,T-015g | DONE | qa/assistant/automation/api/F-001-voice-assistant-view.spec.ts, qa/assistant/F-001/api/TC-14-unsupported-query-names-alternative.md, qa/assistant/runs/2026-08-16-api-execute-v2.md | 1 stale assertion fixed (self-proved via revert-and-check); test:all 217/217 |
| T-018 | Spec F-003 mobile surface (carries AC-26/27) | assistant | F-003 | spec-agent | P1 | T-017 | DONE | specs/assistant/F-003-mobile-surface.md, specs/assistant/index.md | 137 lines, 12 ACs; parity table classifies all 29 F-001 ACs (21 as-is + 6 clause-added + 2 moved); ios/android split explicit; spec-check exit 0 |
| T-019 | Mobile implementation (React Native) | assistant | F-003 | mobile-agent | P2 | T-018 | DONE | src/assistant/mobile/, src/assistant/_shared/ | shared extraction (mobile controller EXTENDS shared, no 2nd reducer); 92 mobile tests; web 98/98 + api 73/73 + e2e 36/36 unbroken; found BUG-001 |
| T-023 | Fix BUG-001: offline local creates never replay | assistant | F-001 | web-agent | P1 | T-019 | DONE | src/assistant/_shared/controller.ts, src/assistant/_shared/api/client.ts, src/assistant/_shared/testing/fixtures.ts, src/assistant/web/__tests__/controller.test.ts | syncLocalTasks: 201+409 both ack, idempotent, creates replay before queued turn; also closed an adjacent loss path (offline cold open wiped stored local tasks); 8 tests mutation-proved; contract needed no change |
| T-025 | Invert QA KNOWN-OPEN pin now that BUG-001 is fixed | assistant | F-003 | qa-mobile-agent | P1 | T-023 | DONE | qa/assistant/automation/mobile/F-003-mobile-surface.spec.ts, qa/assistant/F-003/mobile/TC-040-foreground-is-a-reconnect-for-offline-creates.md, qa/assistant/F-003/mobile/index.md, qa/assistant/runs/2026-08-17-mobile-execute.md | pin -> 5 contract-derived assertions; added TC-040 after finding every reconnect assertion passed regardless of onForeground; 111/111, 3 mutation checks |
| T-027 | Fix C9 (client.permission_state in data-model) + add announce port to platform doc | assistant | F-003 | architect-agent | P1 | T-022 | DONE | specs/assistant/data-model.md, specs/_shared/platform/mobile.md | permission_state row w/ both platform asymmetries; Announcer port + build-dont-author convention; routed 2 follow-ups |
| T-028 | ADR: accept the metro/image-size advisory with review conditions (C7, owner decision) | assistant | F-003 | architect-agent | P1 | T-022 | DONE | specs/_shared/adr/ADR-007-accept-metro-image-size-advisory.md | 66 lines (6 over house limit, accepted by orchestrator rather than dropping a required pin); found the only offered fix is a DOWNGRADE to RN 0.72.17; C7 conditional pass bounded to the exact current audit shape |
| T-029 | Fix F-003 Data lead sentence (3rd client row is new, not pre-existing) | assistant | F-003 | spec-agent | P2 | T-027 | DONE | specs/assistant/F-003-mobile-surface.md | lead sentence corrected; agent verified data-model.md:133 really carries the row before asserting it; spec-check exit 0 |
| T-030 | Move the 7 permission-copy strings into components.md | assistant | F-003 | design-agent | P2 | T-027 | DONE | design/_shared/components.md, design/assistant/screens/voice-assistant-view-ios.html, design/assistant/screens/voice-assistant-view-android.html | 7-row catalogue + 1 adjacent AC-4 string; found 2 real mockup drifts incl. an iOS message that violated AC-2 by not naming which permission; design-check 18/0 held |
| T-031 | Re-point permissions.ts to cite components.md | assistant | F-003 | mobile-agent | P2 | T-030 | DONE | src/assistant/mobile/model/permissions.ts, src/assistant/mobile/__tests__/permissions.test.ts | CATALOGUE keyed by design row IDs, template removed; tests PARSE components.md so a hand-copy cannot pass; 448/448, mutation-proved both ways; found an 8th unenumerated iOS tuple |
| T-033 | Decide + publish the 8th iOS permission row (mic denied + speech never asked) | assistant | F-003 | design-agent | P1 | T-031 | DONE | design/_shared/components.md | IOS-MIC-UNASKED published; ruled row-not-spec-clause (forcing both dialogs would spend iOS last prompt on an inert grant); CTA=Settings, AND-DENIED keeps its exclusive label; recorded why the 4 iOS rows converge for two different reasons |
| T-035 | Clarify AC-2 wording to license the early-exit request flow | assistant | F-003 | spec-agent | P2 | T-033 | DONE | specs/assistant/F-003-mobile-surface.md | AC-2 now licenses sequential-with-early-exit; the mic-denied/speech-unasked state named a legitimate resting state; spec-check exit 0 |
| T-034 | Implement the 8th row + CTA rule | assistant | F-003 | mobile-agent | P1 | T-033 | DONE | src/assistant/mobile/model/permissions.ts, src/assistant/mobile/controller.ts, src/assistant/mobile/__tests__/permissions.test.ts | IOS-MIC-UNASKED implemented, ctaTarget decoupled from canRequest, selection keys on full tuple; found+fixed a live bug (nothing-denied rendered IOS-SPEECH, claiming a never-asked grant was off); 453/453, 3 mutations proved |
| T-032 | Gate: F-003 structural re-verify | assistant | F-003 | reviewer-agent | P2 | T-028,T-029,T-030,T-034 | IN_PROGRESS | — | — |
| T-026 | Mobile onForeground must also sync local creates | assistant | F-003 | mobile-agent | P2 | T-023 | DONE | src/assistant/mobile/controller.ts, src/assistant/mobile/__tests__/lifecycle.test.ts, src/assistant/mobile/__tests__/_helpers.ts | syncLocalTasks inside the same gateForeground installer, creates before queued turn; 2 regression tests modelling silent reconnect (no onChange callback), mutation-proved |
| T-020 | QA mobile: author test cases | assistant | F-003 | qa-mobile-agent | P2 | T-018 | PARTIAL | qa/assistant/F-003/mobile/, qa/assistant/automation/mobile/F-003-mobile-surface.spec.ts, qa/_shared/fixtures/mobile/F-003-mobile-fixtures.json | 39 P1 TCs covering 12 F-003 + all 29 F-001 parity ACs; ran automation 29/32 (2 fails await T-019 code, 1 real contract drift); device-lab debt documented per L-003 |
| T-020b | Decide android accessibility-identity attribute (resource-id vs contentDescription) | assistant | F-003 | architect-agent | P1 | T-020 | DONE | specs/assistant/F-003-mobile-surface.md | resource-id (via testID) carries identity, contentDescription carries TalkBack announcement, non-conflation pinned; AC-12's two halves were mutually unsatisfiable as written |
| T-020c | Android mockup: move 22 ids to resource-id | assistant | F-003 | design-agent | P1 | T-020b | DONE | design/assistant/screens/voice-assistant-view-android.html | 22 ids moved to resource-id, aria-label untouched (18 byte-identical), header note fixed; falsification-tested that the rename is what restores C14 detection |
| T-021 | QA mobile: execute | assistant | F-003 | qa-mobile-agent | P2 | T-019,T-020 | PARTIAL | qa/assistant/automation/mobile/F-003-mobile-surface.spec.ts, qa/assistant/F-003/mobile/, qa/assistant/runs/2026-08-17-mobile-execute.md, qa/_shared/bugs/BUG-002-cold-open-accepts-input-before-session-read.md | suite 32->106 assertions, 105/106; filed BUG-002 (HIGH); BUG-001 pinned by KNOWN-OPEN test; 34/39 automated, device-lab debt unchanged |
| T-024 | Fix BUG-002: cold open must read session before accepting input | assistant | F-003 | mobile-agent | P1 | T-021 | DONE | src/assistant/mobile/controller.ts, src/assistant/mobile/__tests__/lifecycle.test.ts | root cause: gate duplicated in 2 entry points, drifted; consolidated into one installer; QA TC-030 green untouched; 5 regression tests mutation-proved |
| T-022 | Structural review C1-C14 for F-003 | assistant | F-003 | reviewer-agent | P3 | T-021,T-024,T-025,T-026 | PARTIAL | reports/review-F-003-2026-08-17.md, specs/_shared/LEARNINGS.md | STRUCTURAL-FAIL 12/14; C9 (client.permission_state missing from data-model), C7 (7 high npm audit via metro, needs human call); C2 41/41, C5 all 6 suites green; overturned 2 tool false-positives; L-005/6/7 appended |
<!-- Examples — the parser strips HTML comments, so these never dispatch:
| T-002 | Implement login endpoint | auth | F-001 | backend-agent | P0 | T-001 | IN_PROGRESS | — | — |
| T-003 | Build login UI | auth | F-001 | web-agent | P1 | T-002 | BLOCKED | — | needs POST /auth/login first |
| T-004 | Author web test cases | auth | F-001 | qa-web-agent | P1 | T-001 | DONE | qa/auth/F-001/web/ | 9 TC, 7/7 AC covered |
| T-00X | Crawl existing app for QA knowledge | — | — | qa-explorer-agent | P2 | — | PENDING | — | — |
-->
