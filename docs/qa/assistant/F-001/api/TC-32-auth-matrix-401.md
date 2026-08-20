# TC-32: Auth matrix — 401 UNAUTHENTICATED on every endpoint without X-User-Id

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-32 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-1 |
| Type | security |
| Priority | P1 |
| Status | active |
| Automation | in-progress |
| Automation file | tests/assistant/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-16 by qa-api-agent |

## Summary
Every protected path enforces auth (§3.8): missing or empty `X-User-Id` → `401 UNAUTHENTICATED` with the error envelope, and **zero side effects**. Covers the 401 row of all eight endpoints in the contract. (Anchored to AC-1's api scope as the feature's mutation surface; the 401 rows themselves are contract error-table obligations.)

## Preconditions
- User `QAAPI-U1` has one seeded task `{tid}` and an open session `{sid}` (targets for the authenticated-id-in-path probes).

## Test steps
| # | Method | Path | Headers | Body | Expected status | Assertions |
|---|--------|------|---------|------|-----------------|------------|
| 1 | POST | /assistant/turn | (no X-User-Id) | valid UT-CREATE-1 body | 401 | `error.code: "UNAUTHENTICATED"`; then `GET /tasks` as U1: no task created |
| 2 | POST | /assistant/turn | X-User-Id: "" (empty) | valid body | 401 | empty ≡ missing (contract: "Missing/empty") |
| 3 | GET | /assistant/session | (none) | — | 401 | envelope only — no session data leaked |
| 4 | POST | /assistant/session/close | (none) | `{session_id: {sid}, reason: "user_closed"}` | 401 | session `{sid}` remains open afterwards |
| 5 | POST | /assistant/turn/{turn}/undo | (none) | `{via: "tap"}` | 401 | no revert happened |
| 6 | GET | /tasks | (none) | — | 401 | — |
| 7 | POST | /tasks | (none) | `{title: "qaapi-x"}` | 401 | not created |
| 8 | PATCH | /tasks/{tid} | (none) | `{title: "qaapi-hacked"}` | 401 | task unmodified |
| 9 | DELETE | /tasks/{tid} | (none) | — | 401 | task still present |

## Expected behaviour
Uniform 401 + envelope; every mutating probe is paired with a read-back proving the operation did not run. No endpoint is accidentally public.

## Test data
| Field | Value |
|-------|-------|
| targets | U1's seeded task + session ids in paths |

## Notes
Covers error rows: turn 401, session GET 401, close 401, undo 401, tasks GET/POST/PATCH/DELETE 401.
