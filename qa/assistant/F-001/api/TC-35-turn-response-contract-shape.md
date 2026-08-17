# TC-35: Contract drift — exact response shapes, no undocumented fields

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-35 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-1, AC-16 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | in-progress |
| Automation file | qa/assistant/automation/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-16 by qa-api-agent |

## Summary
Contract-conformance sweep (§3.9-7): each endpoint's 200 body matches api-contracts **exactly** — all documented fields present with documented types/enums, and **no undocumented fields** (extra fields are drift that clients will silently start depending on). One representative response per outcome kind is schema-checked.

## Preconditions
- User `QAAPI-U1`; flows from prior TCs produce one response of each shape.

## Test steps
| # | Response under check | Producing call | Assertions |
|---|----------------------|----------------|------------|
| 1 | POST /assistant/turn 200 (kind=turn, applied) | UT-CREATE-1 | top-level keys ⊆ and ⊇ `{session_id, kind, replayed, turn, undo, resolutions}`; `undo: null` when kind=turn; `turn.outcome.kind` ∈ the 6 documented values |
| 2 | POST /assistant/turn 200 (kind=undo) | UT-UNDO-EN | `turn: null`, `undo` matches UndoOutcome keys exactly `{turn_id, undone, already_undone, reverted, skipped, nothing_reverted, via}` |
| 3 | 200 for asked turn | UT-DELETE-BULK-3 | `turn.question` keys == data-model Question fields; `options` all strings; `resolution: null` |
| 4 | GET /assistant/session 200 (open) | TC-31 flow | keys == `{session, boundary}`; Turn rows carry the data-model fields, incl. `seq`, `client_turn_id`, `status` enum values only |
| 5 | GET /assistant/session 200 (boundary) | TC-29 flow | Boundary keys == `{session_id, closed_at, close_reason, declined_questions, late_outcomes}`; `close_reason` ∈ {idle, user_closed} |
| 6 | POST /assistant/session/close 200 | TC-30 flow | keys == `{session, declined_question_turn_ids, already_closed}` |
| 7 | POST .../undo 200 | TC-15 flow | UndoOutcome exact-key check (as step 2) |
| 8 | error envelopes (one 4xx per endpoint) | TC-32/33/34 probes | every non-2xx body is exactly `{error: {code, message, detail?}}` — no stack traces, no internals (§3.9-2) |
| 9 | GET /tasks 200 | seeded state | `{tasks: [Task]}`; Task fields == data-model task list; no server-internal fields (no snapshot/dedupe internals leak) |

## Expected behaviour
Exact-shape equality both directions (missing AND extra fields fail). `turn.status` in responses only ever ∈ `{pending, applied, asked, failed, undone}`; timestamps iso8601-parseable.

## Test data
| Field | Value |
|-------|-------|
| user | QAAPI-U1 |
| method | key-set equality + type/enum checks per field, in automation |

## Notes
This is the drift tripwire for backend-agent's parallel implementation: it fails loudly the moment the wire shape diverges from api-contracts.md, which is the QA-independence point of authoring from contract, not code.
