# Gate 1 — F-005 — design lens

Persisted at dispatch time per **L-009**: Gate 1 clusters are routing, not record.
A finding only one lens raised vanishes when the orchestrator consolidates.

**Verdict counts:** HIGH 3 · MEDIUM 8 · LOW 1. Confidence HIGH. All 37 ACs read.

## The lens's own arithmetic (nobody else counted this)

~48 distinct surface states implied; **the spec names roughly 20.** Not an
argument that F-005 is too big — a map of where "underspecified for someone who
must draw it" actually lives. Concentrated in the repeat picker, the pickers,
and the step list.

| Region | States implied | States named |
|---|---|---|
| Surface (load, loaded, save-failed, deleted-underneath, offline) | 5 | 2 |
| Title (AC-37) | 3 | 2 |
| Note (AC-6, AC-3) | 5 | 3 |
| Priority (AC-8) | 4 values × default/focused + clear | 4 values, no control states |
| Due + reminder (AC-10–13) | ≥9 | 3 shortcuts |
| Steps (AC-14–17) | ≥8 | 4 edges, no states |
| Repeat (AC-20–25, AC-30) | ≥11 | **0** |
| Delete (AC-30, AC-31) | 3 | 2 |

## Findings

### D1 — HIGH — AC-1, AC-3, AC-4, AC-32 — surface, sheet or panel is unstated
The IA enumerates exactly five surfaces and says *"nothing reaches a surface
except through an edge on this list"*; F-005 adds neither a surface nor an edge.
The three readings **are three different products**. As a stacked surface it
replaces Tasks below the split and the centre above it — so the list is gone
while the detail is open, and AC-3's "the assistant edited this underneath you"
arrives where the user cannot see the list it also changed. As a sheet, AC-3 has
two places showing one change. Two uncosted consequences: F-001 AC-31 lands on a
*row*, so message → detail becomes **two** actions, not AC-1's one; and
§ AppFrame fixes tapping a task title on iOS/Android as **entering rename**, so
AC-1's "activating a task row" collides with a shipped gesture.
**Directive:** name the containment and whether the list stays visible above the
split; add the navigation edge and its tap cost from both Tasks and a bubble.

### D2 — HIGH — AC-1, AC-13, AC-21, AC-25 — "never absent" forbids disclosure
AC-1's *"a field with no value renders as an empty, settable control — never as
absent"* read against the Data table requires a repeat-less task to render six
recurrence controls plus `due_all_day`. Literally, it **forbids the disclosure
pattern every comparable app uses** and puts 11+ empty inputs on a dateless task
at 375px. Loosely, it means nothing and each implementer picks which fields
count — the exact defect the Purpose says this feature ends. `due_all_day` is
the sharpest: Required in the Data table, but AC-13 makes it a *consequence* of
whether a time was picked, so rendering it contradicts AC-13 and not rendering
it contradicts AC-1.
**Directive:** restate as a reachability-and-visibility bound over *user-settable*
fields; list which are one control and which are configuration behind one; move
`due_all_day` out of the settable set.

### D3 — HIGH — AC-3, AC-2 — "has focus" is undefined for these controls
The focus exception is written for a text field and applied to every field. "Has
focus" is undefined for an open date picker, a segmented priority control, a
step list mid-drag, and an uncommitted repeat preview. The cue it borrows
(`diffFlashHold`/`diffFlashFade`) is defined as **a tint across a row
background** — a form field has no equivalent surface, and a flash is an
*arrival* cue for a value that has landed, not a pending one. Seven controls get
seven answers; the mid-drag case has none — a reorder in flight when steps change
underneath either snaps or silently discards.
**Directive:** enumerate the control classes covered; state what a control
holding a deferred value shows (or explicitly: nothing).

### D4 — MEDIUM — AC-2, AC-33 — N+8 concurrent failures, no rule
The catalogue's whole failure vocabulary is surface-scoped. No per-field failure
component exists. The plausible build fires one polite announcement per failure —
technically satisfying 4.1.3 while making the surface unusable for exactly the
users AC-16 and AC-33 exist for. The alternative aggregates and silently drops
AC-2's "the field keeps the user's value".
**Directive:** state the failure report's scope; fix the announcement count.

### D5 — MEDIUM — AC-20–23, AC-25 — the repeat picker's commit model
It is the only control with preview-then-commit, on a surface where everything
else saves on blur. Eleven states fall out; **the spec names zero.** Two of them
are refusals, and refusals need somewhere to render — an explicit-commit control
has a place, a save-on-blur control does not. AC-2's "leaves the user's value in
the field" is unsatisfiable inside a sheet already dismissed.
**Directive:** name the commit model; say where AC-22/23/25's messages render.

### D6 — MEDIUM — AC-22, AC-23 — the larger consequence is the silent one
AC-23 shows the *smaller* consequence before commit (due shifting within the
rule); AC-22's larger one — a dateless task silently acquiring today's due and
joining Today — carries **no visibility requirement at all**. The spec's own flow
diagram draws the asymmetry. This changes collection membership and the counts
the landing summary speaks about, with nothing on screen. Same class of silence
SaveNotice was built to end, through a different door, on a surface that will not
have SaveNotice.
**Directive:** extend AC-23 to cover AC-22's created due, or say where the user
learns the task now has a date.

### D7 — MEDIUM — AC-10, AC-12, AC-13 — the protected state is unreachable by the user
AC-13 forbids a fabricated time on a date-only due, and **no AC gives the user a
way to produce one**: all three shortcuts carry times. The calendar's no-time
default is left to the implementer, who will default to a time — shipping exactly
the defect AC-13 cites from the original product (say "Friday", get 9:00).
**Directive:** add the date-only path to AC-12.

### D8 — MEDIUM — AC-1, AC-4 — no loading state, and no exit from "gone"
The word *loading* appears nowhere in 306 lines, and this surface's loading state
is **visually identical to its legitimate all-fields-empty state** under AC-1 —
so the user's first read of their own task is a lie that corrects itself.
§ Skeletons states the rule this breaks. AC-4's terminal state is the inverse:
§ SurfaceError is the nearest shape and its whole anatomy is a **Retry**, the one
action that must not be offered for a deleted task, and no AC says where the user
goes while unsaved text is on screen.
**Directive:** add a loading clause distinguishing not-yet-read from empty; give
AC-4 an exit.

### D9 — MEDIUM — AC-9, AC-17, AC-33 — amber is already spent
AC-9 tells design to start from the original's *single amber `!`*. DESIGN.md
assigns `question` amber to **open question** and states *"no colour appears
without its meaning"*. Following the recommendation puts a second meaning on the
one accent with exactly one — on rows that already carry the Overdue heading's
lateness, and in the live store **all seven dated open rows are overdue**, so the
amber mark would appear against a `danger` heading on every row of Today. Also
adds two marks to § TaskRow **one day after** § TaskList spent an explicit
argument keeping it clean.
**Directive:** drop the colour from AC-9 (keep the shape); note the accent is
design's to pick from unspent tokens.

### D10 — MEDIUM — AC-15, AC-16, AC-33 — the accessible reorder is one sentence
A move mode is a component: idle → grabbed → moving → dropped → cancelled, plus
a mandatory announcement per position change, plus two conditional cases (a
one-step list where it must not appear; a drop where the step already was, which
must produce no announcement and no undo entry). **Six-plus states arriving as
one sentence is how the accessible path gets built last and worst** — on the
feature whose own AC-16 says that path is who the second path exists for.
**Directive:** say which shape it takes; name what is announced.

### D11 — MEDIUM — AC-30, AC-31, AC-19 — one control that asks sometimes
AC-30 requires distinguishing occurrence from series *before* acting; AC-31 and
AC-19 both cite the rule that an action with an undo does not need a question.
One control must therefore ask on some tasks and never on others. The gesture has
no vocabulary: § OptionChip is bound to Talk's question bubbles, § Buttons' danger
variant is "confirm-delete contexts only" — the very pre-action question the
precedent refuses — and the banner family is post-action.
**Directive:** two controls, or one control plus a stated exception.

### D12 — LOW — AC-11 — a permanent disclaimer in a transient family
Every explanatory strip reports a *transient condition*; nothing renders a
permanent capability disclaimer on a single control. A banner would claim equal
weight forever in the stack above SaveNotice.
**Directive:** resolve Open Question 2 first; if the control ships, fix the
notice as control-level helper text.

## Checked, no finding (anti-theatre)

- **AC-5, 18, 21, 24, 26, 27, 28, 29, 34, 36** — `api`-only, no surface state.
  AC-26's user-visible consequence is real and already carried by Open Question 10.
- **AC-2's anti-snap-back clause** — the one place the spec answers *"does success
  look like failure?"*, answered correctly.
- **AC-7** — assertion of absence about the list row; correct and drawable.
- **AC-8** — fully enumerable; the only gap is the mark's form (D9).
- **AC-14** — CRUD verbs complete; the missing states are the reorder ones (D10).
- **AC-19** — four parent transitions, all named, all with visible outcomes. The
  most drawable AC in the spec.
- **AC-32, AC-35, AC-37** — no state that could not be enumerated.
- **§ Impact 8's own claim** that this surface needs its own testid section —
  checked against the catalogue, correct and correctly scoped. Named, not
  discharged, which is the right call at Gate 1.

## On the Impact section

§2 and §8 are real, correctly attributed to design, and not overstated. §5's
second bullet (AC-17's step count must not come from `collectionCount`) is the
L-004 reading and is right. **§8 misses D9's colour collision** — the finding this
lens would most want the owner to see, because it was created by a decision made
the same day and will otherwise be found by whoever draws the row.
