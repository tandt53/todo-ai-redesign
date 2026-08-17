# Run record: F-001 API integration suite — QA re-sync to English + the retired undo phrase

| Field | Value |
|---|---|
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Agent | qa-api-agent |
| Phase | execute (T-070a — aligning QA expectations to a finished implementation, not fresh authoring) |
| Date | 2026-08-17 |
| Suite | `qa/assistant/automation/api/F-001-voice-assistant-view.spec.ts` |
| Command | `npx vitest run qa/assistant/automation/api` |
| Result | **before 43 / 46 (3 failed) → after 47 / 47 PASS** |
| Backend unit suite | `npx vitest run src/assistant/api` → **73 / 73 PASS** (untouched by this task) |
| Typecheck | `npx tsc --noEmit` → exit 0 |
| Project gate | `npm run test:all` → 482 / 482 PASS at 16:43:37; **463 / 482 at 16:44:34** — see "Aggregate footnote" |
| Bugs filed | none — all three failures were stale expectations, not product defects |

## Why this run happened

Two owner decisions of 2026-08-17 landed in `src/` before QA followed
(ADR-008 § Sequencing: *design leads; implementers follow; QA expectations last*).

| Decision | Where it is written | What moved |
|---|---|---|
| **ADR-008** — English is the product language | `reports/owner-decision-2026-08-17-english-first.md` | `UNSUPPORTED_QUERY_ALTERNATIVE`: `danh sách và bộ lọc trên màn hình` → `the on-screen list and its filters` |
| **ADR-006 § Amendment** — the closed undo list shrinks | ADR-006, contract processing rule 3 | `UNDO_PHRASES`: `{"undo", "hoàn tác"}` → `{"undo"}` |

## Baseline (before any edit)

```
npx vitest run qa/assistant/automation/api/F-001-voice-assistant-view.spec.ts
Test Files  1 failed (1)
     Tests  3 failed | 43 passed (46)

FAIL > honesty outcomes (TC-13, TC-14) > TC-14 unsupported_query names the alternative …
AssertionError: expected 'the on-screen list and its filters'
              to be 'danh sách và bộ lọc trên màn hình'          spec.ts:596

FAIL > AC-5 voice-undo guard (TC-23, TC-24) > TC-23 normalization variants all short-circuit …
AssertionError: expected 'turn' to be 'undo'                     spec.ts:753

FAIL > AC-5 voice-undo guard (TC-23, TC-24) > TC-24 voice undo with no applied turn …
Error: expected 409 "Conflict", got 200 "OK"                     spec.ts:768
```

## What changed, and why each is a stale-expectation fix rather than a weakened assertion

### 1. TC-14 — the `alternative` literal (red)

Re-synced from **`specs/assistant/api-contracts.md` §9 processing rule 9**, which
already carried `"the on-screen list and its filters"` before this task; the server
agrees with the contract. The assertion is still exact equality on a verbatim
literal that is never imported from `src/`, so re-wording the copy still fails it.

### 2. TC-24 — the phrase sent to the guard (red)

Steps 1/6 sent `"hoàn tác"`. That phrase is no longer in `UNDO_PHRASES`, so the
step would have exercised the ordinary turn path and **stopped testing the guard's
refusal branch at all** — the case would have gone green-for-the-wrong-reason had
the status expectation been relaxed. The phrase became `"undo"`; every assertion
(409 `UNDO_REFUSED / not_undoable`, zero AI calls, pending question untouched,
`client_turn_id` consumed and re-served on replay) is unchanged.

### 3. TC-23 — the normalization loop (red)

Was `['  Undo.  ', 'HOÀN TÁC', 'hoàn tác']`. Now `['  Undo.  ', 'UNDO', 'undo!']`
— trim+case+punctuation together, case alone, punctuation alone. Strengthened
while there: each iteration now also asserts `undo.undone: true` and reads the task
list back, so a guard that returned `kind: "undo"` without reverting anything fails.

### 4. TC-23 step 7 — new: the retirement itself (the case that did not exist)

Deleting the two Vietnamese cases would have left the change **asserted by
nothing**: a phrase silently dropped from a closed list produces no failing test
anywhere, because every surviving assertion is about the phrase that stayed. So
the coverage was moved rather than removed. Step 7 sends `"hoàn tác"` and asserts
the point-for-point negation of step 1: `kind: "turn"` not `"undo"`, `undo: null`,
AI-call counter **+1** (it reaches the interpreter now), outcome `no_match` with
`heard_transcript == "hoàn tác"`, a **new turn row exists** (the guard path creates
none), no task by that title, the applied create **not** reverted, and the undo
window unspent — a subsequent tap undo still succeeds.

The QA fixture interpreter is deliberately given **no rule** for the phrase, so it
must fall through to the default `no_match`; a rule added there later would make
step 7 stop asserting the path it names (L-006's shape).

**Proven falsifiable.** `src/assistant/api/engine/normalize.ts` was mutated
(`['undo']` → `['undo', 'hoàn tác']`), the suite re-run, and step 7 alone went red:

```
FAIL > TC-23 the retired phrase "hoàn tác" is an ordinary turn …
AssertionError: expected 'undo' to be 'turn'
Tests  1 failed | 46 passed (47)
```

The file was then restored from a scratch copy and verified byte-identical by
checksum (`cksum` = `2327660788 869` before and after). **`git checkout --` was not
used**: T-073's edit to that file is uncommitted, so checking out HEAD would have
destroyed it — L-001's hazard in a form the entry does not name.

### 5. Coverage that went away with the phrase, named rather than dropped

ADR-006's normalization contract is trim · lowercase · **Unicode NFC** · strip
terminal punctuation. The NFC clause now has **no fixture row and no assertion
anywhere in this tier**: the closed list is the single ASCII phrase `"undo"`, which
has no decomposed form. ADR-006 § Amendment keeps NFC deliberately (it is the
engine-wide utterance-normalization contract, not a Vietnamese affordance). This is
an unasserted clause, not a removed one — it becomes testable the moment a
non-ASCII phrase enters the list. Recorded in TC-23 § Notes and on UT-UNDO-NORM-2.

## Canonical fixture table (L-004 twin)

`qa/assistant/F-001/api/utterance-intent-fixtures.json` is the QA half of the twin;
`src/assistant/api/ports/fixture-table.ts` is the implementation half.
**Neither twin was used as the source.** Both were checked against
`specs/assistant/api-contracts.md` rule 3 + §9 and ADR-006 § Amendment, and the QA
copy was written from those. Rows: 24 → 25.

| Row | Was | Now |
|---|---|---|
| `UT-UNDO-VI` → `UT-UNDO-RETIRED-VI` | `hoàn tác`, `kind: undo_guard`, `expect_no_interpreter_call: true` | same utterance, `kind: no_match`, `expect_no_interpreter_call: false`, ACs `AC-5, AC-14` |
| `UT-UNDO-NORM-2` | `HOÀN TÁC` (uppercase + NFC) | `UNDO` (case alone) |
| `UT-UNDO-NORM-3` | — | `undo!` (terminal punctuation alone) — new |
| `UT-LISTQ-1` note | Vietnamese `alternative` gloss | English literal, cited to api-contracts §9 |

## Aggregate footnote — `npm run test:all` (L-003)

Two aggregate runs, seven minutes apart, disagree, and the cause is **not** in this
tier:

```
16:43:37   Test Files  18 passed (18)      Tests  482 passed (482)
16:44:34   Test Files  3 failed | 15 passed (18)   Tests  19 failed | 463 passed (482)
```

Both runs include every edit in this record. Between them,
`design/_shared/components.md` was rewritten at **16:43:44** by a parallel dispatch.
All 19 failures are in the **mobile** tier and have one shape — design's catalogue
now publishes English while `src/assistant/mobile/model/permissions.ts` still holds
Vietnamese literals:

```
FAIL src/assistant/mobile/__tests__/permissions.test.ts > IOS-ASK is quoted verbatim …
AssertionError: expected 'Asking for microphone access' to be 'Xin phép dùng micro'
```

Failing files: `src/assistant/mobile/__tests__/permissions.test.ts`,
`src/assistant/mobile/__tests__/touch-keyboard-back.test.ts`,
`qa/assistant/automation/mobile/F-003-mobile-surface.spec.ts`. This is L-008's
parse-the-owning-artifact mechanism working as designed — it fails in the direction
drift actually travels — caught mid-flight between design landing and mobile
following. **No bug filed:** this is known in-flight sequencing work, not a
triaged product defect, and filing it would be filing a bug against a task that is
still running. Routed to the orchestrator in the return summary instead.

The api tier is green in both runs:
`npx vitest run qa/assistant/automation/api` → 47/47,
`npx vitest run src/assistant/api` → 73/73.

## Files changed

| File | Change |
|---|---|
| `qa/assistant/automation/api/F-001-voice-assistant-view.spec.ts` | 3 red assertions re-synced; 1 test added (TC-23 step 7); normalization loop strengthened; 2 header comments corrected |
| `qa/assistant/F-001/api/utterance-intent-fixtures.json` | UT-UNDO-VI repurposed → UT-UNDO-RETIRED-VI; NORM-2 re-pointed; NORM-3 added; UT-LISTQ-1 note re-synced |
| `qa/assistant/F-001/api/TC-23-voice-undo-guard-no-task-no-ai.md` | summary, steps 5 + 7, expected behaviour, notes |
| `qa/assistant/F-001/api/TC-24-voice-undo-no-applied-turn-refusal.md` | summary, steps 1–2, test data |
| `qa/assistant/F-001/api/TC-14-unsupported-query-names-alternative.md` | summary, step 1, notes (twin-home note added) |
| `qa/assistant/F-001/api/index.md` | re-sync banner, AC-5 and AC-14 coverage rows |
