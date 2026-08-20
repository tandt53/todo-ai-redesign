# TC-29: A turn that completes a repeating task, then undone

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-29 |
| Feature | F-005 (task-detail) |
| Platform | api |
| Acceptance criteria | AC-46, AC-26, AC-28 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/api/F-005-task-detail.spec.ts (`describe('TC-29 …')`) |
| Created | 2026-08-19 by qa-api-agent |
| Last updated | 2026-08-19 by qa-api-agent |

## Summary
"A voice turn can set `status: 'done'` — `status` is in `DIFF_FIELDS` — so undoing that turn would reopen the completed occurrence and leave the successor standing: **two open occurrences of one series**… Undo reverses the whole of what the turn caused, or it reverses none of it; a turn whose consequences are half-reverted is worse than one that cannot be undone, because the user believes it was." This is the **created-row** class of AC-46; the changed-row class is TC-30.

## Preconditions
- In-process harness: `createApp(deps)` with the `__qa__` doors mounted in front, on an ephemeral port, driven by supertest. Fresh durable store per test.
- The clock seam and the account zone are both held at `T0 = 2026-08-19T12:00:00.000Z` / `UTC` by `POST /__qa__/set-clock` (AC-44). Every fixture instant is derived from `T0`, never from a wall clock (L-023).
- A fixture row that completes a repeating occurrence by voice, so the successor is created **as a consequence of a turn** rather than by a hand tick.

## Test steps (API)
| # | Case (automation `it` name) | Request | Expected |
|---|------------------------------|---------|----------|
| 1 | TC-29a the generated successor is in the turn's record and the undo removes it | voice-complete a weekly occurrence, then undo | `undone: true`; the occurrence is reopened; the successor is GONE and the series has one row |
| 2 | TC-29b a successor whose STEP the user worked on is NOT hard-deleted by the undo | voice-complete a parent-carrying occurrence, advance, tick the successor's step, then undo | the successor STAYS, is named by its own title in `skipped`, and no step title appears there |

## Expected behaviour
- The successor joins `created_ids` in the **plan** phase, before the capture — "a successor's identity and a cascade's step ids are both knowable before the write executes" (ADR-013).
- The revert condition for a created row is **AC-28's five conditions**, not a whole-row `taskEquals`: "condition five touches the *step's* row, not the successor's. Left at the whole-row comparison, undo **hard-deletes a successor whose steps the user has worked on**, in exactly the case AC-28 exists to protect, **and the natural test for this AC passes**."
- A row that is not reverted is named in the reverted turn's outcome message — and `skipped` names **top-level tasks only**.

## Test data
| Field | Value |
|-------|-------|
| namespace | task titles `qaapi5-*`; reserved user ids in `docs/qa/_shared/fixtures/api/f005-users.json`. No unscoped destructive operations (§10). |
| fixture utterance | `qaapi5 finish the repeating one` → `{status: 'done'}` on the repeating occurrence |

## Notes
- TC-29b is the case the whole-row comparison passes, so it is the one worth running first when this area changes.
- *Would this notice?* Yes — a successor outside `created_ids` fails TC-29a (it would be left standing); a whole-row comparison fails TC-29b.
