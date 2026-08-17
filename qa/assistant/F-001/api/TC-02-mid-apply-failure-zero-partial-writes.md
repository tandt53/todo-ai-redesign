# TC-02: Mid-apply store failure leaves zero partial writes

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-02 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-1 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | in-progress |
| Automation file | qa/assistant/automation/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-16 by qa-api-agent |

## Summary
Atomicity under failure (spec Test strategy failure injection, AC-1 all-or-nothing): a 3-task applying turn whose store fails on the 2nd write must leave **zero** of the 3 tasks — never 1 of 3. Data-integrity signal category (§3.9-6).

## Preconditions
- Harness wraps the memory `Store` port with a fault injector: fail the 2nd task write inside the apply of row UT-CREATE-3.
- User `QAAPI-U1`, no `qaapi-` tasks.

## Test steps
| # | Method | Path | Headers | Body | Expected status | Assertions |
|---|--------|------|---------|------|-----------------|------------|
| 1 | POST | /assistant/turn | X-User-Id: {U1} | `{session_id: null, client_turn_id: {id1}, transcript: "add qaapi-pack-bags, qaapi-book-taxi and qaapi-print-tickets", source: "typed"}` with store fault armed | 500 | `{error: {code: "APPLY_FAILED"}, turn}` — body carries the persisted turn (contract rule 6 + error table); `turn.status: "failed"`, `turn.transcript_raw` == the transcript (AC-23) |
| 2 | GET | /tasks | X-User-Id: {U1} | — | 200 | **zero** tasks titled `qaapi-pack-bags` / `qaapi-book-taxi` / `qaapi-print-tickets` — not one, not two |
| 3 | GET | /assistant/session | X-User-Id: {U1} | — | 200 | the turn is recorded (transcript preserved, AC-23) and its status is NOT `applied`; `changed_task_ids` empty |
| 4 | POST | /assistant/turn | X-User-Id: {U1} | same body, same `{id1}`, fault disarmed | 200 | retry under the same id applies all 3 atomically (`failed → pending` re-attempt, AC-16); `GET /tasks` now returns exactly 3 `qaapi-` tasks |

## Expected behaviour
All-or-nothing (AC-1): the observable contract is steps 2–3 — the task table shows 0 of 3 after the fault, 3 of 3 after the clean retry. Never a partial count.

## Test data
| Field | Value |
|-------|-------|
| user | QAAPI-U1 |
| utterance | fixture row UT-CREATE-3 |
| fault | store write #2 inside apply transaction |

## Notes
Pinned 2026-08-16 (was index OQ 1): contract rule 6 + error-table row `500 APPLY_FAILED` — apply transaction aborts atomically, turn resolves `failed` with transcript preserved, same-id retry re-attempts (`failed → pending`). This TC now also triggers that error row.
