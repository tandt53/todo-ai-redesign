# TC-18: A series ends by an end date or by a number of runs, never by both — and all four endings

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-18 |
| Feature | F-005 (task-detail) |
| Platform | api |
| Acceptance criteria | AC-25, AC-30, AC-26 |
| Type | boundary |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/api/F-005-task-detail.spec.ts (`describe('TC-18 …')`) |
| Created | 2026-08-19 by qa-api-agent |
| Last updated | 2026-08-19 by qa-api-agent |

## Summary
AC-25 carries the definition of a **live series**, which "AC-30 and AC-39 both turn on and nothing defined". Four endings, and `series_id` is **never the predicate** — "an implementation keyed off it passes the positive case and marks every task that ever repeated as repeating for good, which is the only thing on the phone that explains an unexpected row." The run count's three properties (ADR-014) are asserted through `series_live`, because `ever_completed` is internal.

## Preconditions
- In-process harness: `createApp(deps)` with the `__qa__` doors mounted in front, on an ephemeral port, driven by supertest. Fresh durable store per test.
- The clock seam and the account zone are both held at `T0 = 2026-08-19T12:00:00.000Z` / `UTC` by `POST /__qa__/set-clock` (AC-44). Every fixture instant is derived from `T0`, never from a wall clock (L-023).
- Each ending gets its own fixture row, so one ending cannot be reached through another's door (L-005).

## Test steps (API)
| # | Case (automation `it` name) | Request | Expected |
|---|------------------------------|---------|----------|
| 1 | TC-18a until AND count together is REFUSED | create with both `repeat_until` and `repeat_count` | `400 VALIDATION`, nothing written |
| 2 | TC-18b an until EARLIER than the due date is REPORTED, not silently corrected | `PATCH {repeat_until: <before the due>}` | `400 VALIDATION`; the due was NOT moved for us and the until was not stored |
| 3 | TC-18c the preview reports what a commit would refuse | preview with both endings; preview with until-before-due | `refusals` contains `UNTIL_AND_COUNT` / `UNTIL_BEFORE_DUE`; nothing written |
| 4 | TC-18d all FOUR endings make series_live false, and series_id survives | cleared repeat; end date passed; run count reached; (series delete → TC-22c) | `series_live: false` in each; `series_id` unchanged; the occurrence stays as an ordinary task |
| 5 | TC-18e series_live is NEVER keyed off series_id | clear the repeat, then read the row | `series_id` is still set and `series_live` is `false` |
| 6 | TC-18f generation is PER OCCURRENCE and idempotent | complete, un-complete (successor removed), complete again | no second successor; exactly one row in the series |
| 7 | TC-18g un-completing does NOT un-count a run | count 1: complete, then un-complete | the repeat is still set and `series_live` is still `false` — a mis-tap never extends the series |
| 8 | TC-18h the run count reaches its limit across DISTINCT occurrences | count 2: complete occ1, then occ2 | occ2 is live at 1 of 2; after run 2 there is no third occurrence and the series is over |
| 9 | TC-18i a completion still counts after the row is soft-deleted | count 1: complete, delete, restore | `series_live` stays `false` — soft-deleted rows are still rows |

## Expected behaviour
- "Which one wins" is a question with no right answer, so both-endings is refused rather than resolved.
- An `until` before the due is **reported**: "the user may be about to change the due date next, and a date that moves on its own while they are still typing is worse than a sentence."
- Clearing the repeat "leaves the current occurrence in place as an ordinary task, keeping its due date, its steps and everything else — ending a repeat is not deleting a task."
- The run count is the number of **distinct occurrences completed at least once**, whether or not the row was later deleted and whether or not the completion was later undone (ADR-014's `ever_completed`, never cleared).

## Test data
| Field | Value |
|-------|-------|
| namespace | task titles `qaapi5-*`; reserved user ids in `docs/qa/_shared/fixtures/api/f005-users.json`. No unscoped destructive operations (§10). |
| endings | cleared repeat / `repeat_until` passed / `repeat_count` reached / series deleted (AC-30) |

## Notes
- TC-18f was red on first authoring against a wrong expectation of mine: I expected a re-completion to generate a second successor. Revision 4's corrected phrasing (tester T40) is **per occurrence and idempotent**, so generating nothing is correct. The case now asserts the rule the spec states.
- *Would this notice?* Yes — a `series_id`-keyed predicate fails TC-18e; a current-done-set count fails TC-18g; a live-rows-only count fails TC-18i.
