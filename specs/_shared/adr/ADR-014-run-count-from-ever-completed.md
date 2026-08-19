# ADR-014 — The run count is derived from a per-occurrence flag, not a counter and not a log

**Date**: 2026-08-19
**Status**: accepted
**Feature**: F-005 (AC-25, AC-26, AC-28, AC-30)

## Context

`F-005 AC-25` ends a series by `recurrence.count`, defines the count as **the
number of distinct occurrences of the series that have been completed at least
once**, whether or not the row was later deleted and whether or not the
completion was later undone — and **forbids a stored counter**, on the grounds
that it is wrong the first time anyone deletes an old occurrence.

The spec then recorded what it could not state (tester T35): **`## Data` holds
no record that an occurrence was ever completed.** No `completed_at`, no
completion event, and a `status` that carries only the *current* state. So the
moment an occurrence is un-completed, the quantity that ends every series has no
source in the declared model. The observable is exact: with `count: 3` —
complete occ1, un-complete, complete again, then occ2 and occ3 — does the series
end at occ3 or occ4?

## Options considered

1. **A stored counter on the series.** Forbidden by AC-25 by name, and it is
   forbidden for a good reason: it is a second copy of a fact the rows already
   carry, and it goes wrong on soft delete.
2. **Count the current done set** — `status === 'done'` among live rows of the
   series. Wrong three ways: un-completing silently extends the series by one
   (the mis-tap AC-28 exists to support), a soft-deleted completed occurrence
   stops counting, and AC-30's series delete would silently satisfy the run
   count of a series it just ended.
3. **An append-only completion log** — a row per completion event, keyed by
   `(series_id, task_id)`. Correct, and it is a new entity plus a second write
   per completion, for a quantity that is a **per-row** fact rather than a
   history. It also invites the question of what else belongs in it, which is a
   different feature (a Logbook — explicitly out of scope).
4. **A per-occurrence boolean on the task row.** Chosen.

## Decision

- **`ever_completed: boolean`** on `task`. Set to `true` the first time the row
  transitions to `status: 'done'`. **Never cleared** — not by un-completing,
  not by a turn undo, not by a soft delete.
- **The run count is `count(rows where series_id = S and ever_completed)`.**
  Soft-deleted rows are still rows, so they still count, which is exactly what
  AC-25 requires and what option 2 gets wrong.
- **The three properties AC-25 states fall out rather than being enforced:**
  - *un-completing does not un-count a run* — the flag is not cleared;
  - *re-completing does not count twice* — it is a flag, not an increment, and
    AC-28's both-rows-stay outcome is the only constructor for that state;
  - *AC-30's series delete never silently satisfies its own run count* — the
    delete trashes only **unfinished** occurrences, whose flag is `false`.
- **It is internal.** Never serialized; clients read `series_live`, which is
  where this quantity surfaces.
- **AC-25's prohibition is honoured.** *"No stored counter"* forbids a number
  that must be kept in step with the rows. This is a fact about one row,
  written by the transition it describes, and the quantity is counted at read
  time. If the flag and the row ever disagreed, the row would have to have been
  rewritten behind the transition — which nothing does.
- **AC-28's hard removal is the one interaction worth naming.** A successor
  removed under AC-28's five conditions is **hard**-removed, so its row is gone
  and cannot count — correct, because a successor that was removed was never
  completed and its flag was `false`.

## Consequences

- **Good:** one boolean, no entity, no second write, and the count is
  reconstructible from the store by anyone reading it. The 790 existing rows
  need no backfill: none of them is in a series (`series_id` does not exist
  before F-005), so the count over any series starts from rows this feature
  creates.
- **Good:** it composes with ADR-012 — a soft-deleted occurrence keeps both its
  flag and its `delete_gesture_id`, so restoring it changes no count.
- **Bad:** it answers *"was this occurrence ever completed"* and nothing else.
  A later feature that wants *when*, or *how many times*, needs the log this
  ADR rejected. That is a real re-open, and it is cheap: the flag stays true
  under a log and the log supersedes the derivation.
- **Bad:** a hard-deleted row loses its flag. AC-28 is the only hard removal in
  the feature and the case is provably empty (see above), so the exposure is
  bounded by that one rule staying the only one — recorded here so a second
  hard delete does not arrive unnoticed.
- **Neutral:** the derivation is O(rows in series). A series is bounded by its
  own run count or by human time; no index beyond `series_id` is needed.
