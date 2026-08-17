# TC-01: Applying turn lands atomically and is visible on task-list read-back

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-01 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-1 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | in-progress |
| Automation file | qa/assistant/automation/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-16 by qa-api-agent |

## Summary
A spoken/typed sentence interpreted server-side applies its changes in the same turn, and the change is real: a subsequent `GET /tasks` (the read-back — the list, not the chat reply, is where the result lives) returns the created task. Asserts the full applied anatomy: `turn.status: applied`, `changed_task_ids` non-empty, `diff` rows with `old: null` for create.

## Preconditions
- Fixture Interpreter loaded with `utterance-intent-fixtures.json`.
- User `QAAPI-U1` (see `qa/_shared/fixtures/api/users.json`), no open session, no `qaapi-` tasks.
- Base URL from harness env (in-process supertest against `createApp` per platform doc — never hardcoded).

## Test steps
| # | Method | Path | Headers | Body | Expected status | Assertions |
|---|--------|------|---------|------|-----------------|------------|
| 1 | POST | /assistant/turn | X-User-Id: {U1} | `{session_id: null, client_turn_id: {id1}, transcript: "add a task qaapi-buy-milk", source: "voice"}` (row UT-CREATE-1) | 200 | `kind: "turn"`, `replayed: false`, `turn.status: "applied"`, `turn.outcome.kind: "applied"`, `changed_task_ids.length == 1`, `diff == [{task_id, field: "title", old: null, new: "qaapi-buy-milk"}, ...]` (old=null on every create field pair), `outcome.created_titles == ["qaapi-buy-milk"]` |
| 2 | GET | /tasks | X-User-Id: {U1} | — | 200 | exactly one task with `title: "qaapi-buy-milk"`; its `id` == the `changed_task_ids[0]` from step 1 |
| 3 | GET | /assistant/session | X-User-Id: {U1} | — | 200 | `session.messages` contains the turn from step 1 with the same outcome (late-render source for clients) |

## Expected behaviour
The applying turn's changes land within the same turn (AC-1); read-back proves persistence, not just response echo. No question object, no partial state.

## Test data
| Field | Value |
|-------|-------|
| user | QAAPI-U1 |
| utterance | fixture row UT-CREATE-1 |
| client_turn_id | fresh uuid per run |

## Notes
Step 2 is the anti-false-green inversion: a stub-only implementation that echoes the interpretation without persisting fails here.
