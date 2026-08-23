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

---

## Amendment (2026-08-23, T-181) — the restore also clears `series_ended_at`

**Trigger.** `F-006 ## Impact` §6, Open Question 2, and `LEARNINGS.md` **L-026**.
Measured on `main`: `plan.ts:713-722` writes `series_ended_at` on **every** row of
a series delete (including completed occurrences that are not soft-deleted), and
`app.ts:822-826` clears **`deleted_at` and `updated_at`, and nothing else**. So
restoring a series-deleted set returns the occurrences with `series_live: false`
and the repeat permanently dead. `F-005 AC-43`'s *"it reverses exactly the
action it was offered for and nothing else"* is false for the series class.

**Why it was invisible.** Three reasons stacked (L-026): the AC reads as
satisfied, the restore's own tests assert on `deleted_at` (which does come
back), and the window in which a human could have noticed was seconds wide —
the undo offer expires, so nobody ever restored a series days later. Verified:
**0 rows in the live store carry `series_id` and `deleted_at` together.**
F-006's trash makes that restore a deliberate act days later, changing the
viewing angle on old code.

### The fork

**Option A — the restore also clears `series_ended_at`.** AC-43's promise is
kept. The reversal is complete per field, not per row. Risk: a restore could
revive a series the user ended deliberately.

**Option B — AC-43 narrows its claim.** The restore returns the occurrences
but the repeat stays dead. The user gets their tasks back and must re-set the
repeat. The trash entry must say so (copy that design does not yet have).

### Decision: Option A — clear `series_ended_at` on restore

**`series_ended_at` is written ONLY by the series-delete path** (`plan.ts`,
the same `softDelete + side: { series_ended_at: ctx.at }` code block). There
is no other writer. So clearing it on restore is safe: it was always written
by the exact gesture being reversed.

**The clearing rule:** when a restore brings back rows that carry a `series_id`,
it clears `series_ended_at` on every row of that series whose
`series_ended_at` matches the gesture's shared `deleted_at`. This is precise:
it clears only the end marker written by the gesture being restored, and it
reaches the completed occurrences that the series delete marked but did not
trash.

**`app.ts:822-826` changes:** in addition to clearing `deleted_at` and
advancing `updated_at` on the membership set, the restore identifies the
series (from any member's `series_id`) and runs a second pass clearing
`series_ended_at` on rows of that series where `series_ended_at` equals the
gesture's `deleted_at`. Those rows appear in `changed` so both clients see
them.

### What the rejected option would have required

Option B would have narrowed AC-43's claim to exclude the series class — the
one class where the delete does two things (`deleted_at` + `series_ended_at`).
The trash entry would have needed copy stating *"the repeat will not come
back"*, which design does not have and which the spec's own `## Impact` §9
does not route. And L-026's lesson — *"enumerate every FIELD that write
touched, not every ROW"* — would have become an item the pipeline paid for and
then ignored.

### Consequences of the amendment

- **Good:** AC-43's promise is true for every class. The reversal is
  field-complete. L-026's lesson is applied.
- **Good:** no design dependency — the trash entry needs no special copy about
  the repeat, because the repeat does come back.
- **Bad:** the restore's changed set now includes completed occurrences that
  were never deleted, because their `series_ended_at` is being cleared. Both
  clients must handle a `changed` member that was already in `state.tasks`.
- **Neutral:** the clearing is by value match (`series_ended_at` equals the
  gesture's `deleted_at`), so a series whose end marker was written by a
  *different* gesture is unaffected. A series that was ended and then had some
  members separately deleted and restored has its markers preserved.
