# F-006 Gate 1 — architect lens (T-182, 2026-08-21)

**Verdict:** 2 HIGH · 3 MEDIUM · 2 LOW · all 16 ACs, plus `## Data`, `## API Touch Points`, `## Impact`.
**Every store measurement reproduces exactly** (839 / 57 / 20 / 4 / 0 / 0 / 420).

---

## F1 (HIGH) — AC-6, AC-9, AC-11, AC-12 · **a trash entry's membership is not a closed set**

AC-11 defines the purge set as *"the same membership AC-9's restore would have put
back"*, and AC-9's restore **pulls in a still-deleted parent regardless of gesture**
(`app.ts:608-615`) — a row AC-6 makes a **separate entry with its own `deleted_at` and its
own expiry.**

Delete a step, then its parent: two gestures, two entries, reachable because `planDelete`
cascades over live steps only. **Three things are then undefined:**

1. Restoring the step's entry **silently empties the parent's entry**.
2. *Delete forever* on the step's entry **permanently destroys a row from an entry the
   user did not select**.
3. If the parent's 30 days elapsed first, restoring the step **resurrects an expired row**
   against AC-12's *"that holds without exception"*.

*0 deleted steps in the store today, so deciding now costs nothing and the earliest catch
otherwise is a user report.*

## F2 (HIGH) — AC-9, AC-12, AC-16 · "unchanged" plus a new precondition is a contradiction

`## API Touch Points` says restore is *"unchanged and reused as-is — nothing about it
moves"*; AC-12 makes it refuse an expired row; `## Impact` §10 says it *"gains the expiry
precondition"*.

**Three user-facing states — already restored, expired, not yours — collapse into two wire
outcomes**, while AC-16's 4.1.3 requires the refusal be announced. *This is the door F-005
AC-43's elapse and AC-33's AA claim depend on.*

## F3 (MEDIUM) — AC-5, AC-6, AC-11 · the entry has no identity on the wire

`delete_gesture_id` is declared internal and never serialized by **both** ADR-012 and
`api-contracts § Task on the wire`, yet client-side grouping is offered as a choice — and
**53 of 57 deleted rows carry `null`, which is not a group key at all.** §10's
"documents that become wrong" table **does not name the wire field list**, so that change
would land unrouted. AC-11 also has no stated way to name the entry it destroys.

*Directive:* address an entry by any member task id — the restore's own precedent — and
keep the gesture id internal.

## F4 (MEDIUM) — AC-3, AC-12 · no named producer for the displayed date

AC-3 is `(web, mobile)`; AC-12's constant is `(api)`, read by two server doors. **The
default outcome is three copies of the number the user is promised** — the *one answer per
row, not one per tier* failure F-005 AC-44 exists to prevent, landing on the one value
AC-12 says is the whole of what the user is promised.

## F5 (MEDIUM) — AC-1, AC-4, AC-12 · two decisions of ADR weight with no artifact named

**(i)** *"The trash is a lifecycle state, not a container"* adds a row on neither axis to
ADR-009 Amendment 2's table, and §2 defers *"which vocabulary the menu row belongs to"* to
architecture **without naming where the answer is written**. §10 says ADR-009 *"becomes
wrong"* and **names no writer**, so the next reader of ADR-009 gets the old table.
**(ii)** AC-12 makes a **read mutate the store**, and the touch point lays out the
alternatives and their costs and **assigns the decision to nobody.**

## F6 (LOW) — AC-12, AC-13 · "exactly two doors" holds for a reason the spec does not state

**The turn undo is a third** — it replays the pre-apply row verbatim and clears
`deleted_at`. It cannot reach an expired row **only because** the window is the newest
applied turn of an open session and `lazyIdleClose` runs inside the undo transaction at
ADR-004's 180-second bound. *Lengthening the idle window, or any door that reopens a closed
session's undo, falsifies "without exception" with no test pointed at it.*

## F7 (LOW) — AC-4, AC-5 · §1's list is short by at least one

`web/components/TaskDetail.tsx:332` filters `deleted_at === null` and appears in neither
§1's eleven nor §8's two. *(Measured: 44 non-comment non-test lines across 14 files —
could not reproduce §1's "45 across 16". All eleven cited lines are real.)*

---

## Checked, sound

- **Retention with no stored expiry field** — derived from `deleted_at` plus a constant,
  and the restore clears `deleted_at`, so **AC-12's clock reset is real and no second
  stored value can disagree with it.**
- **`deleted_at` is one instant per gesture** — `plan.ts` writes `ctx.at` for every row,
  verified on both multi-row gestures in the store. **AC-3's single expiry date per entry
  is well defined for a cluster** (the exception is F1's pulled parent).
- **The null-gesture singleton rule matches ADR-012 and the shipped restore** — grouping
  the 53 nulls by the column would collapse them into one entry, and the AC forbids exactly
  that.
- **AC-13's guard exists** — a hard-removed row fails `removedByThisTurn` and is skipped;
  §5's warning about a purge that also cleans `post_apply` is accurate.
- **`## Data` claims no new stored field, and that is true** — `deleted_at`,
  `delete_gesture_id` and `parent_id` all ship. **No migration is owed.**
- **Every AC obeys the lifecycle-state claim** — AC-1 keeps the row out of `Collection`,
  AC-4 out of all four, AC-10 writes nothing on the filing axis, §7 leaves
  INV-INBOX-FILING's two expressions unnarrowed.
