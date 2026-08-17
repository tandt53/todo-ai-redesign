# TC-05: Affirmative answer executes the bulk delete with full applied anatomy

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-05 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-10, AC-9 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | in-progress |
| Automation file | qa/assistant/automation/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-16 by qa-api-agent |

## Summary
Only a clearly affirmative answer executes (AC-10). The answer travels as a **normal turn** on POST /assistant/turn — no separate confirm protocol. The executed outcome carries the full applied anatomy (count, titles, changed_task_ids) and the resolution is recorded on the asked turn (`question.resolution`), reported in `resolutions[]`.

## Preconditions
- User `QAAPI-U1`, seeded `qaapi-shop-eggs`, `qaapi-shop-bread`, `qaapi-shop-cheese`; bulk-delete question pending from row UT-DELETE-BULK-3 (as TC-03 step 1, asked turn id = `{qid}`).

## Test steps
| # | Method | Path | Headers | Body | Expected status | Assertions |
|---|--------|------|---------|------|-----------------|------------|
| 1 | POST | /assistant/turn | X-User-Id: {U1} | `{transcript: "yes", client_turn_id: {id2}, session_id: {sid}, source: "voice"}` (UT-ANS-YES-1) | 200 | `turn.outcome.kind: "resolution"`, `outcome.result: "executed"`, `outcome.question_turn_id == {qid}`, `outcome.executed` carries full applied anatomy: 3 deleted titles named, actual count 3, `changed_task_ids` of the 3 | 
| 2 | GET | /tasks | X-User-Id: {U1} | — | 200 | all 3 `qaapi-shop-*` tasks gone; no other `qaapi-` task touched |
| 3 | GET | /assistant/session | X-User-Id: {U1} | — | 200 | asked turn `{qid}` has `question.resolution.result: "executed"`, `resolved_by_turn_id == {turn2}` — one-shot record |
| 4 | POST | /assistant/turn | X-User-Id: {U1} | `{transcript: "đúng vậy, xoá đi", ...}` (UT-ANS-YES-2) against a second pending question in a fresh context | 200 | Vietnamese affirmative behaves identically (equivalence class: affirmative) |

## Expected behaviour
Affirmative → execute, visible executed outcome; `resolutions[] == [{question_turn_id, result: "executed"}]`. The executed outcome is undoable like any applied turn (AC-11 cross-ref; undo itself is TC-15..17 territory).

## Test data
| Field | Value |
|-------|-------|
| user | QAAPI-U1 |
| utterances | UT-DELETE-BULK-3 → UT-ANS-YES-1 / UT-ANS-YES-2 |

## Notes
Answer classification (affirmative) comes from the fixture row; execution, resolution recording and deletion run real — a green here with a stubbed resolver would be testing the stub (spec Test strategy anti-pattern).
