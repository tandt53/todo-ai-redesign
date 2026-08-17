# TC-008: Undo by voice — "undo" reverts and never becomes a task

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-008 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-5, AC-8 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-web-agent |
| Last updated | 2026-08-17 by qa-web-agent (T-070b — ADR-008 English copy sync) |

## Summary
Undo is reachable by voice: saying "undo" undoes the newest applied turn and never becomes a task with that name (voice-undo guard, ADR-006 in api-contracts: the turn is not interpreted, `kind: "undo"` returns). When no applied turn exists, the voice undo yields AC-8's visible refusal — never silence, never a task named "undo" (mockup `nothing-reverted` state, second exchange).

**Vocabulary note (T-070b).** This case used to name two phrases, "undo" and the Vietnamese "hoàn tác", and step 3 fed the second one so the pass doubled as an equivalence check across AC-5's vocabulary. ADR-008 (owner decision 2026-08-17) retired "hoàn tác": `UNDO_PHRASES` is now `['undo']` alone (`src/assistant/api/engine/normalize.ts:9`) and no fixture row sits behind the Vietnamese phrase, so feeding it today produces a no-match, not an undo. The case is NOT deleted and its guarantee is NOT weakened — what it protects is "an undo phrase never becomes a task and never reaches the model, and out of window it refuses visibly", which still holds and is still asserted, now over a one-member vocabulary. If a second phrase is ever added, step 3 is where it gets its equivalence check back.

## Preconditions
- Open session. User `qaweb-tc008@qa.example.com`; baseline seed tasks.
- Newest applied turn exists (same setup as TC-007). Injectable transcript source.
- Turn stub honours the voice-undo guard: `kind: "undo"`, `undo: UndoOutcome`.

## Test steps
1. Tap mic; feed transcript exactly "undo" (fixture `WEB-T4a`); end speech.
2. Read conversation, list, and list row titles.
3. Re-seed to a session with NO applied turn (clean session). Tap mic; feed "undo" again (fixture `WEB-T4a`); end speech.
4. Read conversation and list row titles again.

## Expected behaviour
- **AC-5**: Step 1–2: the turn reverts (same observable as TC-007: list read-back shows prior values); the user's voice bubble shows "Undo"; the reverted outcome message renders.
- **Never a task**: after both steps, NO task row titled "undo" / "Undo" exists in the list (bounded check: scan all row titles). The falsifiability is real, not notional: the canonical fixture table carries a tripwire row mapping the utterance "undo" to a *create* of a task titled "undo" (`src/assistant/api/ports/fixture-table.ts`), so if the ADR-006 guard ever stopped short-circuiting, this assertion fails rather than passing quietly.
- **AC-8 (no window)**: Step 3–4: a visible refusal message renders ("There is nothing to undo — nothing has been applied in this session.", per mockup `nothing-reverted` second exchange and api-contracts 409 `not_undoable`) — not silence, and still no task created.

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc008@qa.example.com |
| transcripts | fixture row `WEB-T4a` ("undo") — the whole of AC-5's undo vocabulary since ADR-008 |

## Notes
Mechanism is Open Question 6 / ADR-006; the TC asserts the fixed NEED (AC-5) via observables only: revert happened, no task materialized, refusal visible when out of window.
