# TC-34: Validation matrix — 400 VALIDATION rows across turn, close, and task CRUD

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-34 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-1, AC-20 |
| Type | negative |
| Priority | P1 |
| Status | active |
| Automation | in-progress |
| Automation file | tests/assistant/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-16 by qa-api-agent |

## Summary
Every 400 VALIDATION row triggered with its exact precondition (§3.5, §3.6): missing/empty/wrong-type fields, bad uuids, bad enum values, malformed JSON. Each rejected request has **zero side effects** (no turn row, no task, no interpretation call). Null vs empty vs missing distinguished for `transcript`.

## Preconditions
- User `QAAPI-U1`; AI-call counter captured `{n0}`; task/session/message counts snapshotted.

## Test steps
| # | Method | Path | Headers | Body | Expected status | Assertions |
|---|--------|------|---------|------|-----------------|------------|
| 1 | POST | /assistant/turn | X-User-Id: {U1} | valid body minus `transcript` | 400 | `error.code: "VALIDATION"`, `error.field` names `transcript` |
| 2 | POST | /assistant/turn | X-User-Id: {U1} | `transcript: ""` | 400 | empty string rejected (contract: non-empty) |
| 3 | POST | /assistant/turn | X-User-Id: {U1} | `transcript: null` | 400 | null ≠ empty ≠ missing — all three rejected |
| 4 | POST | /assistant/turn | X-User-Id: {U1} | valid body minus `client_turn_id` | 400 | missing dedupe key rejected |
| 5 | POST | /assistant/turn | X-User-Id: {U1} | `client_turn_id: "not-a-uuid"` | 400 | bad uuid |
| 6 | POST | /assistant/turn | X-User-Id: {U1} | `source: "telepathy"` | 400 | bad `source` enum |
| 7 | POST | /assistant/turn | X-User-Id: {U1} | body is not valid JSON (`{"transcript": ...` truncated) | 400 | malformed JSON → VALIDATION envelope, not a 500 |
| 8 | POST | /assistant/session/close | X-User-Id: {U1} | `{reason: "user_closed"}` (no session_id) | 400 | missing field |
| 9 | POST | /assistant/session/close | X-User-Id: {U1} | `{session_id: {sid}, reason: "idle"}` | 400 | `idle` is server-only (contract: never via this endpoint) — session stays open |
| 10 | POST | /tasks | X-User-Id: {U1} | `{}` (no title) | 400 | task create validation |
| 11 | POST | /tasks | X-User-Id: {U1} | `{title: "qaapi-x", status: "bogus"}` | 400 | bad enum on create |
| 12 | PATCH | /tasks/{tid} | X-User-Id: {U1} | `{status: "bogus"}` | 400 | bad enum on edit; task unmodified on read-back |
| 13 | POST | /assistant/turn | X-User-Id: {U1} | valid body + unknown field `{..., foo: 1}` | 400 | **unknown-field rejection** (contract Conventions): `VALIDATION`, `error.field` names `foo`, zero side effects |
| 14 | POST | /assistant/session/close | X-User-Id: {U1} | valid body + `{..., force: true}` | 400 | same one-policy-for-every-endpoint rejection; session stays open |
| 15 | POST | /tasks | X-User-Id: {U1} | `{title: "qaapi-x", color: "red"}` | 400 | unknown field on CRUD too — no task created |
| 16 | — | after all steps | — | — | — | AI-call counter == `{n0}`; task count, session message count unchanged — **no rejected request left any trace** |

## Expected behaviour
Fail-fast validation before persistence and before interpretation: a 400'd turn must NOT appear in session history (contrast: a 502 AI_ERROR turn MUST — TC-26). That ordering is this TC's sharpest assertion.

## Test data
| Field | Value |
|-------|-------|
| user | QAAPI-U1 |
| bodies | mutation matrix above |

## Notes
Covers error rows: turn 400, close 400, POST /tasks 400, PATCH /tasks 400. AC-20's rejection half (non-text payload) is TC-37. Step 9's expected 400 derives from the contract's request comment; if implementation accepts it, that is drift to file. Steps 13–15 pinned 2026-08-16 (was index OQ 4): unknown request fields → `400 VALIDATION` naming the field, one policy for every endpoint (contract Conventions). Whitelist update (second pin, 2026-08-16): `id` is now a **documented** optional field on `POST /tasks` (`{id?, title, ...}`) — it is not an unknown-field probe target; TC-38 steps 7–9 cover its accept/collision behaviour. The `color` probe in step 15 remains a valid unknown field.
