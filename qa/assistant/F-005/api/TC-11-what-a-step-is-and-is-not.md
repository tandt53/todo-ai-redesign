# TC-11: What a step is, and is not — one level, no repeat, and the refusal's scope

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-11 |
| Feature | F-005 (task-detail) |
| Platform | api |
| Acceptance criteria | AC-18, AC-14 |
| Type | negative |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/api/F-005-task-detail.spec.ts (`describe('TC-11 …')`) |
| Created | 2026-08-19 by qa-api-agent |
| Last updated | 2026-08-19 by qa-api-agent |

## Summary
AC-18 is where this spec states **once** that every refusal names its outcome: "a refused write returns a stated reason, writes nothing, and is announced under AC-33's 4.1.3". And revision 2's gap is closed here too — **the refusal's scope is the whole write, not the offending field**, which closes three separately guessable observables: was the legal field written, was the task marked changed, was a diff rendered.

## Preconditions
- In-process harness: `createApp(deps)` with the `__qa__` doors mounted in front, on an ephemeral port, driven by supertest. Fresh durable store per test.
- The clock seam and the account zone are both held at `T0 = 2026-08-19T12:00:00.000Z` / `UTC` by `POST /__qa__/set-clock` (AC-44). Every fixture instant is derived from `T0`, never from a wall clock (L-023).
- A second account (`QAAPI5-U2`) owning a row, for the caller-scoping half of `parent_id` validation.

## Test steps (API)
| # | Case (automation `it` name) | Request | Expected |
|---|------------------------------|---------|----------|
| 1 | TC-11a a step of a step is REFUSED, with a stated reason and nothing written | `POST /tasks {parent_id: <a step>}` | `400 VALIDATION field: 'parent_id'`; the row was neither created nor flattened to top level |
| 2 | TC-11b a step may carry NO repeat | `PATCH` a step with a repeat; and `POST` a step with a repeat | `400` both times; the step still has no `repeat_frequency` and no `series_id` |
| 3 | TC-11c parent_id must name a live, non-step row OF THE CALLER'S | unknown id, another account's row, a soft-deleted row, a step | `400 VALIDATION field: 'parent_id'` for all four; a legal parent still returns `201` |
| 4 | TC-11d the refusal's scope is the WHOLE write | `PATCH {note: 'after', title: ''}` | `400`; `note` is still `'before'`, the title is unchanged, and `updated_at` did not move |
| 5 | TC-11e parent_id is not patchable | `PATCH {parent_id}` on a step | `400 VALIDATION field: 'parent_id'` — re-parenting is a gesture no AC describes |

## Expected behaviour
- "Rather than flattened or silently dropped" — both wrong outcomes are asserted against, not just the status code.
- One legal + one illegal field writes **nothing at all**, and `updated_at` is the assertion that proves it (a partial write would move it).
- The last sub-case in TC-11c is a control: a legal parent must still work, so the guard is not simply refusing everything.

## Test data
| Field | Value |
|-------|-------|
| namespace | task titles `qaapi5-*`; reserved user ids in `qa/_shared/fixtures/api/f005-users.json`. No unscoped destructive operations (§10). |
| accounts | `QAAPI5-U1` (caller), `QAAPI5-U2` (owns the cross-account row) |

## Notes
- The turn-path form of the whole-write rule is TC-27e, and it is a separate case because the outcome is stated per path (AC-40): a `400` with a field name to a client, a `refused` outcome to a person.
- *Would this notice?* Yes — a field-level refusal that still wrote the legal field fails TC-11d.
