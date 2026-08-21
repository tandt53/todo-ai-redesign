# F-006 Gate 1 ROUND 2 — architect lens (T-186, 2026-08-21)

**Verdict:** 2 HIGH · 2 MEDIUM. **All 7 round-1 dispositions hold as claimed.**
Every store measurement reproduces exactly. **Both new HIGHs are consequences of revision 4, not survivors of round 1.**

---

## F1 (HIGH) — AC-5, AC-12, AC-14 · **the turn is the third door, and AC-12 still says two**

AC-14's read **hands a deleted row's content back to a user through the turn path — which is
AC-12's own definition of a door** — while AC-12 still names exactly two and attaches the
removal write to one of them.

*AC-12's sub-bullet defines its scope as **"the doors that hand a deleted row back to a
user, not every code path that touches one"**, and says the phrasing exists because
**"exactly two" is what an implementer greps against.*** **Under that definition the turn is
the third.**

**Revision 4 touched AC-4, AC-5, AC-14 and AC-15 and left AC-12 alone.**

## F2 (HIGH) — AC-9, AC-12 · **a restore can resurrect an EXPIRED row, and AC-12 says "without exception"**

AC-9's parent invariant restores a still-deleted parent **from another entry with no expiry
precondition.** Verified in shipped code: `app.ts:610-617` adds any `deleted_at !== null`
parent **unconditionally**, then clears `deleted_at` on every member.

*Falsifiable at the api tier: seed an expired parent, call restore on its step, **without a
trash read.*** **AC-6's closed-membership fix closed the two halves of round-1 F1 that were
about *destroying* and *emptying* across entries; this third half was about *resurrecting*
and it did not close.**

The spec itself names the reachable ordering, in AC-7: *"restore A and re-delete it, which
resets S's clock so P expires first."* **On the product path the trash read purges P first;
at the door it does not.**

## F3 (MEDIUM) — AC-17, AC-6 · `## Data` lists AC-17 against the wrong field

The `delete_gesture_id` row lists AC-17 among its readers — **while AC-17 states it is keyed
on `deleted_at` and addresses no gesture** — and the `deleted_at` row **omits AC-17
entirely.**

*§10 routes `data-model.md § task` to architect with the instruction that
`delete_gesture_id` "gains its second reader", **so the wrong reader gets written down**, and
the field that keys the only account-wide irreversible act **has no AC tracing to it.***

## F4 (MEDIUM) — AC-11, AC-17 · §1's criterion admits nine write-guard sites its table lacks

**The two new doors are writes on deleted rows, and §1 is the section that tells their
implementer what not to widen** — so the guard most likely to be widened, **`app.ts:524`,
which would turn the shipped soft-delete route into a hard-delete route**, is not in it.

---

## Round-1 findings — seven of seven hold

Closed membership stated once, all four referrers verified by reading · five restore
outcomes with distinguishability required and *"nothing about it moves"* withdrawn by name ·
entry addressed by member task id, gesture id internal · date server-produced, one reader
tier · **§10 now has a Writer column and both ADR-weight decisions say architect** ·
*"exactly two doors"* argued from ADR-004's 180 s idle close *(holds for the undo; falsified
by AC-14 instead — F1)* · §1's missing read added and the headline count dropped.

**All 14 §1 rows verified against the working tree — file, line and description. Every one
real and correctly described.** §10's `web.md` staleness claim confirmed (`web.md:72` says
three `ShellSurface` values, `shell.ts:56` declares four).

## The routed question, in architect terms

> **It costs no contract and creates no inconsistency, and I would not spend a round on it.**
>
> The turn already supports a reply that emits no action, so *"restore the dentist task"*
> produces a sentence and no write — **the guarantee AC-14 asserts, reached by a mechanism
> that already exists rather than one this feature adds.** The interpretation context grows
> by at most **9 entries** at the store's real maximum.
>
> Nothing here is expensive to reverse: **if the owner later wants restore voice-reachable,
> it is an addition to the action vocabulary and a refusal that becomes owed** — which AC-14
> already says, in the sentence written for that future author.
>
> **The one architectural cost is F1, and it is a cost of the read rather than of the dead end.**
