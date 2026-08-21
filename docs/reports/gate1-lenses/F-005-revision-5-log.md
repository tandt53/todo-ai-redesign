# F-005 — revision 5 log: one row per edit, with the AC ids touched

**Date:** 2026-08-19 · **Task:** T-177 · **Agent:** spec-agent
**Reads against:** `docs/reports/owner-decision-2026-08-19-carried-notice-placement-and-timer.md`
(all five sections), `docs/reports/owner-decision-2026-08-19-close-gate-one.md` §2 (the decision
this one amends), `docs/design/_shared/components.md § CarriedNotice`, and
`src/assistant/mobile/model/carried.ts`.

**This is not a review round.** There were no lenses and no findings. Gate 1 closed on 2026-08-19
and revision 4 shipped; this pass folds in **one owner decision taken after the gate**, while the
owner was looking at the feature running on an iOS simulator. The four previous logs disposition
*findings*; this one dispositions *edits*.

**The finding that is not a finding, recorded because it is the most reusable thing here.** The
owner saw `CN-UNDONE` docked under the top bar and asked whether design or the implementers had
got it wrong. **Neither had.** `components.md § CarriedNotice ## Placement` specifies the region
docked below the top bar and outside the stacking layer, and mobile renders it at the frame
(`AssistantScreen`, not `ShellHost`) for exactly the reason design gives — S3 Lists and S4
Settings slide over the content and **under** this region, so a region inside the shell would be
invisible on Settings and AC-47's *"visible wherever the user is"* would be met at three of five
surfaces. The absence of a timer was AC-47, AC-43 and AC-33's 2.2.1, each tightened deliberately
in revision 4. **Every artifact was correct against the requirement; the requirement is what
changed, and only the owner can change it.**

## The constraint, and whether it held

**Amend-only, fourth revision running: 48 ACs before, 48 after, contiguous 1–48, nothing
renumbered, nothing deleted, nothing added.** Verified mechanically:

```
grep -c '^- \[ \] \*\*AC-'                      → 48
id list sorted                                   → 1..48, no gaps, no duplicates
bash .claude/tools/spec-check/declared-elements.sh → exit 0 (all 21 declared fields accounted for)
```

`declared-elements.sh` was run **before** this revision as well as after, both exit 0, so a
failure could have been attributed rather than assumed (**L-016**).

## The five edits

| # | Edit | ACs touched | Where it landed |
|---|---|---|---|
| **a** | **The region's edge is a requirement and it is the bottom of the frame** (owner §1) | **AC-47** | AC-47's *"Persists is not is visible"* bullet, appended. **No AC constrained the edge before** — *visible wherever the user is* is met at the top as well, which is why nothing was violated. **One constraint travels with it and it is the AC's rather than design's: the region may not occlude the app's primary input.** On Talk the composer is at the bottom and the keyboard rises over it, so the region docks **above the composer** and moves with the keyboard. The strip-order rule is unchanged in principle and inverts in rendering: *a strip that is not about the surface it appears on stays furthest from that surface's content* |
| **b** | **The family stops having one lifetime, and the split is by what the row carries** (owner §2) | **AC-47** | A new bullet ahead of the persistence bullet, plus two sub-bullets. **A row carrying a value the user typed is never withdrawn by time; a row carrying nothing the user typed is withdrawn ten seconds after it appears.** The persistence bullet is retitled *"A **value-carrying** row persists…"* so its rule is scoped rather than contradicted |
| **c** | **AC-43 gains a fifth ender, and *"and by nothing else"* names it** (owner §2) | **AC-43** | AC-43's lifetime bullet. Enders: used · dismissed · replaced · reloaded · **ten seconds pass**. **Revision 4's *"it does not elapse"* is withdrawn with its reason kept** — that reason was tester W8's objection that revision 2's *floor on the duration* was **unmeasurable**, and a stated number is not, so what changed is the premise and not the reasoning (**L-019**) |
| **d** | **AC-33's 2.2.1 is restated in two halves, with the F-006 dependency written in** (owner §4) | **AC-33**, cross-referenced from **AC-43** | AC-33's 2.2.1 bullet. Half (i) keeps the absolute, narrowed to the property that carried it. Half (ii) states the ten-second limit **and what makes it conformant**, per class, in a five-row table |
| **e** | **OQ13 closes** (owner §4) | **AC-41**, **AC-43**, **AC-47**, **AC-33** | `## Open Questions` OQ13, marked CLOSED with the question kept below it on OQ6's precedent; AC-41's depth bullet rewritten |

## Edit (b) — why the rule is stated by carried content

**Stating it as a list of row ids would have been the defect, not the shorthand.** A rule written
as *`CN-UNDO` and `CN-UNDONE` elapse* is one that the next row added to this family joins **by
default**, and the default is whichever list the author happened to extend. A rule written as
*a row carrying a value the user typed never self-dismisses* decides that case before the row
exists.

**It also settles a row the owner's own table does not mention.** The decision's §2 table names
`CN-FAILED`, `CN-OFFLINE`, `CN-DELETED` in the never-elapse group. **`CN-SUPERSEDED` is in neither
group in that table** — and it carries the user's superseded text, which is the last legible copy
of what they typed. Under an id list it would have had no rule; under the content rule it is in
the first group without anyone having to notice. This is recorded because it is the concrete
evidence for the framing rather than an argument for it.

**The boundary is already a seam in the code.** `carriedRows()` builds `CN-UNDONE` with
`blocks: []` and `action: null` and `CN-UNDO` with `blocks: []`, while every notice row carries
one block per affected field (`src/assistant/mobile/model/carried.ts:206-213` and the
`CarriedRow` type at `:93-96`). The AC names an existing seam; it does not ask for a new one.

## Edit (d) — the trap, and what was done about it

**A ten-second limit on an affordance carrying an action is exactly what 2.2.1 Timing Adjustable
governs.** The reachable wrong answer is **pause-or-extend-on-hover**, and it is wrong here for a
specific reason rather than a general one: **revision 4 rewrote this very bullet to remove the
reading that a five-second timer extended on focus satisfies the criterion** (tester-web R4).
Citing it now would reinstate, one revision later and in the same sentence, the defect that
rewrite existed to fix. It is named in the AC as *not the answer* so that nobody re-derives it.

**What makes the limit conformant is what remains reachable after it expires, not what postpones
it.** The criterion governs a time limit on **completing an activity**; where letting the limit
expire costs the user nothing they cannot still reach by an untimed path, no activity is gated.
So the AC states the untimed equivalent **per class of undoable action**, because AC-43 covers
five and they do not all have the same one:

| AC-43 class | Untimed path to the same outcome | Depends on F-006 |
|---|---|---|
| delete a task from the detail (AC-31) | F-006's trash, for its retention period | yes |
| delete a task from a list row (AC-42) | F-006's trash, for its retention period | yes |
| delete a step (AC-14) | F-006's trash, for its retention period | yes |
| delete a whole series (AC-30) | F-006's trash, for its retention period | yes |
| **reorder steps (AC-15)** | **the ordinary reorder**, by pointer or by AC-16's keyboard alternative | **no** |

**The reorder row is this spec's addition, not the owner's decision's**, and it is the reason the
edit was written rather than blocked. The decision reasons about **destructive** actions
throughout — *"a ten-second limit on the only remedy for a destructive action"* — and a reorder is
not destructive, so the trash does not cover it and never will. Read across all five classes, the
decision's own argument would have left **one class asserting AA conformance with nothing behind
it**. Its untimed equivalent is the ordinary reorder, which AC-16 and AC-33's own 2.1.1 already
require to be operable by keyboard, so the gap closes without any new obligation.

**The dependency is a shipping order, not a note.** `## API Touch Points`-style recording would
have been too weak: an AC that says *the timer is fine* without saying *because the trash exists*
becomes a **false conformance claim the moment F-006 slips**, on a feature that declares WCAG 2.1
AA by name in its own first sentence. So AC-43 carries it as a condition on shipping — **the
ten-second elapse on `CN-UNDO` does not ship before F-006** — which matches the owner's §5, where
the ordering is stated as a requirement rather than a preference. **`CN-UNDONE` has no such
dependency**: it carries no action and no typed value, so there is nothing to complete and nothing
to lose, and it may elapse from the day it is built. §1's placement has none either.

**The claim is written to be falsifiable.** Remove any row's untimed path and half (ii) fails for
that class — which is what a conformance claim has to permit if it is a claim rather than an
assertion.

## Six sentences elsewhere that would have been left standing

This is the shape revision 4 named as round 3's most common defect — *a new rule lands in one
place and the sentence it replaces stays standing* — so each was found by grepping the document
for the rule rather than by reading around the edit.

| Sentence | Where | What was done |
|---|---|---|
| *"…that it offers retry, that it does not self-dismiss…"* | AC-47's own summary of its non-negotiables — **the list revision 4 had to fix once already**, for placement | qualified to *"that a row carrying the user's value does not self-dismiss"*, with the reason recorded inline: this list is what a reader follows instead of the bullets |
| *"it carries the value… does not self-dismiss, and is not cleared by leaving the surface"* | AC-47's `(web, mobile)` bullet — enumerates the phone's half, **which now contains a row that does elapse** | qualified, and the ten-second rule stated as binding on the phone exactly as on web, since the split is by carried content and not by platform |
| *"…why the notice must not also be dismissible by a timer…"* | AC-47's reload bullet | scoped to *a value-carrying notice* |
| *"Three mutations must turn it red — … a notice that self-dismisses on a timer …"* | `## Test strategy`, AC-47's case | scoped to a value-carrying row, **because a mutation test written against the family would now be red on the required behaviour** — the worst outcome for a case whose job is to fail honestly. The elapse is given its own case with its own two mutations |
| *"Across 48 ACs there is not one timing bound"* | **OQ 15** | corrected: there is exactly one now and it is not a performance bound. The three ACs wanting a *performance* bound still have none, which is what OQ15 is actually about |
| *"OQ13 asks the owner about the depth of recovery and now names both causes"* | AC-43's revision-4 parenthetical, in the **present tense**, pointing at a question this revision closes | a revision-5 clause appended; the revision-4 sentence kept, because it was true of the state it described |

## What leaves this spec as a dependency

**F-006 — *Recently deleted*.** Two things AC-41 records as missing are now F-006's rather than
architecture's: **there is no read path that returns a deleted row** (`GET /tasks` filters
`deleted_at !== null` and no route returns one), and **nothing has ever purged one** — 53 of 790
rows are already soft-deleted, so a stated retention rule is what turns a leak into a trash. The
data for a trash has been there since F-001; the surface has not.

**And AC-33's half (ii) is the load-bearing one to re-read if F-006 changes shape.** If F-006 ships
without a restore, or with a retention shorter than a user could reasonably act within, half (ii)'s
first four rows lose their untimed path and the conformance claim fails for those classes. The AC
is written so that this is checkable rather than buried.

## What design now owes

`components.md § CarriedNotice` was correct against revision 4 and is now stale in three places —
it is **design's to amend, not this pass's**, and it is listed here so the obligation is recorded
rather than assumed:

1. **`## Placement`** — *"docked directly below the top bar"* becomes the bottom of the frame,
   with the Talk-composer and keyboard rule.
2. **`## Lifetime`** — *"There is no timer anywhere in this family, so WCAG 2.2.1 is not
   engaged"* is now false as written, and the table's *"And by nothing else. Not by elapsing…"*
   needs the split.
3. **The strip-order rule** — *outermost first* was written from the top; inverted it reads
   *furthest from the surface's content*, which is the same principle and a different rendering.
