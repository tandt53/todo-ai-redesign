# TC-25: A step is in no collection, in no count, and is not a handle

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-25 |
| Feature | F-005 (task-detail) |
| Platform | api |
| Acceptance criteria | AC-35, AC-36 |
| Type | security |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/api/F-005-task-detail.spec.ts (`describe('TC-25 …')`) |
| Created | 2026-08-19 by qa-api-agent |
| Last updated | 2026-08-19 by qa-api-agent |

## Summary
"The handle list is the sharpest of the five" readers: a task with eight steps contributes **nine** handles today, "so the assistant can rename, complete and bulk-delete steps by name and read step titles aloud in a `bulk_delete` confirmation. And because F-001 AC-31's door opens by bringing a row into view **in the task list**, which this AC makes empty for a step, the assistant would report changing a task and **the link would be inert with no explanation**." Excluding steps from the handle list closes both.

## Preconditions
- In-process harness: `createApp(deps)` with the `__qa__` doors mounted in front, on an ephemeral port, driven by supertest. Fresh durable store per test.
- The clock seam and the account zone are both held at `T0 = 2026-08-19T12:00:00.000Z` / `UTC` by `POST /__qa__/set-clock` (AC-44). Every fixture instant is derived from `T0`, never from a wall clock (L-023).
- A parent with eight steps, matching the number the AC and `## Impact` §12 use.
- The suite's fixture interpreter records the `InterpreterContext` it is handed — the only observable for the handle list.

## Test steps (API)
| # | Case (automation `it` name) | Request | Expected |
|---|------------------------------|---------|----------|
| 1 | TC-25a a task with EIGHT steps contributes exactly ONE handle | post a turn, then inspect the recorded context | the context holds one task; the parent's title is there and no step title is |
| 2 | TC-25b a turn that names a step title falls through — an assertion of ABSENCE | post a turn whose fixture row resolves a step by title | `no_match`, empty `changed_task_ids`, empty diff, and the step's title is unchanged |
| 3 | TC-25c an ORDINARY unfiled task is still a handle | an ordinary inbox task, then a turn | the ordinary task IS in the context |
| 4 | TC-25d steps come back as ORDINARY ROWS on the wire | `GET /tasks` with a parent and three steps | four rows, each step carrying `parent_id` and a numeric `step_order`; no nested `steps` property anywhere |

## Expected behaviour
- One handle per top-level task, never one per row.
- The step-naming turn's outcome is an **absence**: nothing applied, nothing renamed, nothing marked changed.
- TC-25c is the mutation guard the AC names by name: "routing the exclusion through `isFiled` makes the collection half pass while breaking INV-INBOX-FILING, so the case must also assert that an ordinary unfiled task is still in Inbox."
- There is no nested representation on the wire; the client nests.

## Test data
| Field | Value |
|-------|-------|
| namespace | task titles `qaapi5-*`; reserved user ids in `docs/qa/_shared/fixtures/api/f005-users.json`. No unscoped destructive operations (§10). |
| step count | 8 — the number `## Impact` §12 and AC-46 both use |

## Notes
- The five client-side readers AC-35 also names (`nothingAnywhere`, the mobile `tasks-view` first-run choice, `hasTasks`, the a11y id set) are **client code**; `data-model.md` says so explicitly, and they belong to qa-web-agent and qa-mobile-agent. The api tier owns the `inCollection` gate's wire consequence (TC-25d) and the handle list (TC-25a–c).
- *Would this notice?* Yes — a context builder that did not filter `parent_id == null` fails TC-25a's `toHaveLength(1)` and TC-25b's `no_match`.
