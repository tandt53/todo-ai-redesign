# Owner decisions — closing Gate 1, and two behaviours

**Date:** 2026-08-19. Three questions from Gate 1 round 3 (58 findings: 25 HIGH,
22 MEDIUM, 11 LOW).

---

## 1. Fix the contradictions, then go to architecture

**Chosen:** one final amend pass, **no fourth review**, scoped to the findings where
**the spec contradicts itself, another spec, or an owner decision**. The findings that
ask for a *mechanism the spec cannot state* are handed to architect-agent as briefing
input rather than answered by spec-agent.

**The reasoning, which is a split rather than a compromise.** The 25 HIGH fall into two
kinds and they have different owners:

- **A contradiction must be fixed in the spec, because only the spec can say which of
  its two sentences is true.** Nobody downstream can resolve `## Out of Scope` forbidding
  the change AC-14 requires — an implementer just picks one and half the document becomes
  false. Same for AC-2 dropping the word "server-owned" that the owner's own decision
  carries, and for AC-47 stating the reopen case twice in opposite directions.
- **An unstated mechanism is what the architecture phase exists to state.** The
  timezone's write path, the 53 rows already soft-deleted with no membership record, how
  a set-valued recurrence member appears in a diff row — these are questions being asked
  *of* a spec that the next phase *answers*. Making spec-agent invent answers means
  architect either inherits a guess or unpicks it.

**What it costs to be wrong.** A fourth review round was the rejected option, and the
reason is measured: three rounds have gone 20 → 40 → 25 HIGH, and round 3 established
that **the dispositions land and the amendments do the damage** — an amendment closing a
finding and opening a defect in the same paragraph, named independently by three lenses.
There is no basis for believing a fourth round converges rather than producing a smaller
crop of the same thing. The risk accepted is that the final amend pass introduces
something nobody reads; it is bounded by scoping the pass to contradictions, where the
correct answer is already visible in the document.

## 2. The hand-action undo lives in the notice strip that follows the user

**Chosen:** the undo offer renders where AC-47's notice renders — reachable from
wherever the user is, including Talk and Settings — not on the row the action happened
on.

Three amendments had put it in three places. This picks one, and it is the one that
survives a surface change: the row-local option loses the offer exactly when the user
navigates away, which on the phone is one tap and is the app's primary gesture.

**Two consequences that follow automatically, and are not separate decisions:**

- **A reload is a fourth ender.** AC-47's family does not survive a reload — the owner
  settled that on 2026-08-18 — so AC-43's *"and by nothing else"* is now false and must
  name the reload. This matters beyond tidiness: **it gives OQ13's permanent-loss
  question a second cause the open question does not currently mention**, so OQ13 is
  re-stated with both before it is answered.
- **The row's mark budget is three, and the undo is not one of them.** `## Impact` §8
  used "three" for two different sets. With the undo rendering elsewhere, the row's set
  is AC-9's urgency mark, AC-17's step counter and AC-39's repeat indicator.

## 3. Acknowledging a passed reminder is a deliberate act on the reminder itself

**Chosen:** an explicit per-reminder action on the surfacing. **Opening the task does not
count. Scrolling past does not count. Rendering does not count.** No bulk "dismiss all".

Six lenses found the term undefined, and the reason to draw the line here is the case
they all described: a user taps to look, is interrupted, closes the app — and under any
looser reading the reminder is **spent permanently, on every device**, which is the exact
defect the acknowledgement model was introduced to close.

**The cost is accepted knowingly:** ten passed reminders take ten gestures. The product
lens argued for a bulk dismissal on market grounds and it was declined — a single gesture
that retires reminders the user has not read is the looser reading wearing a convenience
label, and it fails on the same case. If the N-gesture cost turns out to bite in practice
it is a later, cheap addition; a reminder wrongly retired is not recoverable.

**Consequence:** AC-38's offline half must change. It currently says the acknowledgement
"is recorded when connectivity returns" — the queue-and-replay shape the OQ6 answer
forbids by name, written into the same revision. With acknowledgement now a deliberate
act, the honest default is that **an offline acknowledgement is not recorded and the
reminder re-surfaces at the next open**, which contradicts nothing and needs one sentence.
