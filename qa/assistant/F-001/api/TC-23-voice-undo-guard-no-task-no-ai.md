# TC-23: Voice-undo guard — real revert, no turn row, no task named "undo", zero AI calls

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-23 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-5 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | in-progress |
| Automation file | qa/assistant/automation/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-16 by qa-api-agent |

## Summary
ADR-006 server backstop: a transcript normalizing into `UNDO_PHRASES` ("undo", "hoàn tác") sent to POST /assistant/turn is **not interpreted** (harness AI-call counter stays flat), creates **no turn row**, executes the real undo path against the newest applied turn, returns `kind: "undo"`, and can never become a task named "undo" (AC-5). Normalization variants (case, trim, terminal punctuation, NFC) all match; a longer paraphrase does not.

## Preconditions
- User `QAAPI-U1`; applied create turn (UT-CREATE-1) is the newest applied turn; AI-call counter value captured as `{n0}`; session message count captured.

## Test steps
| # | Method | Path | Headers | Body | Expected status | Assertions |
|---|--------|------|---------|------|-----------------|------------|
| 1 | POST | /assistant/turn | X-User-Id: {U1} | `{transcript: "undo", client_turn_id: {id1}, session_id: {sid}, source: "voice"}` (UT-UNDO-EN) | 200 | `kind: "undo"`, `turn: null`, `undo.undone: true`, `undo.via: "voice"`, `undo.reverted` names the created task |
| 2 | GET | /tasks | X-User-Id: {U1} | — | 200 | created task reverted away; **no task titled "undo"** (or any prefix/variant) exists |
| 3 | — | harness | — | — | — | AI-call counter still `{n0}` — the Interpreter was never called (fixture row `expect_no_interpreter_call`) |
| 4 | GET | /assistant/session | X-User-Id: {U1} | — | 200 | **no new turn row** for `{id1}`; the undone turn carries `undo_result.via: "voice"` with `transcript: "undo"` recorded (ADR-006/data-model) |
| 5 | — | repeat 1–4 with `"  Undo.  "` (UT-UNDO-NORM-1), `"HOÀN TÁC"` (UT-UNDO-NORM-2), `"hoàn tác"` (UT-UNDO-VI) against fresh applied turns | 200 | normalization: all short-circuit identically, counter never moves |
| 6 | POST | /assistant/turn | X-User-Id: {U1} | `{transcript: "undo the last thing", ...}` (UT-UNDO-NOT-GUARD) | 200 | boundary partner: NOT short-circuited — `kind: "turn"`, counter `{n0}+1`, outcome `no_match`; still zero task mutations |

## Expected behaviour
Deterministic guard by construction: exact normalized match on the closed phrase list, before the model, even when the model/stub is down. Dedupe: the outcome is recorded under `{id1}` — a replay of step 1's id re-serves the undo outcome without a second revert (asserted in automation, cross-ref TC-25). Pinned 2026-08-16: the guard targets the newest **mutating** applied turn (non-empty `changed_task_ids`) — intervening no_match/unsupported turns do not divert it (TC-40 step 7 covers the none-exists refusal).

## Test data
| Field | Value |
|-------|-------|
| user | QAAPI-U1 |
| utterances | UT-UNDO-EN / VI / NORM-1 / NORM-2 / NOT-GUARD |

## Notes
Equivalence classes: exact phrase (guard) vs longer utterance (model). The zero-AI-call assertion is the fixture table's spec-mandated undo-phrase row requirement.
