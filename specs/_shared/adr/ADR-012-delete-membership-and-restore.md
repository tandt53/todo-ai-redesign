# ADR-012 — A delete records its own membership; restore replays that set

**Date**: 2026-08-19
**Status**: accepted
**Feature**: F-005 (AC-41, AC-31, AC-42, AC-30, AC-19, AC-15, AC-43)

## Context

Nothing in this system can un-delete a row. `DELETE /tasks/{id}` sets
`deleted_at`; `PATCH` 404s on a deleted row and `deleted_at` is not in
`TASK_PATCH_FIELDS`; `GET /tasks` filters deleted rows out; a re-`POST` under
the same id answers 409; `undo.ts` reverts only rows in a **turn's** snapshot,
and a hand delete creates no turn. Five ACs assert on a restore.

`F-005 AC-41` fixes what is not architecture's: the restore exists, it restores
**the membership the delete recorded** in one call, it is scoped to the
caller's rows, and a restore aimed at a live row is a stated no-op. It fixes
the key negatively too — *not* `parent_id` (which resurrects a step the user
deliberately deleted an hour earlier) and *not* matching `deleted_at`
timestamps (a coincidence, not a key).

One question was recorded and not answered (dev-backend F4), measured on the
live store and re-verified 2026-08-19: **53 of 790 rows are already
soft-deleted with no membership record, across 18 accounts, all predating the
field.** AC-41 makes the restore a *general* write path, so those rows are
addressable by it.

## Options considered

**For the record**

1. **A `delete_gestures` table** mapping a gesture id to the row ids it
   trashed. Complete, and it is a second place a task's fate is written — a row
   can be in the table and not deleted, or deleted and not in it.
2. **`delete_gesture_id: uuid | null` on the task row**, written beside
   `deleted_at` by every soft delete. Chosen. The membership travels with the
   row it is about, cannot disagree with `deleted_at`, and the restore is a
   single scan on one indexed column.

**For the 53 legacy rows**

1. **Backfill a gesture id per row from `deleted_at` clustering.** This is the
   timestamp key AC-41 rejects, run once and then believed forever. Rejected.
2. **Backfill by `parent_id`.** The key AC-41 rejects by name. Rejected.
3. **Refuse to restore a row with no membership record.** Truthful, and it
   makes the newest write path in the feature answer `409` for 53 real rows
   with no way for a user to tell why. Rejected.
4. **Restore exactly that row, and nothing else.** Chosen.

## Decision

- **`delete_gesture_id: uuid | null`** on `task`. Every soft delete — from the
  detail (AC-31), from a list row (AC-42), a parent-and-steps cascade (AC-19),
  a series delete (AC-30), and a delete a turn performs — mints **one** id and
  writes it on **every** row that gesture trashes, in the same transaction as
  `deleted_at`.
- **`POST /tasks/{id}/restore`** clears `deleted_at` on the addressed row and
  on every other row carrying the same `delete_gesture_id`. It keeps id,
  `step_order`, `series_id`, `created_at`; only `deleted_at` clears and
  `updated_at` advances (AC-41).
- **A row whose `delete_gesture_id` is `null` restores alone.** That is the
  answer to the recorded question: the membership of those 53 rows is genuinely
  unknown, and every available way to infer one is a key AC-41 rejects by name.
  A singleton restore is the only answer that is **true** rather than plausible,
  and it fails in the safe direction — it under-restores, and the user can
  restore the other rows individually, whereas over-restoring resurrects rows
  nobody asked for and offers no way back.
- **The parent rule is an invariant, not membership.** Restoring a step whose
  parent is still deleted restores the parent too (AC-41), because a step with
  no parent is in no collection and therefore unreachable. This is evaluated
  **after** the membership set is assembled and applies to legacy rows as well.
  It is stated as its own rule so nobody re-derives it as a `parent_id` key.
- **No migration is run.** ADR-009's precedent: past states are not rewritten
  so that a column reads tidily. The 53 rows keep `delete_gesture_id: null` and
  the contract covers them explicitly.
- **The membership is the delete's unit, and the unit follows the gesture** —
  a task and its steps for AC-31/AC-42; every unfinished occurrence and its
  steps for AC-30's series delete. Nothing infers it afterwards.

## Consequences

- **Good:** AC-15's *"deleting a step and then undoing returns it to the
  position it held, because the order lives on the record that came back"* is
  literally true — the row comes back with its own `step_order`, from the
  server, which is what makes a client-side delay an unacceptable substitute.
- **Good:** one column, one index, no new entity, and the record cannot drift
  from the thing it describes.
- **Bad:** a user restoring one of the 53 legacy rows gets one row where they
  may remember deleting several. There is no observable that distinguishes this
  from an under-recorded gesture, which is exactly the honest position: it *is*
  an under-recorded gesture.
- **Bad:** the gesture id is a second identifier on the task row that means
  nothing while the row is live. It is internal and never serialized.
- **Neutral:** `POST /tasks/{id}/restore` is the fifth new route this feature
  adds and the only one AC-41 required by name. Whether it is a route or a
  patchable field was architecture's call; a route was chosen because
  `deleted_at` in `TASK_PATCH_FIELDS` would make un-delete reachable from every
  client that can spell a field name, and because `PATCH` 404s on a deleted row
  — inverting that would weaken the guard for every other field.
