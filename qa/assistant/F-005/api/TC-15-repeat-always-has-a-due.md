# TC-15: A repeating task always has a due date — create, then align

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-15 |
| Feature | F-005 (task-detail) |
| Platform | api |
| Acceptance criteria | AC-22, AC-13, AC-23 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/api/F-005-task-detail.spec.ts (`describe('TC-15 …')`) |
| Created | 2026-08-19 by qa-api-agent |
| Last updated | 2026-08-19 by qa-api-agent |

## Summary
AC-22 is an **invariant, not a default**: "with no due there is nothing to roll from, and a 'Monday weekly' task anchored to whenever it got ticked drifts to Wednesday over a few late weeks, silently." The order — **create, then align** — is "the whole of the fix for revision 1's three-answer problem", and the created due is all-day, in AC-13's date-only form, with no invented time.

## Preconditions
- In-process harness: `createApp(deps)` with the `__qa__` doors mounted in front, on an ephemeral port, driven by supertest. Fresh durable store per test.
- The clock seam and the account zone are both held at `T0 = 2026-08-19T12:00:00.000Z` / `UTC` by `POST /__qa__/set-clock` (AC-44). Every fixture instant is derived from `T0`, never from a wall clock (L-023).
- A task with no `due_at` at all.

## Test steps (API)
| # | Case (automation `it` name) | Request | Expected |
|---|------------------------------|---------|----------|
| 1 | TC-15a setting a repeat on a DATELESS task creates today's due, all-day, then aligns it | `PATCH {repeat_frequency:'day', repeat_interval:1}` | `due_at` is today's local start, `due_all_day: true`, and explicitly not the clock instant |
| 2 | TC-15b the created date is DISCLOSED before commit, and the disclosure is the committed date | `POST /tasks/{id}/repeat-preview` then the same `PATCH` | `created: true`, `refusals: []`, nothing written by the preview, and the commit lands on exactly the previewed date and flag |
| 3 | TC-15c clearing the due of a repeating task is REFUSED | `PATCH {due_at: null}` on a repeating task | `400 VALIDATION field: 'due_at'`; the due is still there and the repeat was NOT ended |

## Expected behaviour
- The created due is **today, all-day** — never a fabricated time, which is what AC-13 exists to prevent.
- The preview is a **dry run of the same server code**, so the disclosed date is by construction the date that will be written. A client-side preview would be a second implementation of the alignment, the clamp and the exclusivity rules — L-004's shape on arithmetic the spec spends four ACs on.
- Clearing the due is refused rather than "accepted by silently ending the repeat — a destructive side effect of a smaller action is how a user loses something they did not know they were touching."

## Test data
| Field | Value |
|-------|-------|
| namespace | task titles `qaapi5-*`; reserved user ids in `qa/_shared/fixtures/api/f005-users.json`. No unscoped destructive operations (§10). |
| today's local start | `2026-08-19T00:00:00.000Z` |

## Notes
- *Would this notice?* Yes — an align-then-create order, or a created due at the clock instant, fails TC-15a; a preview computed differently from the commit fails TC-15b's equality; an implementation that ended the repeat instead of refusing fails TC-15c's second assertion.
- AC-22's created date is a Wednesday under `T0`, so TC-16b's second entry point (a due AC-22 just created) genuinely has to move.
