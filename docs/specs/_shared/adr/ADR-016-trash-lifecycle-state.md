# ADR-016 — The trash is a lifecycle state on neither axis

**Date**: 2026-08-23
**Status**: accepted
**Feature**: F-006 recently-deleted (AC-1, AC-4, AC-5)
**Amends**: ADR-009 § Amendment 2

## Context

ADR-009 Amendment 2 established two independent axes over the open tasks,
plus one gate:

| | Cells | Kind |
|---|---|---|
| **Date axis** | Today · Upcoming · `undated` | views, computed from `due_at` |
| **Filing axis** | Inbox · each personal list | containers, a property of the task |
| **The gate** | Done | the one genuine status |

F-006 adds a trash — a surface listing a user's deleted tasks, with a 30-day
retention period, restore, and permanent deletion. The question this ADR
answers is where the trash sits in this model.

## Options Considered

1. **A third axis** — a deletion axis with cells `live` and `deleted`.
   Rejected. A deleted task is in no collection, no count and no handle list
   (F-006 AC-4), so the axis would have one cell that participates in the
   grid and one that does not. That is a gate, not an axis.

2. **A fifth collection on the filing axis** — `Collection` gains `'trash'`.
   Rejected, and the spec names this as *"the category error"* this ADR exists
   to prevent. `inCollection` runs over `state.tasks`, which holds only live
   rows, so a `'trash'` member counts zero forever. `dueAtForCollection`
   gives it a create-in-context due date, which makes *"create a task while
   viewing the trash"* a reachable state. And the menu's click-through
   contract is typed on `Collection`, so a fifth member is a typecheck failure
   rather than a design choice. See `F-006 ## Impact` §2.

3. **A peer of Done in the gate row** — a second lifecycle terminus. Chosen.

## Decision

The trash is a lifecycle state like Done. A deleted task sits on **neither**
axis of the grid — it has a date cell and a filing cell (both preserved by the
restore), but it is excluded from both by AC-4.

The model from Amendment 2 becomes:

| | Cells | Kind |
|---|---|---|
| **Date axis** | Today · Upcoming · `undated` | views, computed from `due_at` |
| **Filing axis** | Inbox · each personal list | containers, a property |
| **The gate** | Done · **Deleted** | lifecycle termini |

**Done and Deleted are peers, not siblings of the axis cells.**

Properties P1–P4 from Amendment 2 are unchanged: the date axis is total and
disjoint over **open, non-deleted** tasks; the filing axis is total and
disjoint over the same set. Both axes exclude Done and Deleted by their `open`
and `deleted_at === null` predicates. The two gate members are mutually
exclusive only for display: a done task can be deleted (2 of the 57 deleted
rows today are `done`), and a deleted done task's restore returns it to Done
(AC-10).

**The trash surface is not a collection and carries no count in the Lists
menu.** Its entry is a peer to Done, not to Inbox, and it is reached by its
own edge (S3 to trash) with its own return (trash to S3), not by a
`select-collection` edge onto S2 Tasks.

## Consequences

- **Good:** the model remains two axes and a gate. No existing predicate
  changes. `Collection`, `COLLECTIONS`, `inCollection`, `collectionName` and
  `dueAtForCollection` are all untouched.
- **Good:** the restore's filing answer is automatic — a task whose date and
  filing cell are both preserved goes back where it was, and this ADR adds
  no relocation rule.
- **Bad:** the gate now has two members where it had one, and the word *gate*
  is less apt for a row of two. *Lifecycle terminus* is what it is.
- **Neutral:** a deleted task's date and filing cells are invisible while it
  sits in the trash and become visible again on restore. Nothing reads them
  in between.
