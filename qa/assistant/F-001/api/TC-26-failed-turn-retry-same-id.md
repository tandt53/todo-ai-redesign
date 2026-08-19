# TC-26: AI error — 502 with persisted transcript; retry with the same id re-attempts

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-26 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-23, AC-24, AC-16 |
| Type | negative |
| Priority | P1 |
| Status | active |
| Automation | in-progress |
| Automation file | tests/assistant/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-16 by qa-api-agent |

## Summary
Failure path + the `failed → pending` dedupe branch (timeout-then-late-success injection from Test strategy): interpretation failure → 502 `AI_ERROR`, turn persisted `status: failed` **with the user's words** (AC-23), recorded in session messages; the client's retry re-sends the **same** `client_turn_id` and the server re-attempts — the words were never lost, and success applies exactly once.

## Preconditions
- User `QAAPI-U1`; fixture row UT-FAIL-1 armed to raise; harness will swap the row's interpretation to a create for the retry (late-success model).

## Test steps
| # | Method | Path | Headers | Body | Expected status | Assertions |
|---|--------|------|---------|------|-----------------|------------|
| 1 | POST | /assistant/turn | X-User-Id: {U1} | `{transcript: "qaapi trigger model failure", client_turn_id: {id1}, session_id: null, source: "voice"}` | 502 | envelope `{error: {code: "AI_ERROR"}, turn}` — body carries the persisted turn per contract; `turn.status: "failed"`, `turn.transcript_raw` == the transcript |
| 2 | GET | /assistant/session | X-User-Id: {U1} | — | 200 | the failed turn is in `session.messages` with its transcript (AC-23 — failed turns stay in history; retry needs no re-speaking) |
| 3 | GET | /tasks | X-User-Id: {U1} | — | 200 | zero mutations from the failed turn |
| 4 | POST | /assistant/turn | X-User-Id: {U1} | identical body, same `{id1}`, stub now succeeds | 200 | `failed → pending` re-attempt (contract rule 2): turn applies, `replayed: false` (a re-attempt, not a replay); outcome applied |
| 5 | GET | /tasks | X-User-Id: {U1} | — | 200 | exactly **one** created task — the retry did not double-apply |
| 6 | POST | /assistant/turn | X-User-Id: {U1} | replay same `{id1}` a third time | 200 | now status is `applied` → dedupe re-serves, `replayed: true`, still one task |

## Expected behaviour
State machine `pending → failed → pending → applied` exactly as data-model transitions; AC-24's api half (surface can offer retry because the error is explicit and the turn is recoverable under its id).

## Test data
| Field | Value |
|-------|-------|
| user | QAAPI-U1 |
| utterance | UT-FAIL-1 (armed → disarmed) |

## Notes
Triggers error-table row `502 AI_ERROR`. Step 4 asserting `replayed: false` distinguishes re-attempt from replay — per-status dedupe's whole point.
