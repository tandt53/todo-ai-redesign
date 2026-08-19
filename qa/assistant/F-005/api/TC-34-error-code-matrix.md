# TC-34: The error-code matrix — one case per declared code

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-34 |
| Feature | F-005 (task-detail) |
| Platform | api |
| Acceptance criteria | AC-8, AC-13, AC-18, AC-21, AC-22, AC-25, AC-30, AC-37, AC-38, AC-41, AC-44 |
| Type | negative |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/api/F-005-task-detail.spec.ts (`describe('TC-34 …')`) |
| Created | 2026-08-19 by qa-api-agent |
| Last updated | 2026-08-19 by qa-api-agent |

## Summary
`api-contracts.md § New and changed error codes` declares three, and the F-005 routes inherit `401` and `404`. Reviewer C2 requires one case per declared code, and `_qa-foundations §3.5` adds the reason: "the uncommon ones are where auth bypass lives." Every `400 VALIDATION` reason the contract enumerates gets its own row, so a failure names one reason rather than the status code.

## Preconditions
- In-process harness: `createApp(deps)` with the `__qa__` doors mounted in front, on an ephemeral port, driven by supertest. Fresh durable store per test.
- The clock seam and the account zone are both held at `T0 = 2026-08-19T12:00:00.000Z` / `UTC` by `POST /__qa__/set-clock` (AC-44). Every fixture instant is derived from `T0`, never from a wall clock (L-023).
- A live row, a step, and a repeating row, so every enumerated reason has a subject.
- A second account and a deliberately zoneless client.

## Test steps (API)
| # | Case (automation `it` name) | Request | Expected |
|---|------------------------------|---------|----------|
| 1 | TC-34a 400 VALIDATION — every reason the contract enumerates | 12 rows: unknown field; illegal value; bad `parent_id`; a step given a repeat; a step given a parent; `until` AND `count`; `until` before due; clearing `due_at` while repeating; a bound exceeded; `scope=series` with no series; a non-creatable field; a non-patchable field | `400 VALIDATION` with a string message on every one |
| 2 | TC-34b 409 TIMEZONE_UNKNOWN — on every write door that computes a date | zoneless dated create; zoneless create with a repeat | `409 TIMEZONE_UNKNOWN`, `detail.header == 'X-Timezone'`, and nothing written in either case |
| 3 | TC-34c 409 REMINDER_MOVED, and 409 TASK_ID_EXISTS | ack a stale instant; re-`POST` an existing id | the two codes; and the existing row's title is never overwritten |
| 4 | TC-34d 401 UNAUTHENTICATED and 404 NOT_FOUND on every F-005 route | restore, reminder-ack, repeat-preview, `GET`/`PATCH /account`, with no and with empty `X-User-Id`; then cross-account and unknown ids | `401` on every route for both auth shapes; `404 NOT_FOUND` for cross-account and unknown, indistinguishable; the victim's row intact |

## Expected behaviour
- `400 VALIDATION` for each enumerated reason, asserted per reason.
- `409 TIMEZONE_UNKNOWN` names the header, and the refusal writes nothing (AC-18's rule).
- Cross-account and unknown ids are **indistinguishable** — no enumeration oracle on the two brand-new write paths.
- An empty `X-User-Id` is treated as absent, not as a user.

## Test data
| Field | Value |
|-------|-------|
| namespace | task titles `qaapi5-*`; reserved user ids in `qa/_shared/fixtures/api/f005-users.json`. No unscoped destructive operations (§10). |
| declared new codes | `409 TIMEZONE_UNKNOWN`, `409 REMINDER_MOVED`; plus `400 VALIDATION` with the enumerated reasons |

## Notes
- Two refusal **reasons** on the turn path are not reachable in this suite and are recorded rather than hidden: `step_not_addressable` (AC-35 removes steps from the handle list, so a turn cannot address one) and `nesting_too_deep` (the turn path offers no create-under-a-step shape). Both rules are covered at the HTTP door — TC-11a, TC-25b.
- *Would this notice?* Yes — a missing caller scope on either new route fails TC-34d; a silent fallback zone fails TC-34b.
