# TC-08: Unclassifiable answer executes nothing — question stays pending and resolvable

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-08 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-10 |
| Type | negative |
| Priority | P1 |
| Status | active |
| Automation | in-progress |
| Automation file | qa/assistant/automation/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-16 by qa-api-agent |

## Summary
The spec-mandated ambiguous-answer case (Test strategy fixture requirement): an utterance that is not affirmative, not negative, and not an interpretable command executes **nothing** — asserting **zero deletion** — and the question stays pending, still resolvable by exactly D2's events (answer, supersede, session close).

## Preconditions
- User `QAAPI-U1`, 3 `qaapi-shop-*` tasks seeded, bulk-delete question pending (asked turn `{qid}`, session `{sid}`).

## Test steps
| # | Method | Path | Headers | Body | Expected status | Assertions |
|---|--------|------|---------|------|-----------------|------------|
| 1 | POST | /assistant/turn | X-User-Id: {U1} | `{transcript: "hmm maybe", client_turn_id: {id2}, session_id: {sid}, source: "voice"}` (UT-ANS-AMBIG-1) | 200 | `outcome.kind: "unclassifiable"`, `outcome.question_turn_id == {qid}`, `resolutions == []` (nothing resolved) |
| 2 | GET | /tasks | X-User-Id: {U1} | — | 200 | **all 3 tasks still present** — zero deletion |
| 3 | GET | /assistant/session | X-User-Id: {U1} | — | 200 | asked turn `{qid}` still has `question.resolution: null` — pending, no timeout |
| 4 | POST | /assistant/turn | X-User-Id: {U1} | `{transcript: "what do you mean", client_turn_id: {id3}, ...}` (UT-ANS-AMBIG-2) | 200 | second unclassifiable in a row: same outcome, still zero deletion, still pending |
| 5 | POST | /assistant/turn | X-User-Id: {U1} | `{transcript: "yes", client_turn_id: {id4}, ...}` (UT-ANS-YES-1) | 200 | the question is **still resolvable**: `result: "executed"`, the 3 tasks now deleted |

## Expected behaviour
Unclassifiable ≠ decline and ≠ execute (AC-10). The dangerous false-green is an implementation that treats "anything not negative" as affirmative — step 2 is the inversion that catches it.

## Test data
| Field | Value |
|-------|-------|
| user | QAAPI-U1 |
| utterances | UT-ANS-AMBIG-1, UT-ANS-AMBIG-2, then UT-ANS-YES-1 |

## Notes
Both spec-mandated ambiguous fixture rows are exercised. Equivalence class boundary: unclassifiable vs interpretable-command (TC-07) — the fixture row's classification is the only difference; the observable behaviours must differ exactly as specced.
