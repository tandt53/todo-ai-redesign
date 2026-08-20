# Run record: F-001 API integration suite — phase: execute (v2, copy re-sync)

| Field | Value |
|---|---|
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Agent | qa-api-agent |
| Phase | execute (T-016b — re-run after the T-015b/T-015g Gate-3 localization pass, not fresh authoring) |
| Date | 2026-08-16 |
| Suite | `tests/assistant/api/F-001-voice-assistant-view.spec.ts` |
| Command | `npx vitest run tests/assistant/api` |
| Result | **46 / 46 PASS** |
| Project gate | `npm run test:all` → **217 / 217 PASS** (10 files) |
| Backend unit suite | `npx vitest run src/assistant/api` → **73 / 73 PASS** (untouched by this task) |
| Typecheck | `npm run typecheck` → exit 0 |
| Bugs filed | none — the single failure was a stale test, not a product defect |

## Why this run happened

Two server-generated strings were translated to Vietnamese as part of the
Gate-3 localization pass:

| Symbol | Was | Now |
|---|---|---|
| `UNSUPPORTED_QUERY_ALTERNATIVE` | `the on-screen list and its filters` | `danh sách và bộ lọc trên màn hình` |
| `bulkDeleteOptions(count)` | `Delete {n} tasks` / `Keep them` | `Xoá {n} việc` / `Giữ lại` |

The API automation suite pinned the first literal verbatim and therefore went red.

## Baseline (before any edit)

```
npm run test:all
Test Files  1 failed | 9 passed (10)
     Tests  1 failed | 216 passed (217)

FAIL tests/assistant/api/F-001-voice-assistant-view.spec.ts
     > honesty outcomes (TC-13, TC-14) > TC-14 unsupported_query ...
AssertionError: expected 'danh sách và bộ lọc trên màn hình'
              to be 'the on-screen list and its filters'
```

Exactly one failure, exactly where the briefing said it would be.

## Triage (per `_qa-foundations` §8)

**Step 1 — 3× isolation re-run.** Failed identically all three times with the
same assertion diff. Not a flake.

**Step 2 — classify.** Assertion error (not selector, network, or setup): the
request completed, the response shape was right, one string value differed.

**Step 3 — diagnose.** The rule for an assertion error is to re-read the spec
before touching anything, and for the API layer to compare the actual response
against the api-contracts entry:

- `docs/specs/assistant/api-contracts.md` §9 fixes the value as
  `alternative: "danh sách và bộ lọc trên màn hình"` ("the on-screen list and
  its filters").
- `docs/specs/assistant/data-model.md:95` pins the same literal on `TurnOutcome`.
- The server returned exactly that.

So the **contract and the implementation agree with each other, and the test
disagreed with both**. Under the triage rule "is the actual behaviour what the
AC says? → the test assertion is wrong", this is a stale test. Fixed the test.
No bug filed.

**This is not an assertion weakened to green.** The distinction matters enough
to state plainly: the expected value was re-derived from the contract, which
had itself changed, and the assertion remains an exact-equality check on a
verbatim literal. The cardinal QA sin is moving a test toward the code when the
*spec* still disagrees. Here the spec moved first, and the test was the last
artifact to catch up.

## Proof the repaired assertion still bites

An updated expectation is worthless if it cannot fail, so it was mutation-tested
rather than assumed (`_qa-foundations` §5, "if the implementation were broken,
would this test notice?"). `UNSUPPORTED_QUERY_ALTERNATIVE` was temporarily
reverted to the old English string in `src/`:

```
AssertionError: expected 'the on-screen list and its filters'
              to be 'danh sách và bộ lọc trên màn hình'
Tests  1 failed | 45 skipped (46)
```

The test caught it. The source file was then restored from a byte-for-byte
backup and re-verified by grep; the final 217/217 run below is against the
restored tree.

## Changes made

| File | Change |
|---|---|
| `tests/assistant/api/F-001-voice-assistant-view.spec.ts:596` | Expected value → `danh sách và bộ lọc trên màn hình`, with a comment citing api-contracts §9 as the source of the literal |
| `docs/qa/assistant/F-001/api/TC-14-unsupported-query-names-alternative.md` | Summary + step-1 assertion now quote the Vietnamese literal with the English gloss; Notes record the re-sync and why it is not a weakened assertion |
| `docs/qa/assistant/F-001/api/utterance-intent-fixtures.json` (UT-LISTQ-1 note) | Note names the contract-fixed literal rather than the gloss alone |

The literal is pinned verbatim rather than imported from
`src/assistant/api/engine/turns.ts`. Importing the constant would make the
assertion tautological — it would pass for whatever the code happened to say,
including a bad re-wording. The contract is the source of truth, so the contract
value is what is hard-coded.

## The bulk-delete chip labels needed no automation change

Worth recording because the absence of a change here is a deliberate finding,
not an oversight. The API suite reads chip labels **positionally** —
`q.options[0]` / `q.options[1]`, marked "literal text, never invented" — because
`data-model.md:105` defines `options` as opaque literal texts and a tap replays
one verbatim as the user's own utterance. Classification is positional
(index 0 = affirmative), so the suite is language-agnostic by construction and
survived the translation untouched.

That leaves the question of whether anything still pins the label *content*.
It does: `src/assistant/api/__tests__/questions.test.ts` asserts
`['Xoá 3 việc', 'Giữ lại']` and is already updated. The labels are pinned by
the layer that owns them, so no coverage gap exists and no assertion was added
to this suite for them.

## Final verification

```
npx vitest run src/assistant/api        → 73 / 73 passed (6 files)
npx vitest run tests/assistant/api → 46 / 46 passed (1 file)
npm run typecheck                       → exit 0
npm run test:all                        → 217 / 217 passed (10 files)
```

## TC results

All 46 automated checks PASS. TC-14 is the only one whose expectation changed;
every other TC ran unmodified.

## Drift noted — outside this agent's subtree, not fixed

Reported to the orchestrator rather than corrected, since these belong to other
agents' subtrees:

1. **`src/assistant/web/__tests__/model.test.ts:430,434`** — builds its own
   `unsupported_query` outcome using the old English literal and asserts on it.
   Self-consistent, so it passes, but it is now pinned to a string the contract
   no longer uses; it would not notice a real mismatch against the server value.
   Owner: web-agent.
2. **`docs/qa/assistant/F-001/web/TC-002, TC-024, TC-030`** — quote the old English
   chip labels (`"Delete 3 tasks"` / `"Keep them"`) in preconditions and
   expected results. TC-024 is the WCAG 2.5.3 label-in-name case, where the
   quoted label is load-bearing. Owner: qa-web-agent (which the briefing notes
   has a parallel task in flight).
3. **`src/assistant/api/ports/fixture-table.ts:68`** — comment still cites the
   English chip labels. Cosmetic only; the classification it describes is
   positional and unaffected. Owner: backend-agent.

Note that `docs/specs/assistant/F-001-voice-assistant-view.md:102` (AC-15) describes
the alternative in English prose. This is **not** drift — it is a
natural-language description of intent, and api-contracts §9 carries the
authoritative literal plus its gloss.
