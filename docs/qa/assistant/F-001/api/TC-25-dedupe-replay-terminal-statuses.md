# TC-25: Per-status dedupe — applied / asked / undone replays re-serve without re-executing

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-25 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-16 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | in-progress |
| Automation file | tests/assistant/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-16 by qa-api-agent |

## Summary
Dedupe is per-status (AC-16, contract rule 2): replaying a `client_turn_id` whose turn is `applied`, `asked`, or `undone` re-serves the recorded outcome with `replayed: true` and re-executes **nothing**. Decision table over the three terminal statuses.

## Preconditions
- User `QAAPI-U1`. Three prepared turns: T-applied (UT-CREATE-1, id `{ida}`), T-asked (UT-DELETE-BULK-3, id `{idq}`), T-undone (UT-EDIT-1 applied then undone, id `{idu}`).

## Test steps
| # | Method | Path | Headers | Body | Expected status | Assertions |
|---|--------|------|---------|------|-----------------|------------|
| 1 | POST | /assistant/turn | X-User-Id: {U1} | replay `{ida}` — identical body | 200 | `replayed: true`, same applied outcome; `GET /tasks` shows **one** `qaapi-buy-milk`, not two |
| 2 | POST | /assistant/turn | X-User-Id: {U1} | replay `{idq}` — identical body | 200 | `replayed: true`, the same question re-served; `GET /assistant/session` shows **one** asked turn, question not duplicated, resolution state unchanged |
| 3 | POST | /assistant/turn | X-User-Id: {U1} | replay `{idu}` — identical body | 200 | `replayed: true`, recorded outcome served; the undone turn is not re-applied and not re-undone; task state unchanged |
| 4 | POST | /assistant/turn | X-User-Id: {U1} | replay `{ida}` with a **different transcript**, same id | 409 | `{error: {code: "CLIENT_TURN_ID_REUSED"}}` — divergent `transcript`/`source`/`answer_to_turn_id` is id **reuse**, not replay; **nothing executes** (read-back: still one `qaapi-buy-milk`) |
| 5 | POST | /assistant/turn | X-User-Id: {U1} | replay `{ida}` byte-identical except `session_id`/`timezone` | 200 | `replayed: true` — `session_id` and `timezone` are excluded from the comparison (a post-close replay legitimately carries a different session, contract rule 2) |

## Expected behaviour
Idempotency across the retry loop the client actually runs (`client.outgoing_turn` re-sends the same id). Read-backs are the false-green inversion: response-only assertions would miss a double apply.

## Test data
| Field | Value |
|-------|-------|
| user | QAAPI-U1 |
| ids | one uuid per prepared turn, replayed verbatim |

## Notes
`pending` replay → TC-28 (IN_FLIGHT). `failed` replay → TC-26. Post-close replay → TC-27. Steps 4–5 pinned 2026-08-16 (was index OQ 3): contract rule 2 + error-table row `409 CLIENT_TURN_ID_REUSED` — comparison covers `transcript`/`source`/`answer_to_turn_id`, excludes `session_id`/`timezone`. Also triggers that new error row.
