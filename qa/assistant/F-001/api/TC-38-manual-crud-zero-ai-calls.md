# TC-38: Manual path — full task CRUD with zero AI calls, proven by the harness counter

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-38 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-18 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | in-progress |
| Automation file | qa/assistant/automation/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-16 by qa-api-agent |

## Summary
The manual path's api floor (AC-18, asserted via the harness AI-call counter per spec Test strategy; contract: "the AI-call counter must read zero for any pure-CRUD scenario"): create, edit, complete, and delete run entirely through /tasks endpoints and the Interpreter is **never** invoked. This is the guarantee AC-24/AC-25 fall back on when AI is erroring or offline.

## Preconditions
- User `QAAPI-U1`; AI-call counter captured `{n0}`.

## Test steps
| # | Method | Path | Headers | Body | Expected status | Assertions |
|---|--------|------|---------|------|-----------------|------------|
| 1 | POST | /tasks | X-User-Id: {U1} | `{title: "qaapi-manual-1", due_at: <D>, priority: <P>}` | 201 | `{task}` returned with server id; fields echoed |
| 2 | GET | /tasks | X-User-Id: {U1} | — | 200 | created task present |
| 3 | PATCH | /tasks/{id} | X-User-Id: {U1} | `{title: "qaapi-manual-1-edited"}` | 200 | edit lands; read-back confirms |
| 4 | PATCH | /tasks/{id} | X-User-Id: {U1} | `{status: "done"}` | 200 | complete = status edit |
| 5 | DELETE | /tasks/{id} | X-User-Id: {U1} | — | 200 | soft delete (`deleted_at` set per contract) |
| 6 | GET | /tasks | X-User-Id: {U1} | — | 200 | task absent from the list |
| 7 | POST | /tasks | X-User-Id: {U1} | `{id: {clientId}, title: "qaapi-offline-1"}` (client-generated uuid, pinned 2026-08-16) | 201 | `task.id == {clientId}` — the server honours the client id (offline local path, no temporary-id mapping) |
| 8 | POST | /tasks | X-User-Id: {U1} | identical body, same `{clientId}` (own-replay = reconnect sync) | 409 | `error.code: "TASK_ID_EXISTS"` — the client treats this as its already-synced ack; read-back: exactly **one** task with `{clientId}`, fields unchanged |
| 9 | POST | /tasks | X-User-Id: {U1} | `{id: {clientId}, title: "qaapi-different-title"}` (colliding id, different content) | 409 | same `TASK_ID_EXISTS`; the existing task is NOT overwritten (read-back: title still `qaapi-offline-1`) |
| 10 | — | harness | — | — | — | **AI-call counter == `{n0}`** — zero interpretation calls across all operations, incl. the client-id creates |

## Expected behaviour
All four list operations complete without the assistant; the counter is the proof (a code path that "helpfully" logs manual edits through the interpreter fails step 7).

## Test data
| Field | Value |
|-------|-------|
| user | QAAPI-U1 |
| tasks | qaapi-manual-* |

## Notes
AC-18 is spec-tagged (web, mobile) — its zero-AI-call **server** assertion is briefing-mandated at the api layer; UI touch-path halves belong to qa-web/mobile. Also covers the CRUD happy rows of the contract's supporting-endpoints table (201/200 shapes). Steps 7–9 pinned 2026-08-16: `POST /tasks` accepts optional client-generated `id` (`{id?, title, ...}`) with `409 TASK_ID_EXISTS` on collision — the mechanism AC-25's offline replay rides; also triggers that new error row. Omitted-id → server generates is step 1.
