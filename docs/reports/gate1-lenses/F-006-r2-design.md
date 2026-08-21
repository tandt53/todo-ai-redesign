# F-006 Gate 1 ROUND 2 — design lens (T-186, 2026-08-21)

**Verdict:** 2 HIGH · 4 MEDIUM · 1 LOW. **All 6 round-1 findings hold — every disposition matches what the text now says.**
**Both HIGHs are new, and both come from what changed after my round.**
**States: ~29 implied, 20 named, 9 unnamed** (round 1: ~25 / 9 / 16).

---

## F1 (HIGH) — AC-14, AC-5 · **the assistant is required to say something nothing can say**

`components.md § Spoken frames` — **the closed vocabulary that owns every assistant
utterance** — has no row that can produce that sentence.

*The implementer either adds free text, which F-002 AC-22's **"never a free template over
model-authored text"** forbids **and whose test parses that section by row ID at run time**
— or AC-14's one stated fixture cannot be built at all.*

**§9 and §10 route no frame.** *Directive: AC-14 owes at least two rows — a
task-is-in-the-trash answer (`title`) and a what-is-in-the-trash answer (`count`,
`title_list`). **Both fit the closed five-slot vocabulary; it is the frames that are missing,
not the slots.***

## F2 (HIGH) — AC-9, AC-10, AC-15 · restore has **no failed state and no offline state**

The read (AC-2), the destroy (AC-11) and the empty (AC-17) **each have both.**

*The implementer inherits the codebase default — **"apply an optimistic change, await, and
discard it"** — **on the one action this feature exists for**, producing the row that
vanishes and returns at the next refresh **that AC-11 spends a paragraph forbidding for the
act next to it.***

**§11's *"this feature's three writes"* points at two ACs.**

## F3 (MEDIUM) — AC-14, AC-5 · a failed trash read spoken as an empty one

*The composer answers from an absent result set, so a failed read is spoken as **"nothing has
been deleted"** — **the exact substitution AC-2 forbids by name on the surface**, on the one
channel where AC-2's clause does not reach.* **MEDIUM and not HIGH because `SPK-FAILED-TURN`
already exists to land it — unlike F1, the vocabulary is not the obstacle.**

## F4 (MEDIUM) — AC-9, AC-10 · **"restore" is a forbidden word**

`§ Buttons`' one-word-per-concept table **already binds this exact concept to *put back*, and
lists *restore* among the words never used for it.** The spec uses `restor*` **57 times**;
`put back` appears **3 times, none in an AC body.**

*If design judges a 30-day recovery to be a different concept from a ten-second one, **the
table owes a second word — it may not reuse a forbidden synonym.** API route and field names
are unaffected.*

## F5 (MEDIUM) — AC-9, AC-10 · notice content for **1 of 4** outcomes

(b) already-live, (c) expired, (d) orphaned step **and the cascade have none** — *so three of
the four outcomes AC-16's 4.1.3 requires announced have nothing to announce*, and the cascade
needs a shape AC-10's singular sentence cannot hold: **two tasks, possibly two collections,
in one elapsing row.**

## F6 (MEDIUM) — AC-10 · the three-in-a-row justification leans on undrawn multiplicity

*Under the resolution F-005 AC-47's anti-stacking bound pushes toward, **each report replaces
the one before it unread**, and AC-10's whole reason for stating no relocation rule becomes
untrue again* — **the third time this AC has leaned on behaviour it does not own**, after
revision 3 withdrew the first two.

## F7 (LOW) — AC-17 · no success post-state, and the copy is wrong for it

*The only candidate render says **"nothing has been deleted recently"** immediately after the
user destroyed nine entries by name.*

---

## Round-1 findings — six of six hold

no-failure-design **fixed** (four states, three forbidden the empty render **by name**) ·
post-restore moment **fixed for one restore**, both false sentences **withdrawn, not
deleted** · count-only confirmation **fixed**, and AC-17 adds the total, *which is the right
addition* · silent second-entry removal **fixed** — AC-9: *"It is never silent."* · done-task
entry **fixed** · the missing word **routed to § Buttons** *(but see F4 — **I checked that
table and missed the row two below the one I quoted**)* · menu-row family and id **fixed**.

**§9 re-verified against `components.md` line by line. Every claim is accurate. It is
incomplete by two artifacts: `§ Spoken frames` (F1) and `§ Buttons`' existing binding (F4).**

## The routed question — acceptable, and one thing makes it so

> **Two things make it acceptable.** AC-14 requires the reply to **name the trash as a
> place** — the same remedy the owner chose at §7, for the same reason. And §8's inert
> message door means **nothing broken is rendered**: the door gates on a row in
> `state.tasks`, a deleted row is never there, **so the task name arrives as plain text
> rather than a tappable link that does nothing.**
>
> **What is not acceptable is F1, and it is the same sentence seen from the other end.** The
> decision authorises the assistant to say where the task went, **and there is currently no
> frame that can say it.**
>
> **The dead end's cost is not the missing action — it is the missing sentence.** Fix F1 and
> the price the owner named is the price the user actually pays. Leave it, and the assistant
> answers *"what happened to the dentist task?"* with a no-match — **worse than the exclusion
> the decision overturned.**
>
> *One measurement for the reversal case: the largest trash in the live store is **9
> entries** and 53 of 57 rows are singletons, so a user told only the place name finds their
> entry immediately.*
