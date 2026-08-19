# Gate 1 round 3 — F-005 — tester lens (mobile), targeted re-review

Persisted by the orchestrator per **L-009**. **HIGH 3 · MEDIUM 2 · LOW 1.** All 15
listed ACs re-read; every code claim run against the repo.

**All six dispositions landed in the spec text** — M1 (AC-9 → `(web, mobile)` as a
bound, §7's fifth row, OQ11 widened), M2 (AC-2's mobile post-state, *"did not
regress"* withdrawn), M3 (receiver clause, AC-39's positive mobile fixture), M4 (both
doors, single installer, one case per door), M5 (AC-33 `(web, mobile)`, F-003 AC-9/AC-12
named, `announce.ts` widened, `assistant-undo-button` ruled out), M8 (AC-35 names a
construction path); M6, M7, M9, M10 also landed. **Three landed with a new defect
inside the amendment.**

## HIGH

**M11 — AC-35 — the construction path's two options contradict each other, and the
three readers cannot share one rule.** The new sub-bullet names one account (all
parents excluded from the collection on screen, `collectionTasks` empty while
`state.tasks` is not), requires the three raw-cardinality readers to choose
**empty-collection** there, then offers deriving those readers from `collectionTasks`
as equally satisfying — but in that account `collectionTasks` is empty, so
`tasks-view.ts:113` returns `empty-first`, **the first-run state the same sentence
forbids.** And the three readers need opposite sources for option 1: `tasksSurfaceView`
reaches `empty-collection` only from raw `state.tasks.length > 0`, while
`a11y.ts:276-278` adds `taskRow`/`taskCheckbox` from `index.ts:244`'s `hasTasks` —
**expecting rows in a view that returns `tasks: []`.** Verified by running the account
through all three readers. *Directive:* state the outcome **per reader**, not per group,
and correct the earlier `## Test strategy` bullet, which still names the
unconstructible "only rows are steps" fixture while a later bullet names the corrected
one.

**M12 — AC-38 — the offline acknowledgement is a new obligation with no doors, no home
and no test: L-005's shape reinstalled one clause after L-005's remedy.** The clause ends
*"acknowledgement is recorded when connectivity returns"* — and **that recording has two
doors of its own**, while the AC enumerates only the *opening* doors. `setOnline()` →
`reconnect()` fires only if the OS reports the transition while foregrounded;
`onForeground()` reconciles without it, and `mobile/controller.ts:285-292` says in its
own comment that owing a replay to that coincidence *"is what left offline-created tasks
device-local on the commonest path there is"* — **BUG-001's mobile half.** Where the
un-sent acknowledgement lives is also unstated: `stores` persist `pending_input` and
`outgoing_turn` and nothing else. *The AC installed L-005's remedy for the surfacing
transition and created a second unguarded transition in the same paragraph.*

**M14 — AC-44 (with AC-13) — the stored-zone rule has no answer for the offline mobile
create, which is the ordinary phone case.** `createLocalTask`
(`_shared/controller.ts:671-690`) computes `dueAtForCollection(...)` → `startOfTodayIso`
entirely client-side while `state.offline`, with `refreshTasks()` returning early
(`:639`) so no server value is reachable. The only zone in reach is
`ControllerDeps.timezone` (`mobile/index.ts:131`) — **the client's own report, which is
exactly the "one row, three answers" source AC-44 was rewritten against.** This is a
third mobile date computation and **not** an inline-clock defect: its seam is already
clean (`this.now()`); it is the **zone** it cannot get. Three buildable outcomes, spec
chooses none: refuse the create (undoing BUG-001's fix), compute from the client dep
(the device's answer, replayed verbatim), or defer to replay (which `createLocalTask`'s
own comment says loses it "for exactly the users who cannot see the server correct it").

## MEDIUM

**M13 — AC-38's headline falsifiable clause is contradicted by the path just added.**
Acknowledge while offline, get killed before connectivity returns — ordinary on a phone
— and the marker was never written, so the reminder surfaces again as new. The AC covers
"in the meantime" and not across a cold open, and no precedent points either way: the
owner's OQ6 answer forbids a durable store and AC-47 dies with a reload.

**M16 — AC-2/AC-42 — the phone's half states the value's home and not the retry.**
AC-2's governing sentence is `(api, web, mobile)` and requires value kept, failure
stated, **and a retry offered**. The mobile bullet narrows it to *"the value is not lost
silently"* with `§ SaveNotice` as the home, and routes the retry to *"the same single
retry path AC-47 names"* — while AC-47 is `(web)` and says the phone is out and *"AC-2's
mobile half is where the phone's obligation is stated."* **The two point at each other
and neither says whether the phone owes a retry.** Not a drafting nicety: `§ SaveNotice`
**already declined to carry an action**, in writing.

## LOW

**M15 — the mobile ids are "owed to F-003's closed catalogue" and no dependency records
who opens it.** The spec keeps an explicit *"Two dependencies leaving this spec"* list
and this is not on it. AC-9's and AC-39's mobile bounds are accessible-name assertions on
the existing `taskRow`; **AC-42/AC-43's undo offer is an element that does not exist**,
and the selector contract forbids a QA author inventing one at phase-4 authoring.

## Checked, sound

AC-9 (`(web, mobile)` is a bound with a real mobile observable; **mutation test passes** —
remove the distinction from a phone row's accessible name and the mobile case goes red) ·
AC-2/AC-26/AC-39 (the receiver clause is in both ACs; AC-39's mobile fixture is genuinely
positive and independent — *"a successor generated anywhere, read by the phone"* — and the
natural mobile case does kill the discard-the-response mutation) · AC-2's post-state
(mutation-sensitive: *"never a row that vanishes and returns at the next refresh"*) ·
AC-38's doors (write-race answered) · AC-33/AC-43 (offline "it cannot run at all, no offer
is made" — **an assertable absence**) · AC-13/AC-44 (both mobile inline sites verified) ·
AC-19 (the composed case verbatim, with the reason stated so nobody ships the second half
alone) · AC-18, AC-36, AC-41 · AC-10/AC-27.

**Scope note from the lens:** M11, M12 and M14 are the same shape and it is the one this
round was authorised to look for — **an amendment that closes a finding and opens a defect
in the same paragraph.** All three are inside text written in revision 3.
