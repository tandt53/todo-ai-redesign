# Owner decisions — a third round, and what an offline edit does

**Date:** 2026-08-18. Two questions, two answers, both taking the recommended
option. Both were escalated at Gate 1 round 2, which returned **REJECT — 40 HIGH,
44 MEDIUM, 15 LOW across nine lenses**.

---

## 1. One more round, with a constraint that stops it recurring

**Chosen:** the round cap is waived **once**. Revision 3 **amends existing
acceptance criteria only** — no new ACs unless a finding cannot be closed any
other way — and the re-review is **targeted**: only the ACs that changed, read
only by the lenses that raised the findings on them. Not all nine lenses, not the
whole spec.

**Why the cap did not fit this case.** The cap exists to stop lenses and
spec-agent trading revisions indefinitely. That is not what happened. Round 1
found 20 HIGH across 37 ACs; the revision closed them, and **in closing them it
added eleven new acceptance criteria — AC-38 through AC-48 — which no lens had
ever read.** Round 2 was therefore two reviews at once: a re-check of the
dispositions, and a first reading of eleven ACs. Most of the 40 HIGH are on the
new material or on what it collided with. A rule written against an unproductive
loop was about to stop a productive one.

**Why the constraint is the substance of the answer, not a footnote.** The
mechanism that produced this situation is exactly *revision adds ACs → new ACs are
unreviewed → the next round finds them*. Left alone it runs again: revision 3
would add ACs, and the targeted re-review would be reading new material rather than
checking amendments. **No new ACs is what makes this the last round rather than the
third of an unknown number.** Where a finding genuinely cannot be closed by
amending an existing AC, spec-agent says so explicitly rather than quietly adding
one — and that becomes a decision, not a default.

**What it costs to be wrong.** The two rejected options both had a named price.
*Revise once and ship unreviewed*: the forty most delicate edits in the feature —
including the fix to a clock-and-zone model six lenses independently called broken,
and to an undo that can hard-delete a user's work — land with nobody having read
them, and edits of exactly that kind are how the three sharpest defects found today
came to exist. *Proceed now*: the next agent to touch F-005 is architect-agent, and
**the architect lens itself named two of its findings as ones no later check can
catch** — the undo record's capture boundary, and the close-then-fail gap.

## 2. An offline field edit is refused, and the app says so

**Chosen:** while offline, a field edit is **refused, with the user's value kept on
screen and the reason stated**. No queue, no durable store, no replay. `OQ6` closes
against this.

**The question had a false premise, and correcting it is most of the answer.** OQ6
asked whether an offline edit should be *"kept and sent later, or lost"*, and the
spec recorded the behaviour as already defined by AC-2 with only durability open.
The dev lenses read the code: `toggleTask`, `editTask` and `removeTask` all return
before attempting anything when `state.offline` is set, and `persistLocal()` saves
only rows the user created locally. **So an edit to a server-owned task is never
sent, never queued, and silently replaced at the next refresh.** There is no
pending edit whose durability was in question. The real question was: *the app
accepts your change and quietly throws it away — what should it do instead?*

This is the second time today a question reached the owner on a stale premise —
the mobile scope question was the first — and both were corrected before the
answer. The correction is recorded here so the answer is read as a decision on the
facts.

**What this buys.** It closes AC-2's uncovered third state directly: the two states
AC-2 describes are *in flight* and *failed*, and this one is *never attempted*,
which is why AC-2's guarantee could not reach it. It is honest about a loss the
user is already suffering unannounced. And it settles AC-47's open half: **the
notice does not survive a reload**, because there is nothing to carry across one.

**The rejected alternative and its price.** Queue-and-replay is what users expect
from a todo app, and it was declined for cost rather than principle: it needs a
durable store, conflict rules for a server row that moved meanwhile, and it widens
the one replay path that **already silently drops five fields** — an inline
five-field literal in `pushLocalTasks` that is a fifteenth closed field list the
spec's `## Impact` §1 never enumerated. Widening a path with a known silent-drop
defect, to carry more fields, is the expensive order. If offline editing becomes a
real requirement, it is its own feature with its own spec.
