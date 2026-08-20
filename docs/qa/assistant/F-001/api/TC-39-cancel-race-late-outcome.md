# TC-39: Cancel racing apply — a sent turn always completes; late outcome served with Undo

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-39 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-3, AC-28 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | in-progress |
| Automation file | tests/assistant/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-16 by qa-api-agent |

## Summary
The spec-mandated cancel-racing-apply injection (Test strategy; AC-3's server half): cancel is client-local, there is **no cancel endpoint**, and a turn that has been sent always runs to completion server-side. The "cancelled" client later reads the truthful late outcome — applied + undoable — from `GET /assistant/session`; the server never pretends the cancel won.

## Preconditions
- User `QAAPI-U1`; stub Interpreter armed with latency on UT-CREATE-1 so the turn is in flight long enough for a client-side cancel to have "happened".

## Test steps
| # | Method | Path | Headers | Body | Expected status | Assertions |
|---|--------|------|---------|------|-----------------|------------|
| 1 | POST | /assistant/turn | X-User-Id: {U1} | UT-CREATE-1 body, `client_turn_id: {id1}` (client "cancels" mid-flight — which sends **nothing**: no second request exists to send) | 200 (when it completes) | turn ran to completion: `turn.status: "applied"` |
| 2 | GET | /tasks | X-User-Id: {U1} | — | 200 | the task exists — the cancel did not, and could not, stop the apply |
| 3 | GET | /assistant/session | X-User-Id: {U1} | — | 200 | the turn appears in messages as applied with diff — the late outcome a re-opening client renders (never pretending the cancel won) |
| 4 | POST | /assistant/turn/{tid}/undo | X-User-Id: {U1} | `{via: "tap"}` | 200 | the late outcome is undoable — "applied + Undo" exactly as AC-3 words it |
| 5 | — | route probe | — | `POST /assistant/turn/{tid}/cancel` and `POST /assistant/cancel` | non-2xx (404/405-class) | deliberately-absent endpoint stays absent: no route quietly implements cancel |

## Expected behaviour
Server-side, cancel is a non-event. The question/failed variants of the late outcome are already pinned by TC-03/TC-26 (their outcomes are likewise served by GET regardless of client attention); this TC pins the applied variant the spec highlights.

## Test data
| Field | Value |
|-------|-------|
| user | QAAPI-U1 |
| latency | stub delay on UT-CREATE-1 for this test |

## Notes
AC-3 is spec-tagged (web, mobile); this api TC exists because the spec's api Test strategy names the injection explicitly. Step 5 asserts absence — the exact status for unknown routes is unpinned; any non-2xx passes, and a 2xx is a HIGH-severity contract violation.
