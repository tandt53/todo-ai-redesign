# Gate 1 round 3 — F-005 — architect lens, targeted re-review

Persisted by the orchestrator per **L-009**. **HIGH 2 · MEDIUM 2 · LOW 2.** All 17
listed ACs plus `## Data`, `## API Touch Points`, the User Flow diagram, `## Impact`
§1/§9/§10/§11/§12, `## Ops`, `## Out of Scope`, `## Open Questions`. Source re-checked
at `_shared/controller.ts:727-760` and `data-model.md:60`.

**Both findings this lens named as uncatchable later — F2 (AC-46's capture boundary)
and F4 (close-then-fail) — landed.** F2's ordering is normative, all three records
named, §9 routes all three falsified contract documents. Nine of eleven dispositions
landed whole. **The two HIGHs are defects the amendments introduced.**

## HIGH

**F1 — AC-14 vs AC-2's third state: opposite contracts, both written in revision 3.**
AC-14 requires an offline-created step to be queued locally and replayed carrying
`parent_id` and its position; AC-2's third state, the **User Flow diagram** (edge
`E -->|offline| V` routes *add a step* to the refusal node **by name**) and
`## Out of Scope` all say an offline write here is refused with "no queue, no durable
store and no replay". AC-14 needs `TASK_CREATE_FIELDS` and `pushLocalTasks`'s literal
widened by two fields; `## Out of Scope` states as part of the owner's decision that
there is "no widening of `pushLocalTasks`'s replay literal", and §1 gives that widening
as the reason queue-and-replay was the *expensive* answer to OQ6. **L-015's shape a
third time: the owner's answer and this lens's own F10 amendment were folded in the
same revision and never read against each other.** Earliest catch is a QA case per
client at execute, or never — both paths look like working software.
**The lens states this blocks it specifically:** it is the next agent to touch F-005,
and the create contract (`TASK_CREATE_FIELDS`, the replay literal, whether `step_order`
is client-writable) cannot be written until it is answered. F4 sits on the same decision.

**F2 — AC-46's revert rule covers only the created class, and the AC governs two.**
AC-46 governs a row the server "creates **or changes**"; the chosen rule — "reverted
only if it would still be removable under AC-28" — describes only created rows. AC-28's
five conditions (`series_id`, created-no-earlier-than-the-completion, never-edited,
not-itself-done, no-step-ticked) are **not satisfiable by an AC-19 cascade step**, which
has no `series_id`, predates the turn, and is not *removed* at all but un-ticked. Read
literally: **no cascaded step is ever reverted**, so undoing a voice "done" on a parent
with eight steps reopens the parent and leaves all eight ticked — *precisely the
half-reverted undo this AC's own opening sentence calls worse than no undo, arriving
through the clause written to prevent it.* Read charitably: whole-row replay with no
guard, which reverts hand ticks the user made after the turn — the case
`completed_by_parent` exists to distinguish, and **L-012's shape**. Neither is caught
downstream: the natural AC-46 test uses a repeating completion, the class the clause
does cover. *Directive:* state the revert condition **per class** — created successor
under AC-28's five conditions, cascaded step under AC-19's `completed_by_parent` guard.

## MEDIUM

**F3 — AC-21 calls six recurrence members "scalar fields"; `## Data` declares two of
them as sets** (a day-of-week set, an int set 1–31). `data-model.md:60` declares
`diff: {task_id, field, old|null, new|null}[]` and F-001 AC-4 renders `old → new` per
field, so a set on either side is **the same collision the amendment was written to
close** — holding for four members and failing on two, emitted on every create and
delete of a repeating task with a weekly or monthly rule.

**F4 — `## Data`'s `step_order` cell and AC-14 disagree about who assigns.** The cell
says "assigned by the server on create", unconditionally; AC-14 says the server assigns
only when the create supplies none, and preserves a replayed position. **`## Data` is
the cell the create contract is written from** — taken at its word it produces a
`POST /tasks` that ignores or rejects a client-supplied `step_order`, silently voiding
the amendment while every AC still reads as satisfied.

## LOW

**F5 — AC-15's reorder undo gives the prior position two different sources in one
sentence pair** — "carried by the move's own response" and "a value the client already
holds". Two different contracts satisfy it, and the AC was amended specifically to say
"no new record is owed" — which only the second reading makes true.

**F6 — the multi-row enumeration in `## API Touch Points` keeps the cluster *restore*
and drops the cluster *delete***, which AC-26's own text still carries. A parent delete
changes N+1 rows and now also writes `delete_membership`. The rule leads the bullet
(which is what F1 asked for), so this is LOW — but the asymmetry reads as deliberate to
whoever builds the DELETE response.

## Checked, no finding

**arch F1 (multi-row)** became a rule in both places with the receiver half added on both
clients and **the false blind-`GET` premise quoted and corrected rather than deleted** ·
**arch F2** fully landed — the ordering is normative in the AC ("the write plans the rows
it will create or change, records them in the turn's record, and then applies"), and the
record-to-row mapping is correctly left to architecture · **arch F3** landed for the
created class; the gap is the changed class (F2 above) · **arch F4** landed: AC-47's
trigger no longer keys on the instant of closing, AC-2 names the ordinary outage order,
the flowchart gains the edge, `## Ops` states there is no third category,
`## Test strategy` has the case · **arch F6** landed at all three sites; both
contradictory states are now unreachable · **arch F8** landed *together*, which was the
requirement: `none` is the absence of a stored value, reconciling `Required: yes` with
§6's measured claim, and both consequences quoted back in the AC · **arch F9** one word ·
**arch L1** landed, with the AC-41-restore consequence named · AC-30, AC-41, AC-19
re-read for damage, unchanged and consistent.

**The constraint held for all eleven of this lens's findings.** F2 and F3 are amendments
**incomplete on a named subset**, not clauses standing in for a missing AC. Nothing in
this set argues for a 49th AC.
