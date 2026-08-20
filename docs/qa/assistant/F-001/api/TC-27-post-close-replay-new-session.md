# TC-27: Replay after session close — 409 SESSION_CLOSED, re-sync, same id recognized in the new session

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-27 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-16, AC-28 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | in-progress |
| Automation file | tests/assistant/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-16 by qa-api-agent |

## Summary
Hard-won round-2 semantics of AC-16's account-level scope: a replay arriving **after session close** targets the new session and the `client_turn_id` is still recognized. The explicit-closed-session path 409s with `SESSION_CLOSED`; the client re-syncs via GET and re-sends the **same** id.

## Preconditions
- User `QAAPI-U3`; session `{sid1}` open; a queued offline turn body built with `session_id: {sid1}`, `client_turn_id: {id1}` — NOT yet sent. Session `{sid1}` then closed (`user_closed`).

## Test steps
| # | Method | Path | Headers | Body | Expected status | Assertions |
|---|--------|------|---------|------|-----------------|------------|
| 1 | POST | /assistant/turn | X-User-Id: {U3} | the queued body with explicit `session_id: {sid1}` | 409 | `{error: {code: "SESSION_CLOSED"}}` — closed sessions accept no turns |
| 2 | GET | /assistant/session | X-User-Id: {U3} | — | 200 | `session: null` + `boundary` for `{sid1}` (re-sync step; boundary content is TC-29/30 territory) |
| 3 | POST | /assistant/turn | X-User-Id: {U3} | same body but `session_id: null`, **same `{id1}`** | 200 | turn applies in a **new** session (`session_id != {sid1}`); `replayed: false` |
| 4 | POST | /assistant/turn | X-User-Id: {U3} | replay same `{id1}` again | 200 | `replayed: true` — the id is recognized **across the session boundary** (account-scoped unique `(user_id, client_turn_id)`, ADR-005) |
| 5 | GET | /tasks | X-User-Id: {U3} | — | 200 | exactly one task from this turn — no double apply across sessions |

## Expected behaviour
Dedupe outlives sessions (retention ≥ offline replay window, floor 7 days); the SESSION_CLOSED → re-sync → same-id replay loop is exactly the documented client recovery (`client.outgoing_turn` ack rule, data-model).

## Test data
| Field | Value |
|-------|-------|
| user | QAAPI-U3 |
| flow | close {sid1} → send stale-session turn → re-sync → resend same id ×2 |

## Notes
Triggers error-table row `409 SESSION_CLOSED`. Step 4 is the briefing's "post-close replay recognition" assertion.
