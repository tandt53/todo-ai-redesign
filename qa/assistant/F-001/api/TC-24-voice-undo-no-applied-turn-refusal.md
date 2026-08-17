# TC-24: Voice undo with no applied turn — visible refusal, nothing created

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-24 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-5, AC-8 |
| Type | negative |
| Priority | P1 |
| Status | active |
| Automation | in-progress |
| Automation file | qa/assistant/automation/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-16 by qa-api-agent |

## Summary
Voice-guard refusal path: "undo" arriving when the open session has **no mutating applied turn** yields the visible 409 `UNDO_REFUSED / not_undoable` (contract undo error table: "(voice-guard path) no mutating applied turn exists" — pinned 2026-08-16; a session holding only non-mutating applied turns refuses identically, TC-40 step 7) — never silence, never a task named "undo" (AC-8), and no Interpreter call.

## Preconditions
- User `QAAPI-U3` (clean account): open session with only an asked turn pending (UT-DELETE-BULK-3 over seeded tasks) — no applied turn. AI-call counter captured `{n0}`.

## Test steps
| # | Method | Path | Headers | Body | Expected status | Assertions |
|---|--------|------|---------|------|-----------------|------------|
| 1 | POST | /assistant/turn | X-User-Id: {U3} | `{transcript: "hoàn tác", client_turn_id: {id1}, session_id: {sid}, source: "voice"}` (UT-UNDO-VI) | 409 | `{error: {code: "UNDO_REFUSED", detail: {reason: "not_undoable"}}}` — visible refusal outcome |
| 2 | GET | /tasks | X-User-Id: {U3} | — | 200 | task table unchanged; no task titled "hoàn tác" or "undo" |
| 3 | — | harness | — | — | — | AI-call counter still `{n0}` — guard fired before interpretation even on the refusal path |
| 4 | GET | /assistant/session | X-User-Id: {U3} | — | 200 | pending question untouched (`resolution: null`) — the undo phrase is not an answer and must not resolve it; no new turn row |
| 5 | POST | /assistant/turn | X-User-Id: {U3} | an applying turn (UT-CREATE-1 row), fresh id | 200 | an applied turn now exists — arming step 6's replay trap |
| 6 | POST | /assistant/turn | X-User-Id: {U3} | **same `{id1}`**, same body as step 1 | 409 | the refusal was recorded under `{id1}` (guard dedupe record, data-model): the retry **re-serves the recorded `UNDO_REFUSED`** without re-evaluating — it must NOT undo the turn applied in step 5; `GET /tasks` confirms step 5's task still present |

## Expected behaviour
The guard's refusal is the same visible AC-6-style outcome; a pending question is not affected (an undo phrase is neither affirmative nor a superseding command — it never reaches the resolver).

## Test data
| Field | Value |
|-------|-------|
| user | QAAPI-U3 |
| utterance | UT-UNDO-VI with no applied turn in session |

## Notes
Pinned 2026-08-16 (was index OQ 2): contract rule 3 + turn error-table `409 UNDO_REFUSED` row — a guard refusal creates no turn row but **consumes** the `client_turn_id` via a dedupe record (data-model, Dedupe retention); a same-id retry re-serves the recorded refusal and never undoes a turn applied in between. Steps 5–6 assert exactly that trap.
