# TC-23: A soft-deleted task can be restored — the write path four ACs assert on

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-23 |
| Feature | F-005 (task-detail) |
| Platform | api |
| Acceptance criteria | AC-41, AC-31, AC-15, AC-19 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/api/F-005-task-detail.spec.ts (`describe('TC-23 …')`) |
| Created | 2026-08-19 by qa-api-agent |
| Last updated | 2026-08-19 by qa-api-agent |

## Summary
"**Four ACs assert on a restore that cannot be performed** (AC-15, AC-19, AC-31, AC-42), so this is the write path that makes them buildable." Every clause of AC-41 gets a case, including the two that only the seed door reaches: the measured **53 of 790** rows that are already soft-deleted with no membership record, and the invariant that a restored step pulls its still-deleted parent.

## Preconditions
- In-process harness: `createApp(deps)` with the `__qa__` doors mounted in front, on an ephemeral port, driven by supertest. Fresh durable store per test.
- The clock seam and the account zone are both held at `T0 = 2026-08-19T12:00:00.000Z` / `UTC` by `POST /__qa__/set-clock` (AC-44). Every fixture instant is derived from `T0`, never from a wall clock (L-023).
- `POST /__qa__/seed` for legacy rows with `delete_gesture_id: null`.
- A second account (`QAAPI5-U2`) owning a deleted row, for caller scoping.

## Test steps (API)
| # | Case (automation `it` name) | Request | Expected |
|---|------------------------------|---------|----------|
| 1 | TC-23a restoring is not creating | delete a cluster and a repeating row, advance the clock, restore both | ids, `created_at`, `step_order` and `series_id` are all kept; only `deleted_at` clears and `updated_at` advances |
| 2 | TC-23b restoring a STEP whose parent is still deleted restores the parent too | delete the parent (cluster), restore one step | the parent comes back with it and is live |
| 3 | TC-23c a row with NO membership record restores ALONE | seed a legacy parent + two legacy steps, restore the parent | only the parent returns; the steps are NOT dragged back by a `parent_id` key. A legacy step still pulls its parent, and only its parent |
| 4 | TC-23d restoring a row that is NOT deleted is a stated no-op | restore a live row; then delete, restore, restore again | `200 restored: false`, never `404` and never `409`; the second restore of a real delete is `restored: false` |
| 5 | TC-23e restore is scoped to the CALLER'S rows | cross-account, unknown id, no auth | `404 NOT_FOUND` for the first two (indistinguishable), `401 UNAUTHENTICATED` for the third; the victim's row stays deleted until its own owner restores it |
| 6 | TC-23f PATCH still 404s on a deleted row, and deleted_at is not patchable | `PATCH {deleted_at: null}`; `PATCH` a deleted row; re-`POST` its id | `400 VALIDATION`; `404`; `409 TASK_ID_EXISTS` |

## Expected behaviour
- "Restoring is not creating": the row keeps its identity and its structure; only `deleted_at` clears.
- The legacy case **under-restores**, which is the safe direction: "over-restoring resurrects rows nobody asked for and offers no way back" (ADR-012). Neither `parent_id` nor matching `deleted_at` is used as a key — AC-41 rejects both by name.
- The parent rule is an **invariant evaluated after the membership set is assembled**, not a key — so it applies to legacy rows too, and TC-23c asserts both halves.
- A no-op restore is **stated** (`restored: false`), because "a silent no-op is indistinguishable from a refusal unless one of them is stated, on the newest write path in the feature."

## Test data
| Field | Value |
|-------|-------|
| namespace | task titles `qaapi5-*`; reserved user ids in `qa/_shared/fixtures/api/f005-users.json`. No unscoped destructive operations (§10). |
| measured legacy rows | 53 of 790 soft-deleted with no `delete_gesture_id`, across 18 accounts (spec / ADR-012) |

## Notes
- TC-23f is the set of facts that make restore a **route** rather than a patchable field: `PATCH` 404s on a deleted row, `deleted_at` is not patchable, and a re-`POST` is a 409.
- *Would this notice?* Yes — a `parent_id`-keyed restore fails TC-23c; a `404` on a live row fails TC-23d; a missing caller scope fails TC-23e, and "no AC would otherwise turn red" (product P11).
