# ADR-013 — A turn plans the rows it will cause, then captures, then applies

**Date**: 2026-08-19
**Status**: accepted
**Feature**: F-005 (AC-46, AC-26, AC-19, AC-28) · **amends `POST /assistant/turn` rule 6**

## Context

`F-005 AC-46` requires that a row the server creates or changes **as a
consequence of** a turn belongs to that turn's undo record. Two such rows
exist: the successor a repeating completion generates (AC-26) and the steps a
parent completion cascades to (AC-19). Both happen outside
`applyCreate`/`applyEdit`, so today they land in **neither `created_ids`, nor
`undo_snapshot`, nor `post_apply`** — and a voice turn *can* set `status:
'done'`, because `status` is in `DIFF_FIELDS`. Undoing that turn reopens the
completed occurrence and leaves the successor standing, and leaves cascaded
steps ticked with nothing able to reverse them.

The ordering is the part the architect lens named as catchable by nothing
downstream. `undo_snapshot` is **contractually captured immediately before
apply** and `post_apply` after it, keyed by touched `task_id`; `created_ids` is
written by `applyCreate`. **The rows AC-46 adds do not exist until *during*
apply.** AC-26's *"inside the completing write's transaction"* does not supply
the ordering — being inside the transaction says nothing about being inside the
capture — so an implementer who satisfies that sentence still ships a
half-reverted undo, which AC-46 calls worse than no undo.

## Options considered

1. **Capture `undo_snapshot` after apply for caused rows only.** Two capture
   moments for one record, and the pre-state of a cascaded step is gone by
   then. Rejected — it is the bug with a comment on it.
2. **A second record — `caused_ids` / `caused_snapshot` — beside the existing
   three.** Undo would then read four records and needs a rule for which wins.
   It also splits *what the turn did* across two shapes, which is the split
   AC-46 exists to close. Rejected.
3. **Plan the caused set before capture, then record caused rows in exactly
   the same three records as directly-written rows.** Chosen: a successor's
   identity and a cascade's step ids are both **knowable before the write
   executes**, so nothing needs to be discovered during apply.

## Decision

An applying turn runs four phases inside one transaction, in this order:

1. **Resolve** — the interpreter's output is matched to live rows (unchanged;
   the context is read fresh inside the serial-queue slot, OQ 7).
2. **Plan** — compute the complete set of rows this turn will write, target and
   caused alike. For each target: the steps a completion will cascade to
   (AC-19), the successor a repeating completion will generate **with its id
   allocated now** (AC-26), the successor an un-complete will remove (AC-28).
   The plan is a pure function of the resolved targets and current state; it
   performs no writes.
3. **Capture** — `undo_snapshot` over every planned row that **already exists**
   (targets and caused-changed rows alike), and `created_ids` over every
   planned row that **does not yet exist** (a directly created task, and a
   generated successor).
4. **Apply**, then capture `post_apply` over every row actually written.

**The record-to-row mapping, stated once:**

| Row | Record it joins | Why |
|---|---|---|
| a task the turn creates directly | `created_ids` | unchanged |
| a **generated successor** (AC-26) | `created_ids` | it is a create; undo removes a created row, subject to the condition below |
| a task the turn edits or deletes directly | `undo_snapshot` (pre) + `post_apply` (post) | unchanged |
| a **cascade-ticked step** (AC-19) | `undo_snapshot` (pre) + `post_apply` (post) | it is a change to a row that already existed |

**The revert condition is per class** (AC-46, and the two classes need
different rules):

- **A created row — the generated successor.** Reverted only if it would still
  be removable under **AC-28's five conditions**; otherwise it stays. The
  whole-row `taskEquals(current, post_apply)` comparison undo uses today is
  blind to AC-28's fifth condition, because *"no step of it ticked or changed"*
  touches the **step's** row, not the successor's — so undo would hard-delete a
  successor whose steps the user has worked on, in exactly the case AC-28
  exists to protect, and the natural test for it passes.
- **A changed row — a cascade-ticked step.** Reverted on **its own snapshot
  comparison, under AC-19's `completed_by_parent` guard**, and *not* under
  AC-28's five conditions — which a cascade-ticked step **cannot satisfy by
  construction** (no `series_id`, created long before the completion,
  `updated_at !== created_at` because the cascade just wrote it). `undo.ts:98`
  is a whole-row replacement, so reverting the **parent** bypasses the guard
  entirely: the cascade's steps are reverted **as their own rows**, by the
  guard, never as a side effect of the parent's row being replaced.

**The skipped set names top-level tasks only.** `undo.ts`'s `skipped` carries a
`title`, so the rule unqualified would put step titles the user has never seen
into a reverted turn's outcome message — which AC-35 and AC-36 forbid outright.
A step that could not be reverted is reported **through its parent**: the parent
is named and the message says its steps were not fully reversed.

**The undo record and the message anatomy differ, deliberately.** `ApplyResult`
emits anatomy, snapshot, `post_apply` and `created_ids` from one loop, so this
is the first time the two can diverge and the default route makes the choice
invisibly. The undo record covers what the turn **caused**; `turn.diff`,
`changed_task_ids`, `created_titles` and `deleted_titles` cover what the user
**asked for**. A voice *"done"* on a parent with eight steps therefore reverts
nine rows and renders one diff.

## Consequences

- **Good:** no new record, no fourth shape, and `data-model.md § assistant_turn`
  gains no field. The three existing records mean exactly what they meant; what
  changes is **when** the set they are computed over is known.
- **Good:** the ordering is now stated as a phase, which is testable — a plan
  that returns the caused ids is inspectable before any write happens.
- **Bad:** the plan duplicates the branch logic the apply then executes
  (which completions generate, which parents cascade). Two implementations of
  one rule is the shape this project keeps paying for (L-004), so the plan is
  the **only** producer: apply consumes the planned set and does not re-derive
  it. That constraint is part of this decision, not an implementation note.
- **Bad:** a successor's id is allocated before the row exists. If apply
  aborts, the id is discarded with the transaction — acceptable, ids are not
  scarce.
- **Neutral:** `api-contracts.md`'s rule 6 (*snapshot captured immediately
  before apply*) and the undo endpoint's *Revert shapes* enumeration are
  restated for this; `data-model.md § assistant_turn`'s `undo_snapshot`,
  `post_apply` and `created_ids` cells gain the caused-row sentence.
