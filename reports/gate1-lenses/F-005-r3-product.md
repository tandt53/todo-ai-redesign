# Gate 1 round 3 — F-005 — product lens, targeted re-review

Persisted per **L-009**. **REJECT — HIGH 2 · MEDIUM 2 · LOW 1.** All 14 listed ACs
re-read plus `## Open Questions`, `## Out of Scope`, `## API Touch Points`, `## Ops`,
`## Test strategy`.

**All 12 round-2 product dispositions landed as claimed — none is a paper row.**
Constraint verified independently: 48 ACs, ids contiguous 1–48, none renumbered.
**No finding of this lens was closed by a clause that could not carry the obligation —
the risk the owner asked to have reported did not materialise here.** Both new HIGHs are
defects the amendment introduced.

Verified landings worth naming: **P1** (acknowledgement not render, with the resolution
triple, plus `## Ops` counters and a falsifiable negative case) · **P2** (AC-33 widened
rather than a second a11y AC; **every AC this lens named is covered**) · **P4** and
**P10** (deferrals *done properly* — the cost is in AC-41 and AC-29 themselves, not only
in the open question) · **P5** (AC-44 inverted; **no longer code-existence**) · **P8**
(the unmeasurable floor gone) · **P9** (**nothing lost in the list→rule conversion** —
4.1.3 restates every item the old list carried plus four it was never updated for) ·
**P11**, **P12**.

## HIGH

**P13 — AC-43 says the undo offer ends by three enders "and by nothing else"; revision 3
settled that AC-47's family, where AC-43 says it renders, does not survive a reload.**
So a reload is a fourth ender of **the one reversal for the one irreversible action in
the feature**, and AC-43 says it cannot exist. The two cannot both be built: honouring
"by nothing else" needs the durable store the owner declined at OQ6. An implementer
resolves it pragmatically and silently, and **a reload inside the undo window makes a
deleted step or task permanently unrecoverable** — Logbook is out of scope and AC-41's
restore has no other consumer. **That is OQ13's permanent-loss path reached by a second
mechanism OQ13's text does not mention, so the owner is answering the depth question with
one of its two causes hidden.**

**P14 — AC-2's third state states flatly that an offline edit is refused with "no queue,
no durable store and no replay", and that is false for the rows AC-14's own offline-create
clause is about.** The branch is `task.local === true || this.state.offline`
(`controller.ts:604,620,632`), and for a locally-created row `persistLocal()` genuinely
saves the edited row and `pushLocalTasks` replays it. **The owner's answer was decided on
the server-owned case — the diagnosis in AC-2 says "an edit to a server-owned task" — and
the rule was then written without that qualifier.** Built literally, **the spec removes
working behaviour**: a user creates a task offline and then cannot fix a typo in it. QA
writes from the spec, **so the test asserts the refusal and the regression ships green.**
The same branch fires for a local row **while online**, where "you are offline" is not
even a true thing to say to the user.

## MEDIUM

**P15 — no gesture is named for acknowledging, and there is no aggregate exit.** The AC is
explicit that clearing the surface is not acknowledgement ("ten surfaced together of which
three were acted on do not silently retire the other seven"). So an unacknowledged
reminder re-surfaces at every open — **and AC-38 itself says "a foreground happens dozens
of times a day"** — and ten passed reminders cost ten gestures or they return all day.
**That is the single most complained-about reminder behaviour in the category** (users
report deleting apps over reminders that return after Dismiss), while the
persistent-until-acknowledged pattern that works — Due, TickTick, Timely — **always pairs
persistence with an explicit user-invoked dismissal.** AC-47 has exactly that and is this
AC's stated sibling.

**P16 — AC-38's "recorded when connectivity returns" is the shape AC-2's third state
forbids by name** ("never by a timer and **never by reconnection**"), both written in the
same revision. An implementer builds a pending-write-and-replay mechanism for one field —
**the mechanism the owner declined to fund** — and the AC does not say whether it survives
a close or a reload, which is the durability question OQ6 was closed on. *The safe default
— nothing held, the reminder re-surfaces — needs one sentence and contradicts nothing.*

## LOW

**P17 — AC-44 refuses a date computation when the account has no stored `timezone`, and
nothing says when it is first populated.** A refusal the user cannot act on: AC-18's rule
requires a visible outcome, and "we do not know your timezone" is not a thing a user can
fix from the detail surface. It lands on an ordinary path at an unknown rate, **most
likely on a first run.**

## Checked, nothing found

AC-1, AC-32 (OQ15 names both by id; AC-1's one-action bound and its per-field budget
unchanged and assertable) · AC-6, AC-14, AC-37 (**the failure mode is now a refusal the
user can see**; that no bound is *required* to exist is recorded, not raised) · AC-29
(**the deferral model this lens asked for** — cost in the AC, in `## Out of Scope`, and in
OQ14) · AC-41, AC-42 · AC-47, AC-48.

**Weighed and dropped, named so the owner can see it:** AC-33's mobile criteria are
verified only on F-003's debt list with "no headless observable at all", so nothing turns
red at merge — **dropped because the spec records them as knowingly unverified and routes
them to an existing debt list rather than a second one.**

**Pairwise re-read of the owner's answers against P1's fix (L-015's procedure, applied to
the revision rather than by it): three of the five findings above are that composition** —
P14 and P16 are the offline answer meeting AC-14 and AC-38, P13 is the offline answer
meeting P8's tightened AC-43.

**Routing:** all five are revision tasks to spec-agent, amendment-sized, no new AC needed.
**No conflict with another lens requiring a human decision from this lens.**
