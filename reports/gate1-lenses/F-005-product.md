# Gate 1 — F-005 — product lens

Persisted at dispatch time per **L-009**.

**Verdict: REJECT (changes requested).** HIGH 3 · MEDIUM 8 · LOW 3.
Confidence HIGH. All 37 ACs.

**Method worth recording:** the lens re-derived the requirements independently
from `## Purpose` and the owner's quoted request *before* reading the spec. That
produced 16 requirements — 12 matched, 4 were absent (F4, F7, F10, F11). Nothing
in the spec was absent from its own list, so **there is no over-build**: the full
scope the owner chose is coherent, and *"this is too big"* is not a finding this
lens can make.

## Findings

### F1 — HIGH — AC-19 — the cascade's reversal has nothing to read
AC-19 un-ticks the steps *the cascade* ticked and leaves alone the ones the user
had already ticked — and **nothing in `## Data` records which is which**. The
plausible invention (compare a step's `updated_at` to the parent's) is wrong for
the exact case the decision exists to protect: tick a step, tick the parent a
second later, lose your own tick on un-complete. Contrast **AC-28**, which
specifies the same class of "was this touched" question with five named,
conjunctive, field-level conditions. Earliest catch is a QA case at execute
time, after the cascade is built.
**Directive:** add the marker to `## Data` and state the condition in AC-28's
form — or overturn the decision and un-tick every step, which is simpler and
defensible.

### F2 — HIGH — AC-27/13/22 — an offset with no anchor, on the default path
AC-27 rolls the reminder by "its offset from the due date"; AC-13 forbids a
date-only due behaving as a time nobody chose — so for an all-day due **there is
no instant to measure from**. This is not an edge: **AC-22 creates all-day dues
by rule**, so every repeat set on a dateless task starts all-day and the
undefined case is the *default*. An implementer will anchor at local midnight —
precisely the fabricated 00:00 AC-13 exists to prevent. Invisible on the first
occurrence; appears on the roll.
**Directive:** state the offset unit when `due_all_day` is set; add a
test-strategy row for an all-day repeating task carrying a timed reminder across
a roll.

### F3 — HIGH — AC-11, AC-10 — one control, two opposing statements
AC-11 requires the reminder control to **name itself as the one that alerts** and
**state plainly that reminders are not delivered yet**. No copy satisfies both:
what ships reads as either a promise the app breaks or a control announcing its
own uselessness. The spec's own Purpose calls a field with no consumer a
*write-only data path* and treats it as a defect — exposing it in the UI makes it
a **user-visible** one.
**OQ2 is the one open question that decides whether an AC exists at all:**
"withhold" deletes AC-11, halves AC-10, and removes the reminder clause from
AC-27 (and therefore F2). Building it first and deleting it after is the
expensive order.
**Directive:** route OQ2 to the owner before AC-11 is built — **with a third
option the spec does not offer: in-app surfacing only.** When the user opens the
app, reminders whose instant has passed are shown. No scheduler, no push, no
permissions, no UC-26 — and the control becomes honest instead of apologetic.

### F4 — MEDIUM — AC-19/26/35 — three behaviours reach mobile whether or not mobile is in scope
Impact §7 treats mobile as a scope question (OQ8). But these are **server-side or
shared-model**, and none carries a mobile tag. A mobile user who ticks a
repeating task gets **a row they did not create, dated next week, with no repeat
indicator anywhere on that client and no way to see or end the series**. A mobile
tick on a parent silently completes steps that client never renders. Platform
tags decide which QA agents cover an AC, so with `(api)` and `(api, web)` **no
mobile tier ever verifies what the mobile list does after F-005**.
The lens checked the one piece of good news rather than assuming it: **AC-35 does
hold on mobile** — `mobile/model/tasks-view.ts` re-exports from
`_shared/model/tasks.ts`, so the single `inCollection` gate reaches both clients.
That is the decision working; the other two have no such backstop.
**Directive:** name the three server-side behaviours that land on mobile
unbidden, tag AC-19/26/35 `(mobile)`, and state the minimum obligation — at
least that a generated successor is not indistinguishable from a task the user
created.

### F5 — MEDIUM — AC-31 — OQ8 rests on a fact that stopped being true
OQ8 and Impact §7 both tell the owner the phone "is still missing rename and
delete on its rows" (map D8). **That stopped being true on 2026-08-18** —
`mobile/components/TaskList.tsx` calls `controller.editTask` (line 71) and
`controller.removeTask` (line 136). The stale premise is the **argument against**
pulling mobile in, so correcting it may flip the answer.
`uc-coverage-map.md`'s D8 is the stale source and F-005 inherited it faithfully.
**Directive:** correct OQ8 and Impact §7; flag D8 in the coverage map for the
orchestrator, whose writers list already covers that file.

### F6 — MEDIUM — AC-36 — a permission, not a capability
AC-36's permitted half ("may set note, priority, due_at, reminder_at") is
unverifiable: the interpreter's 23 fixture rows contain **exactly two edit rows**,
changing title and status. **On a product whose one-line purpose is that the user
talks to an assistant to create, edit and delete todos, F-005 introduces six new
field concepts and a user can reach none of them by voice.** The Test strategy
requires a row that *tries* for the refused half and requires nothing for the
permitted half — so an implementation that allowlists four fields and leaves them
unreachable **passes AC-36 completely**.
**Directive:** say the four fields are allowlisted-but-unreachable this phase,
require one fixture row per permitted field, and widen OQ9 from "should you be
able to say make this weekly" to "should **any** of the new fields be reachable
by voice this phase".

### F7 — MEDIUM — AC-15, AC-31 — an AC asserts a property of a mechanism nothing requires
AC-15's fourth edge assumes an undo for **step** deletion. No AC creates one:
AC-31 grants in-place undo to the detail's delete of *its task* only, and UC-33
records that a hand delete has no undo at all today. So either a step is **the
one thing in this feature you can destroy irreversibly** — on the surface where
deletion is most casual, because steps are small — or an implementer builds an
undo nobody specified and QA has no AC to write against.

### F8 — MEDIUM — AC-22, AC-23 — the larger change is the silent one
AC-23 moves the due within the same week and requires the new date be shown
**before commit**; AC-22 gives a dateless task today's due and requires **no
disclosure at all** — while being the larger change, since the task enters Today
and moves a count the landing summary speaks about. The spec says the consequence
is "stated here so it is not discovered" — but *here* is the spec; the user
discovers it in Today. **The asymmetry will read to an implementer as
deliberate.** One sentence closes it, and also closes a gap in AC-33's 4.1.3 list.

### F9 — MEDIUM — AC-7 — an absence justified by a contestable market claim
AC-7 forbids any list-row indication of a note because "no comparable app marks
notes in a list view". Apple Reminders renders note text as a second row line;
TickTick surfaces descriptions in the list column. The lesson AC-7 cites — that
the original *"had fixed a solution before anyone checked the need"* — **is being
repeated in the opposite direction**: absence is now the fixed solution. The need
behind it is real; freezing "no marker, no icon, no preview line" means the only
way to know a task has a note is to open every task.
**Directive:** keep the prohibition if the owner wants it, but re-source it to
the source product's own removal decision and drop the market claim.

### F10 — MEDIUM — AC-2, AC-4 — the mirror case is unowned
AC-6 saves **on blur** — which is exactly the gesture that precedes closing — and
nothing says what happens when the surface closes with a write in flight. The
failure then has nowhere to be stated and the value no field to stay in, so the
guarantee silently becomes *"the edit is lost, quietly"* — the precise outcome
AC-2's last sentence was written to prevent. AC-4 covers the task disappearing
underneath; the surface disappearing over the write is unowned.
**Directive:** defer the close until the write resolves, or surface the failure
somewhere that outlives the detail. Which one is the owner's call; that one of
them holds is not.

### F11 — MEDIUM — AC-31 — two doors to one destructive action, different safety
After F-005, delete from the detail is reversible in place; delete from a row
(web, and **now mobile**) is not reversible at all. **Users do not model "which
control did I use" — they model "delete is undoable here".** OQ7 asks whether to
keep both controls but frames it as deliberateness, not safety.
**Directive:** reframe OQ7 around the asymmetry and offer a third option — keep
both and move the row delete's missing undo into F-005.

### F12 — LOW — AC-21 — "every weekday" is expressible but not discoverable
Weekly × interval 1 × five weekdays. A user wanting it looks under **Daily**,
which is exactly where AC-21 removed it. The model is right; **the correct model
reads as a missing feature** for the single most common recurring cadence.
**Directive:** one clause on AC-20 — the picker offers named cadences that
resolve into AC-21's rule set. No model change.

### F13 — LOW — AC-24/26/12 — time zones and DST are never mentioned
A daily 09:00 repeat crossing a DST boundary drifts by an hour; a due computed on
the device but rolled on the server can disagree by a day near midnight. Same
class as AC-24, which the spec treats as important enough to name a shipped bug
for.
**Directive:** one line in `## Test strategy` naming the zone the roll computes in.

### F14 — LOW — no market context, no non-functional baseline
`MANIFEST market_context` is empty and no `specs/_shared/non-functional-req.md`
exists, so this lens ran on web search alone and AC-33 has no project-level
baseline to inherit. Noted; no action for F-005.

## Verdicts the briefing asked for

**Ten open questions — one blocker.** OQ2 is F3. OQ8 needs its premise corrected
(F5), and the honest answer is F4 — mobile is affected regardless of scoping.
The other eight are correctly open and non-blocking. Footnote on OQ6 (offline
field edits): **it is more answered than it admits** — AC-2's failure path
defines the behaviour, so the open question is *durability*, not behaviour.

**The author's decisions — the lens counted seven, not six.** (The briefing said
six; the spec's list has seven and does not number itself.)
Endorsed: completing with steps outstanding is allowed (refusing would be the app
arguing with its user); clearing a repeating task's due is refused rather than
silently ending the repeat (**the strongest of the seven**); the assistant
*refuses* structural writes rather than merely being incapable (a refusal is a
fact you can test, an incapacity is not); steps excluded in `inCollection` rather
than through `isFiled` — **verified in code as reaching both clients**.
Right in principle, incomplete as written: F1, F2, F12.

**The Impact section** is the best-evidenced part of the spec; §1–§6, §8 and §9
could not be falsified. §7 is where it stops short (F4, F5).

## Checked, clean

- Every AC rated for level: none sits at code-existence or feature-presence. No
  AC needed a rewrite for provability.
- Independent re-derivation found **no over-build**. Every UC exclusion in
  `## Scope` is defensible against the coverage map, including the three flagged
  in the briefing (UC-04, UC-18, UC-49).
- AC-30's occurrence-vs-series delete, AC-25's exclusive end conditions, AC-28's
  five conjunctive conditions and AC-29's edit-forward semantics are all at or
  above the market bar.
