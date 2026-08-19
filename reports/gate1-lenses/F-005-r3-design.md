# Gate 1 round 3 — F-005 — design lens, targeted re-review

Persisted per **L-009**. **HIGH 2 · MEDIUM 4 · LOW 1.** Nine ACs re-read plus
`## Impact` §8, §9, `## Ops`, `## Test strategy`, OQ5.

**Seven of eight dispositions landed as claimed.** The one that did not is **D14's own
remedy** — not the colour half, which is genuinely fixed at all three sites (AC-9, §8,
OQ5 all now say *carried without colour — shape, weight, accessible name — unless a new
accent token is added first*), but the **mark budget** revision 3 attached to it.

## HIGH

**D21 — the hand-action undo has three different homes, from three amendments made for
three different findings.** AC-43 says it is "offered **in place** at the moment of the
action"; AC-43's teardown bullet says "it renders **where AC-47's notice renders**"; and
AC-9/§8/OQ5 count it as one of three marks that "want **this row**" — a fourth position,
since AC-47's notice is by its own text "reachable from wherever the user is, including
Talk and Settings", which is not the row. **Three readings are three products**, and it
makes the row's mark budget arithmetic wrong at its source: §8 asks design to decide a
budget of three over a member that two ACs render somewhere else. No existing component
resolves it — `§ UndoAffordance` is a button inside conversation bubbles and `§ TaskRow`'s
anatomy is checkbox + title + due meta. Earliest catch is C11/C14, **after the mockups are
drawn against one reading and the build follows another.**

**D22 — "shown" was undefined; the remedy replaced it with "acknowledges", which is also
undefined.** No gesture is named, and the AC slips vocabulary within four lines ("only
what the user acknowledges is marked" … "ten surfaced together of which three were **acted
on**"). **The natural bindings are not equivalent and one reproduces the exact defect the
amendment exists to close:** if opening or tapping through to the task counts, a user who
taps to look, is interrupted, and closes the app **has spent the delivery permanently, on
every device**. Design cannot draw the surfacing (which control acknowledges it?),
architecture cannot shape the write `## API Touch Points` now owes, and `## Test
strategy`'s own case — "open, **do not acknowledge**, reopen" — **cannot be authored,
because "do not acknowledge" is not a constructible precondition until the gesture set is
closed.**

## MEDIUM

**D23 — §8 uses "three" for two different sets, two paragraphs apart, and neither is the
union.** The opening sentence names AC-9's mark, **AC-17's step counter** and AC-39's
indicator as "the three marks"; the budget paragraph names AC-9, AC-39 and **AC-43's undo
affordance** as "three new marked meanings that want this row". AC-17 is in the first and
not the second; AC-43 in the second and not the first. **The budget exists so design
decides the row once instead of absorbing three independent additions** — as written it
decides against the wrong count, on a row whose own record spent an explicit argument
keeping it clean one day earlier ("One signal, not two", `§ TaskRow` Overdue).

**D24 — AC-47 binds placement in one bullet and unbinds it in another.** The "what is
**not** design's" list has five items and **placement is not among them** — and that list
reads as the AC's own summary of its non-negotiables. Following it puts the notice in the
only strip family that exists, whose `§ SaveNotice` rule 3 clears on leaving the surface,
**which is precisely what the AC forbids two bullets earlier.** The binding bullet also
weakens the verb: the reading selected is "**visible** wherever the user is", the
requirement says "**reachable** from wherever the user is" — which admits a badge-then-tap
design where, during an outage, the user's typed value is one navigation away rather than
in front of them.

**D25 — AC-45's unconditional close is justified by a claim that is false for one
object.** It says "anything a close would otherwise have lost is governed by AC-2 and
AC-47". An **uncommitted repeat preview** is neither an in-flight write, a failed write,
nor an offline-refused write, and it is not a failure — so AC-47 never carries it. **AC-48
decided the identical case at the swap door** (discarded, and the user is told, once,
under 4.1.3) **and the close door has no such rule.** L-005's shape on a door revision 3
opened: configure a repeat, see AC-23's disclosure, tap `Talk` before committing, and it
is gone with no message — silently at one door and announced at the other, same object,
same release.

**D26 — D20's disposition creates a state with no lifetime.** Deletion "ends any
outstanding notice … reported once, with the value still legible, and with no retry."
The no-self-dismiss rule attaches to the **notice**, and deletion **ends** it — so nothing
governs how long the report carrying the user's typed value stays on screen, and the
detail is closed in the reachable sequence. **The report is the last legible copy of text
the user typed, and it is the one ender that offers no retry** — so if it self-dismisses,
the value is lost by elapse, which is what AC-47 exists to prevent, one ender over. **2.2.1
does not bind it either**: it is a report without an action, not an affordance.

## LOW

**D27 — AC-43 routes its label obligation to §8 and §9; only §9 carries it.** §8 is the
subsection design-agent reads as its own brief and **declares itself the place the debt is
named**. A dangling pointer there is how an obligation gets believed-recorded — **D14's own
failure mode.**

## Checked, no finding

AC-2's third state (**enumerable end to end**, with an explicit prohibition on the three
affordances that would imply a queue — spinner, pending badge, silent acceptance; success
and refusal distinguishable by the stated reason) · AC-2's close model · AC-4 (`§
SurfaceError`'s Retry correctly rejected) · AC-9 (four states; colour removed at all three
sites) · AC-33 (4.1.3 as a rule; 2.2.1 named and consistent with AC-43 and AC-47;
`(mobile)` with criteria named rather than re-derived) · AC-38 (two doors, N as one
surfacing oldest-first, `§ LandingSummary` routed, **the opposite-lifetimes statement that
makes the shared-family question one decision**) · AC-39 (positive, negative and the Done
case all enumerable) · AC-45 · AC-47 · **multiplicity in the shared family is drawable**:
0..N notices (one per task, bounded) plus 0..1 undo offer.

**The two new families' state count, re-run:** AC-47 ~9 implied / ~7 named; AC-38 ~6 / ~5.
**Both moved from "new family, new hole" to "one open term each"** — and both open terms
are D22 and D24.

## The lens's own two-minute review guide

Only **D21** and **D22** need the owner before build. Both are one clause. *Where does the
hand-action undo appear* — on the row, or in the notice strip that follows you around?
And *what counts as acknowledging a passed reminder* — if tapping through to the task
counts, the reminder is spent permanently by a user who only looked.
