# TC-29: Idle close via injectable clock — 180 s boundary, single boundary message, declined questions and late outcomes

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-29 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-28, AC-10, AC-8 |
| Type | boundary |
| Priority | P1 |
| Status | active |
| Automation | in-progress |
| Automation file | tests/assistant/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-16 by qa-api-agent |

## Summary
ADR-004 lazy idle close, run in test time via the fake `Clock` + `idleCloseMs`: boundary values at 180 s (advance 179 999 ms → still open; 180 000 ms → closed with reason `idle`). On the clean start, `GET /assistant/session` returns `session: null` plus **one** `Boundary` carrying the close marker, every question declined **by name**, and late outcomes resolved between last foreground and close. Idle close also ends the undo window.

## Preconditions
- User `QAAPI-U3`; open session with: an applied turn `{ta}` (undo affordance live), a pending bulk-delete question `{tq}` naming 3 `qaapi-shop-*` titles, and a turn `{tf}` that resolved `failed` after the client last foregrounded.
- Fake clock `now = T0` at last activity.

## Test steps
| # | Method | Path | Headers | Body | Expected status | Assertions |
|---|--------|------|---------|------|-----------------|------------|
| 1 | — | clock.advance(179 999 ms) then GET /assistant/session | X-User-Id: {U3} | — | 200 | **still open**: `session.status: "open"`, question pending — boundary value below threshold |
| 2 | — | clock.advance(+1 ms) (total 180 000) then GET /assistant/session | X-User-Id: {U3} | — | 200 | lazy close fired: `session: null`; `boundary.close_reason: "idle"`, `boundary.session_id == {sid}`, `closed_at` set |
| 3 | — | inspect `boundary` from step 2 | — | — | — | `declined_questions == [{turn_id: {tq}, kind: "bulk_delete", task_titles: [the 3 real titles]}]`; `late_outcomes` includes `{turn_id: {tf}, status: "failed"}`; exactly **one** boundary object (single boundary message, AC-28) |
| 4 | GET | /tasks | X-User-Id: {U3} | — | 200 | the 3 questioned tasks still exist — close-declines never execute |
| 5 | POST | /assistant/turn/{ta}/undo | X-User-Id: {U3} | `{via: "tap"}` | 409 | `UNDO_REFUSED / session_closed` — idle close ended the undo window (AC-8) |
| 6 | POST | /assistant/turn | X-User-Id: {U3} | fresh turn, `session_id: null` | 200 | a **new** session opens (clean start, not yesterday's session) |

## Expected behaviour
Close is server-owned and lazy: no waiting, no background timers — the fake clock is the only time source (Test strategy: injectable). Question declined by close is D2's final resolution event; `question.resolution.result == "declined"` on `{tq}`.

## Test data
| Field | Value |
|-------|-------|
| user | QAAPI-U3 |
| clock | fake Clock port; idleCloseMs = 180000 (production value, exercised in test time) |

## Notes
The ≥ comparison direction (contract: "idle ≥ 180 s is closed") makes 180 000 ms exactly the first closed instant — both edges asserted. GET-triggered close is the primary path; POST-turn-triggered lazy close is implicitly covered by TC-27's flow.
