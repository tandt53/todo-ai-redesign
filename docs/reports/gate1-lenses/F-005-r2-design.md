# Gate 1 round 2 — F-005 — design lens

Persisted by the orchestrator per **L-009**. The lens wrote nothing.
**HIGH 3 · MEDIUM 4 · LOW 1.** All 48 ACs read.

## The arithmetic, re-run — the count moved in both directions

Round 1 read ~48 implied / ~20 named. Same method against 48 ACs:

| Region | Implied | Named | Δ |
|---|---|---|---|
| Surface lifecycle + containment (AC-1, 2, 4, 45, 48) | 9 | 6 | **closed** — loading, terminal-with-exit, failure scope, containment, swap |
| Title (AC-37) · Note (AC-6, AC-3) | 8 | 7 | closed |
| Priority control (AC-8, AC-9) | ~6 | 4 values, 0 control states | unchanged |
| Due + reminder pickers (AC-10–13, AC-44) | ≥9 | 5 | date-only path added |
| Steps + move mode (AC-14–18) | ≥13 | 11 | **closed** — AC-16 is now the best-specified region in the feature |
| Repeat picker (AC-20–25, AC-30) | ≥11 | ~3 | commit model + refusal locus named; **8 still unnamed** |
| Delete + hand undo (AC-30, 31, 41, 42, 43) | ~12 | 8 | undo affordance itself undrawn |
| **Notice outliving the surface (AC-47)** | **~9** | ~5 behavioural, **0 visual** | **new family, new hole** |
| **Passed reminder on open (AC-38)** | **~6** | ~3 | **new family, new hole** |
| Row marks (AC-9, AC-17, **AC-39**) | 3 meanings × done/overdue/AI-marker | 3 facts, 0 marks | **AC-39 is a third mark** |

**~63 implied, ~40 named.** The spec names roughly twice what it did and implies about
a third more. The unnamed residue fell from ~28 to ~23 and **relocated** — out of the
repeat picker and the step list, into two component families that did not exist a day
ago. Five of eight findings are on AC-47 and AC-38.

## HIGH

**D13 — AC-2, AC-47 — a write in flight at close that then fails has no described
outcome, so closing over an in-flight write looks identical whether it succeeded or
was lost.** AC-2's in-flight bullet describes only the resolving-successfully case;
AC-47's trigger is scoped to a write already in the failed state **at the moment of
closing**. The gap between them is the most likely interleaving in the feature by
product-F10's own reasoning: leaving a field is the gesture that precedes closing, so
the write is in flight exactly when the user closes. **`## Ops` corroborates the gap** —
it counts "failed writes that outlived their surface" and "failed writes retried in
place" and has no third category. `## Test strategy` confirms the order — "fail a
write, close the detail, assert…" — and never tests close-then-fail.

**D14 — AC-9, AC-39, AC-43, AC-33 — "the accent is design's to pick from unspent
tokens" names an empty set.** The palette's accents are exactly five:
`voice.listening` cyan = the user's voice, `primary`/`voice.thinking` violet = the
assistant, `success` green = added, `danger` red = removed/danger, `question` amber =
open question. There is no sixth, and DESIGN.md § Colour rules 1 states "no colour
appears without its meaning". This feature asks that empty set to serve **three new
marked meanings at once** — AC-9's urgency, AC-39's repeating-series indicator, and
AC-43's hand-action undo, which cannot be violet because violet is fixed as "the
assistant's own act" (§ UndoAffordance). Round 1's D9 correctly removed amber from
AC-9; **revision 2 replaced it with a directive that cannot be executed, and repeated
the directive in three places** — AC-9, §8 and OQ5 — so every reader believes the
problem is solved. The likely build is design silently re-spending an assigned accent,
which is the collision D9 was raised to prevent. *Directive:* replace "from unspent
tokens" in all three places with either "carried without colour" or "requires a new
accent token added to the system before the screens are drawn", and state the three
simultaneous mark meanings in one place so the row's mark budget is a decision rather
than three independent additions.

**D15 — AC-47, AC-2, AC-45 — the notice persists and nothing says where it renders,
and "persists" is not "is visible".** Three readings are three different products —
scoped to Tasks, re-appearing only on return to Tasks, or visible wherever the user is —
and **only the third makes AC-2's promise true.** The catalogue pushes toward the wrong
one: the only strip family that exists is the Tasks surface's banner stack
(§ OfflineBanner, § InlineRetryBanner, § SaveNotice), and **§ SaveNotice's lifetime
rule 3 clears the notice on "leaving the surface — another collection, Settings, or
Talk"**, which is precisely what AC-47 forbids. No component in the catalogue renders
on more than two of the five surfaces. Two further unnamed states: N tasks each with an
outstanding notice (AC-47 aggregates per field, not per task, and § SaveNotice's "it
never stacks" rule exists because "a per-event notice multiplies into a column that
obscures the list it is reporting on"), and what the notice does above the split.

## MEDIUM

**D16 — AC-38 — "shown" is undefined: rendered, or acknowledged.** The natural
implementation writes `reminder_shown_at` when the thing renders. A user who opens the
app, is interrupted, and closes it **has spent their only reminder delivery** — the
field is durable, so it does not come back on the next launch, the next device, or after
a reload; the AC says so explicitly. Same class of defect § SaveNotice argued at length,
arriving through a durable flag instead of a timer. It also decides the question the
revision log tracks as owed — whether AC-47 and AC-38 share a family: **their lifetimes
are opposite** (AC-47 never self-retires, AC-38 self-retires on first surfacing), so a
shared family needs a per-instance lifetime rule, and that axis is the one AC-38 leaves
undefined. Second unnamed state: below the split the app opens on Talk (IA §4), where
§ LandingSummary already owns what Talk says on open; §9 routes LandingSummary for
AC-26's count question and not for this one.

**D17 — AC-39 is a third simultaneous mark on § TaskRow and §8 still names only two.**
§ TaskRow's anatomy is fixed as checkbox + title + due meta and already carries the
AI-change marker (NEW/EDITED), the done treatment, and the Overdue heading's danger
colour. §8's claim — "AC-9's urgency mark and AC-17's step counter change TaskRow" — was
written before AC-39 existed. **§8 is otherwise the best-evidenced part of the spec,
which is what makes an out-of-date claim there expensive.** The mobile asymmetry
compounds it: AC-9 and AC-17 are `(web)`, AC-39 is `(web, mobile)`, so the phone's row
gains exactly one of three marks and no artifact records that as intended. And the
enumeration fails at AC-26's boundary — a completed occurrence stays as history and
belongs to a series that is still live, so whether Done's rows carry the repeat
indicator cannot be enumerated from the AC.

**D18 — AC-45 claims F-005 "adds one surface and one edge"; it adds at least three.**
Row → detail (AC-1, "wherever the task list is rendered"), message → a different task's
detail (AC-48's swap), detail → back. The IA's own rule is that "nothing reaches a
surface except through an edge on this list", so an undercount at the moment the surface
is introduced is how the map goes stale on day one. Unmentioned navigations the IA §4
table already contains: below the split the PathSwitch `Talk` control is in the top bar
of whatever surface is showing — tapping it from an open detail, then `Tasks · N` back,
returns the user to what? Above the split S3 and S4 "stack over the centre", which now
holds the detail. **None of these says whether the detail survives**, and the answer
decides whether `Tasks · N` returns you to your list or to a detail you had forgotten.
§9 names IA §1a and §3 and omits §4 (the edge table) and §6 (the per-surface
empty/loading/failing table), which is where AC-45's loading clause and AC-4's terminal
state actually have to be recorded.

**D19 — AC-43's hand-action undo has no legal label.** § Buttons' one-word-per-concept
table binds "undo" to "reversing the last applied turn" and lists revert, roll back,
take back and restore as forbidden synonyms. AC-43 correctly names the L-005 hazard and
then requires a control that either wears the word already bound to the other mechanism
or wears one the catalogue forbids. **Not hypothetical drift: § SaveNotice refused to
carry an Undo action for exactly this reason, in writing, six sections earlier.** The
lifetime clause is also self-contradictory as drawn — three enders, none of which is
time, then "a floor on the duration" and "the reason a purely time-based dismissal is
not sufficient on its own", so a timer both does and does not exist and a designer
cannot tell whether to draw one.

## LOW

**D20 — AC-47 excludes a failure whose cause is a gone task, but not an outstanding
notice whose task goes afterwards** — and the notice does not self-dismiss. Reachable
from an ordinary sequence: fail a write, close, say "delete that".

## Verified against the revision log

**Twelve of twelve design rows are on disk and say what they claim** — D1→AC-45 and both
AC-1 sub-bullets; D2→AC-1's user-settable restatement with `due_all_day` moved out of
the settable set in the Data table too; D3→five control classes; D4→AC-2's aggregation
plus the AC-33 4.1.3 entry; D5, D6, D7, D8, D10, D11 present as described; D12 dissolved
and AC-11's disclaimer requirement genuinely removed.

**One row is true as an edit and false as an outcome.** D9 is marked `resolved`: the
colour was dropped and the shape kept, exactly as claimed. **Its replacement directive
cannot be followed** — D14. That is why "a log row is a claim, not evidence" earned its
cost this round. The arithmetic row's `resolved in part, deliberately` is honest and the
re-run confirms it.

## On §8 in design terms

Four claims: the TaskRow change (**incomplete — two of three marks, D17**), the testid
catalogue debt (correct and correctly named-not-discharged), the amber collision
(carried into three places — with an unbuildable remedy, D14), and the state arithmetic
with its decisions/drawings split (correct, and the right call). What §8 misses are two
claims about the existing component vocabulary, its own remit: AC-47 vs § SaveNotice's
clearing rule (D15) and AC-43 vs § Buttons' table (D19).

## Checked, no finding

AC-16 — fully enumerated (5 states + per-move announcement + both conditional cases);
the best-specified region in the feature and the one this lens was most worried about at
round 1 · AC-3's five control classes including "a control holding a deferred value
shows nothing until it applies" · AC-4's terminal state has an exit, refuses Retry,
keeps unsaved text legible · AC-2's aggregation and save model, both drawable · AC-12's
date-only path · AC-45's loading clause per § Skeletons · **AC-48** — states enumerable
end to end, and its `(web)`-only availability follows from the conversation not being
rendered below the split rather than from a width branch, so it does not conflict with
AC-45 · AC-30's two controls, AC-22's disclosure, AC-11's removed disclaimer, AC-7's
assertion of absence · AC-5, 18, 21, 24, 27, 28, 29, 34, 36, 40, 41, 44, 46 — `api`-only,
no surface state of their own · AC-19, AC-26, AC-35 — server-side; their user-visible
consequences are AC-39 (raised) and OQ10 (already open).
