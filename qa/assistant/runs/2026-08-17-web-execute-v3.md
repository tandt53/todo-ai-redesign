# Web execute pass v3 — English copy sync (T-070b)

**Agent:** qa-web-agent · **Phase:** execute · **Date:** 2026-08-17
**Feature:** F-001 voice-assistant-view (web) · **Suite:** `qa/assistant/automation/e2e/F-001-voice-assistant-view.spec.ts`
**Trigger:** ADR-008 / `reports/owner-decision-2026-08-17-english-first.md` — English is the product language. Design led (T-062), implementers followed (T-067/068/069), the Vietnamese voice-undo phrase was retired (T-073); this pass is QA catching up.

---

## Numbers

Run with `npx playwright test` (= `npm run test:e2e`), chromium, `workers: 1`.

| Run | Suite state | Result |
|---|---|---|
| Before | HEAD (Vietnamese expectations) | **10 passed / 26 failed** of 36 (4.2m) |
| After | this pass | **36 passed / 0 failed** (38.1s) |
| After, repeat ×2 | this pass | **36 passed / 0 failed** (34.1s, 35.1s) — no flakes |

Both numbers come from a **clean harness process**. That qualifier is load-bearing — see the contamination finding.

`npx tsc --noEmit` exits 0.

The 26 red were not visible from `npm run test:all`: that command is `vitest run`, and Playwright runs separately (L-003's shape — a tier nobody executes). Grep, not red-count, was the guide for finding the work; running the suite was how it was verified.

---

## What changed

### Files

| File | Change |
|---|---|
| `qa/assistant/automation/e2e/F-001-voice-assistant-view.spec.ts` | `VN` constant block → `EN`, repointed at the English catalogue; `U.hoanTac` removed; TC-008 step 3 and TC-032's outcome regex repointed; TC-002 strengthened; TC-005a repointed at a new delayed row |
| `qa/assistant/automation/pages/AssistantPage.ts` | state words, row-action accessible names, `expectNoUndoNamedTask` |
| `qa/assistant/automation/harness/qa-test-server.ts` | one new QA_EXTRA row (`qaweb delayed create`, 150ms) — flake fix, see below |
| `qa/_shared/fixtures/web/assistant-web-fixtures.json` | `hoàn tác` row removed; new QA_EXTRA row documented; provenance note added |
| `qa/assistant/F-001/web/*.md` | 22 test-case documents |
| `qa/assistant/F-001/web/index.md` | copy-language section, run-record links, header provenance |

### The copy block

`EN` keeps the shape `VN` had — one home for every copy expectation, functions where a string carries a live count or title. Values trace to `design/_shared/components.md` and the mockup `design/assistant/screens/voice-assistant-view.html`, not to the implementation, except for three strings noted under "Catalogue gaps".

Nine of the literals are the AC-mandated *content* rather than decoration, and are worth listing because a wrong value here is a silently weakened test rather than a red one:

`Added {n} tasks` · `Delete {n} tasks?` / `Delete {n} tasks` / `Keep them` · `Kept all {n} tasks` · `Undone` / `Undone — except one task` / `Nothing was undone` · `Skipped: {title} — …` · `There is nothing to undo — …` · `Couldn't send` · `Session closed — no activity` · `Nothing changed. If I misheard, …`

### Two assertions got *stronger*, not weaker

1. **The thinking state word is now pinned to a literal.** Under the Vietnamese copy it had to be an alternation (`/Đang xử lý|Đang nghĩ/`) because the mockup said one thing and the app said another, and no AC fixed either — pinning one would have failed the test on a difference that violated no requirement. The English catalogue closed that gap: mockup and app both render `Thinking…` (and `Listening…`, and the cancel pill's `Cancel`). **The T-016 drift note is resolved, not carried forward.**

2. **TC-002 now asserts the confirm chips' text, not just their visibility.** `toBeVisible()` on a chip passes when the chip is empty or carries the other branch's label — the false-green shape the QA foundations warn about. The two literals asserted are also the exact strings AC-10 requires a tap to send as the answer turn (TC-013a asserts the affirmative one on the wire), so the "tap sends the option's literal text" contract is now falsifiable at both ends.

### One assertion removed, deliberately

`expectNoUndoNamedTask()` checked that no task row was titled `undo` **or** `hoàn tác`. ADR-008 retired the second phrase: `UNDO_PHRASES` is now `['undo']` alone (`src/assistant/api/engine/normalize.ts:9`) and the canonical fixture table carries no tripwire row behind the Vietnamese phrase. The check had become vacuously true — and a vacuous assertion is worse than an absent one, because it reads as coverage of a guard that no longer applies to it. Removed, with the reason recorded in the method's doc comment.

The guarantee itself is untouched and still falsifiable: the canonical table maps the utterance `undo` to a **create of a task titled "undo"**, so if the ADR-006 guard ever stopped short-circuiting, TC-008 goes red rather than quiet.

### TC-008 kept its case

TC-008 named two phrases and fed the Vietnamese one at step 3, so the pass doubled as an equivalence check across AC-5's vocabulary. The vocabulary now has one member, so step 3 feeds it. **The case was not deleted and its guarantee was not weakened** — an undo phrase never becomes a task, never reaches the model, and refuses visibly when out of window. The file carries a Vocabulary note saying where a second phrase would get its equivalence check back.

The complementary negative — *the retired phrase is now an ordinary turn: interpreted, `no_match`, reverts nothing* — is already owned by the api tier (`qa/assistant/automation/api/F-001-voice-assistant-view.spec.ts:781`, T-070a). The web tier does not duplicate it.

---

## Finding 1 — a stale harness silently contaminates local runs (test-infrastructure defect)

**This one nearly corrupted this task's own before/after numbers, so it is first.**

`playwright.config.ts` sets `reuseExistingServer: !process.env['CI']` on both webServers. The QA harness holds all state in a `MemoryStore` for the lifetime of its **process**, and the suite's account names come from a module-level counter (`freshUser`) that restarts at 1 on every run. Put together: if a harness process from an earlier run is still listening on 4460, the next run reuses it *and reuses its account names*, so every test sees the previous run's data.

Observed directly. After three runs against one surviving harness, TC-001's account held **12** tasks and three rows titled "Plan Monday"; the failure read `toHaveCount(1) … Received: 3`. Nothing anywhere reported a stale server — the run looked like 27 ordinary product failures.

The tell to remember: a count assertion failing at an exact multiple of the expected value (3 = 1 × 3 runs, 12 = 4 × 3 runs) is arithmetic, not a bug.

Both numbers in this record were taken after `pkill -f qa-test-server` and a port check.

**Not fixed here** — changing the reuse policy is outside T-070b's scope and belongs to whoever owns the harness contract next. Two candidate remedies, in preference order:
1. Give the harness a `/__qa__/reset` endpoint and call it from a Playwright `globalSetup`. Keeps fast local reuse and makes the state explicit.
2. `reuseExistingServer: false`. Playwright then errors on a busy port, which is loud rather than silent — strictly better than the current behaviour, at the cost of a slower loop.

A third, cheaper half-measure worth doing either way: seed `freshUser` from a per-run nonce (`Date.now()`), so two runs can never collide on an account name even if they do share a process.

## Finding 2 — TC-005's applied race was a genuine flake, and the fix is a fixture, not a wait

After the copy sync, one case stayed red: TC-005 sub-case (a), `element was detached from the DOM` on the cancel-pill click. Triaged per the three-run rule: **pass / fail / pass**.

Root cause is timing, not copy. Sub-case (a) drove the canonical create row, whose `delay_ms` is 60 — shorter than a single Playwright click round-trip against an in-process server. The turn resolved and React unmounted the thinking indicator (which owns the cancel pill) while the click was still resolving actionability. Sub-cases (b) and (c) never had the problem because they already use 150ms QA_EXTRA rows, added at the first execute pass for exactly this reason.

Fix: one more QA_EXTRA row, `qaweb delayed create` at 150ms — the same documented remedy extended to the create variant. No wait was added, no assertion relaxed: cancel must still win the surface while a real turn is genuinely in flight, and the late outcome must still render. The 60ms canonical row keeps its own coverage of the ordinary thinking transition in TC-011 and TC-031.

Worth noting *why this was invisible before*: under the Vietnamese expectations, `expectThinking()` failed first, so the test died before it ever reached the racy click. Fixing the copy did not create this flake — it made it **reachable**. Expect more of this shape wherever a red assertion was masking the assertions behind it.

## Finding 3 — green-but-impossible fixtures (kind (b)), all outside this scope

These pass today while asserting a shape the server can no longer produce. `engine/turns.ts:92-95` emits `Delete {n} tasks` / `Keep them`; each site below hands the reducer a fabricated Vietnamese pair instead of getting the turn from the server, so nothing fails to report the drift. Not touched — none is in qa-web-agent's subtree.

| Site | Fabrication | Owner |
|---|---|---|
| `src/assistant/mobile/__tests__/a11y.test.ts:175` | `options: ['Xóa 3 việc', 'Giữ lại']` | mobile-agent |
| `src/assistant/mobile/__tests__/a11y.test.ts:382` | asserts the rendered chip `toContain('Giữ lại')` | mobile-agent |
| `src/assistant/mobile/__tests__/a11y.test.ts:192` | clarify candidates as Vietnamese titles | mobile-agent |
| `src/assistant/mobile/__tests__/parity.test.ts:79` | `askedTurn('bulk_delete', …, ['Xóa 3 việc', 'Giữ lại'])` | mobile-agent |
| `src/assistant/mobile/__tests__/parity.test.ts:228` | `askedTurn('clarify', …)` with Vietnamese candidates | mobile-agent |
| `src/assistant/mobile/__tests__/parity.test.ts:254` | `askedTurn('bulk_delete', …, ['Xóa 2 việc', 'Giữ lại'])` | mobile-agent |
| `src/assistant/mobile/__tests__/lifecycle.test.ts:184` | `askedTurn('bulk_delete', …, ['Xóa 2 việc', 'Giữ lại'])` | mobile-agent |

Seven sites, three files. They are the visible tip: `src/assistant/mobile/__tests__/` carries **119 lines** of Vietnamese across 5 files, most of it fabricated turn payloads and task titles, and the mobile unit tier is green.

**The structural point, not the line count.** Every one of these is green *because* the fixture builds the turn itself instead of obtaining it from the server. That is L-004's twin-home drift with the extra twist that the second home is a test double: the copy has two sources of truth, one of which is only ever read by the test that wrote it, so the copies can diverge arbitrarily and no assertion anywhere notices. The durable remedy is L-008's — have the test read the producing artifact (`bulkDeleteOptions`, or the served turn) rather than retype its output. A same-day rename would not fix the class.

## Finding 4 — an L-004 twin in the api tier's fixture map

`qa/assistant/F-001/api/utterance-intent-fixtures.json` — the QA half of the canonical utterance→intent table, the exact artifact L-004 was written about — still declares three rows the executable table no longer has:

| Row in the QA copy | Canonical table (`src/assistant/api/ports/fixture-table.ts`) |
|---|---|
| `"đúng vậy, xoá đi"` (affirmative) | replaced by `yeah` (T-069) |
| `"không"` (negative) | replaced by `nope` (T-069) |
| `"hoàn tác"` (undo tripwire) | row removed with ADR-008 |

`qa/assistant/automation/api/F-001-voice-assistant-view.spec.ts:129,132` carries the same stale set in a local classifier stub. qa-api-agent's subtree; flagged, not touched. This is the same file L-004 named, drifting again in the same way, which is itself the argument for generating one copy from the other rather than hand-keeping both.

## Finding 5 — which artifact was treated as the source, where two carried the same value

Per the briefing's rule:

| Twin | Source used | Why |
|---|---|---|
| Copy strings: catalogue/mockup vs. implementation | **catalogue + mockup** | F-001 "Naming convention" gives design ownership; the implementation agreed everywhere it was checked |
| `hoàn tác` in the web fixture map vs. `fixture-table.ts` | **`fixture-table.ts`** (executable) | the map is derived — it records which canonical rows each TC leans on; the table is what actually runs. Recorded in the file's `_readme`. |
| Undo vocabulary: TC docs vs. `UNDO_PHRASES` | **`UNDO_PHRASES`** | it is the enforced list; the docs describe it |

---

## Catalogue gaps (reported to design, not absorbed silently)

Three strings asserted by the automation have no published home in `design/_shared/components.md` or the mockups, and were taken from the implementation under this task's rule that the implementation wins unless it contradicts the catalogue:

1. **`That question was already answered`** — the already-resolved outcome head. No mockup state renders it.
2. **`Microphone is temporarily unavailable`** — the mic's accessible name in transient-failure mode. §MicControl publishes the available / listening / permission-denied names and stops there.
3. **`New task name` / `Save`** — the manual add-task form. Not in the mockup at all.

Separately, `src/assistant/_shared/model/messages.ts` already reports two of its own: the clarify question head (`{n} tasks match — which one?` against the mockup's `“Meeting” matches two tasks — which one?`, which needs a wire field that does not exist) and `Put back:` in the reverted body, a placeholder chosen because §Buttons bans *restore* / *revert* / *roll back*. Neither is asserted by this suite.

## Standing limit — `EN` is a transcription, not a parse (L-008)

L-008's lesson is that a test should **parse the owning artifact** so it fails when the *upstream* moves, which is the direction drift travels; `permissions.test.ts` does exactly that against §MicControl. This suite cannot yet: `components.md` publishes the permission rows as an addressable per-row table, but the conversation strings (applied head, kept, undone, boundary, error) are prose scattered across §Applied, §Outcome, §Reverted, §Error and the mockup's rendered samples. There is nothing to parse per row.

So `EN` is a hand-kept copy and this pass is, in the L-008 sense, a self-agreement check. Recorded rather than hidden. The unblocking move is design's: publish the conversation copy as an ID'd table the way the permission rows are, at which point the assertions can cite row IDs and this limitation goes away.

---

## Stability

Full suite run three times after the change, each against a freshly started harness:

- pass 1 — 36 passed / 0 failed (38.1s)
- pass 2 — 36 passed / 0 failed (34.1s)
- pass 3 — 36 passed / 0 failed (35.1s)

No flakes across the three passes.

TC-005 was additionally run three times on its own before the fixture fix (pass / fail / pass), which is what classified it as a flake rather than a product bug.

## Bugs filed

**None.** Every failure this pass was a stale QA expectation, a stale test fixture, or a script race. The implementation was correct at every point where an expectation and the app disagreed — which is what the task assumed and what the run confirms.
