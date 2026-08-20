# TC-19: Undo refused when the turn's session is closed

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-19 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-6, AC-8 |
| Type | negative |
| Priority | P1 |
| Status | active |
| Automation | in-progress |
| Automation file | tests/assistant/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-16 by qa-api-agent |

## Summary
Session close ends the undo window (AC-8): undoing a turn of a closed session yields the visible 409 `UNDO_REFUSED / session_closed` refusal, for both close reasons (user_closed here; idle close variant rides TC-29's clock).

## Preconditions
- User `QAAPI-U1`; applied turn `{tid}` (UT-CREATE-1) in session `{sid}`; then `POST /assistant/session/close {session_id: {sid}, reason: "user_closed"}` → 200.

## Test steps
| # | Method | Path | Headers | Body | Expected status | Assertions |
|---|--------|------|---------|------|-----------------|------------|
| 1 | POST | /assistant/turn/{tid}/undo | X-User-Id: {U1} | `{via: "tap"}` | 409 | `{error: {code: "UNDO_REFUSED", detail: {reason: "session_closed", turn_id: {tid}}}}` |
| 2 | GET | /tasks | X-User-Id: {U1} | — | 200 | the created task still exists — nothing reverted |
| 3 | POST | /assistant/turn/{tid}/undo | X-User-Id: {U1} | `{via: "voice"}` | 409 | same refusal via voice path — never silence, never a task named "undo" (AC-8) |

## Expected behaviour
Closed session = no undo, by either gesture. The refusal is a visible outcome the client renders with its reason (AC-6); the state itself is untouched.

## Test data
| Field | Value |
|-------|-------|
| user | QAAPI-U1 |
| flow | apply → close(user_closed) → undo attempts |

## Notes
Triggers error-table row `409 UNDO_REFUSED/session_closed`. Idle-close boundary interaction (undo at 179 s OK / at 180 s refused) is exercised in TC-29 with the injectable clock.
