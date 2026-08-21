# Gate 1 round 2 — F-005 — product lens

Persisted by the orchestrator per **L-009**. The lens wrote nothing.
**Verdict: REJECT (changes requested). HIGH 2 · MEDIUM 7 · LOW 3.** All 48 ACs
examined. Round 1 was 3H/8M/3L across 37 ACs; nine of eleven round-2 findings sit on
ACs that did not exist then, and **two are things this lens got wrong or under-called
in round 1, said so explicitly.**

## Lens 3 — independent re-derivation, done before opening the AC list

24 requirements derived from `## Purpose` alone. **20 matched.** Four absent: timing
bounds (P8), recovery depth for a hand delete (P4), an accessibility obligation on the
platforms the new `(mobile)` tags reach (P2), validation bounds on free text (P12).

**Nothing in the spec was absent from the derived list.** Round 1's conclusion holds:
**there is no over-build**, and the eleven new ACs are not scope creep — every one
answers a defect a lens or an owner named.

**Is the growth mechanism instead of outcome?** Mostly no — AC-41, AC-13, AC-21 and
AC-45 all name a mechanism and hand the choice back. AC-45's CSS/container-query
prohibition is inherited verbatim from `owner-decision-2026-08-17-desktop-list-is-
primary.md` constraint 2, so it is a project constraint, not new over-specification.
**AC-44 is the real exception — P5.**

## HIGH

**P1 — AC-38, AC-47 — render is treated as resolution.** A user who opens the app
without looking, or dismisses by accident, **never hears about that reminder again on
any device**, while the task is still undone. The owner chose in-app surfacing over a
scheduler on the ground that it closes the write-only data path; a one-shot render that
resolves itself **reopens that path one layer up** — the field is now written *and*
read, and the user still never learns. And AC-47, added the same day, which explicitly
names AC-38 as "the only other obligation that renders outside a surface's lifetime",
**forbids exactly this for a strictly less important object**: "elapsing is not a
resolution", "an auto-dismissing notice reproduces the exact silent loss AC-2 forbids,
one screen later." A failed write is protected from vanishing; the reminder the user
asked for is not. **L-015's shape on the two owner answers of 2026-08-18** — each
correct alone, neither read against the other on this axis. *Directive:* give AC-38
AC-47's resolution triple — persists until acknowledged, until the task is completed or
deleted, or until the reminder is changed. Render is not resolution.

**P2 — AC-38, AC-42, AC-43, AC-33 — no tier ever checks the accessibility of the two
by-hand affordances F-005 adds to mobile.** Four ACs now carry `(mobile)` and place new
user-facing affordances on the phone; **AC-33, the only accessibility AC, is `(web)`.**
AC-43 discharges its own obligation *by reference* to an AC no mobile tier verifies,
using criteria whose mobile mechanisms are different ones
(`UIAccessibilityPostNotification`, `AccessibilityEvent.TYPE_ANNOUNCEMENT`).
`MANIFEST ## Knowledge` declares `standards: [WCAG 2.1 AA]` with the comment
"voice-first REQUIRES a non-voice path for every action" — and missing coverage of a
declared standard is automatically HIGH under this agent's contract. On the feature
whose own AC-16 argues that path "exists for exactly the users the second path exists
for". *Not a finding if* AC-33 carried `(mobile)`, or AC-42/AC-43/AC-38 stated their own
bound the way **AC-39 already does** ("visually and in its accessible name") — AC-39 is
the one mobile-tagged AC that self-covers.

## MEDIUM

**P3 — AC-38 has no aggregation or volume rule.** A user returning after two weeks meets
N passed reminders at once, with no stated ordering relative to the landing summary and
no cap. The same spec states the aggregation principle **twice** for the sibling case —
AC-2 ("one aggregated message, not one per field") and AC-47 ("one notice per task…
N polite announcements satisfy 4.1.3 while making the surface unusable for exactly the
users AC-16 and AC-33 exist for"). Its absence here will read as deliberate.

**P4 — AC-41's restore has exactly one consumer and it does not stack.** AC-43: "a
second undoable action replaces the first offer, and the replaced action stays done."
`GET /tasks` filters deleted rows and the Logbook is out of scope, so **delete a task,
delete a step two seconds later, and the task is gone permanently** — while the row sits
there with `deleted_at` set and a working restore route pointed at it. The owner decided
that "delete is undoable here" should not depend on which door you used; **the depth of
that undo was never put to them.** Market: Todo Cloud keeps deleted items 30 days;
Microsoft To Do has no recovery and its forum carries repeated permanent-loss threads; a
Todoist reviewer's complaint is verbatim the failure here. *Directive:* state the
recovery bound as an outcome, or record it as an open question. **Do not add a trash
surface** — out of scope and not what this asks for.

**P5 — AC-44 is a code-existence AC.** Passing it proves a seam exists and `new Date()`
is not called inline. Its user-observable half — a daily 09:00 repeat keeping wall-clock
time across DST, the server computing in `req.timezone` — sits in a sub-bullet as a
*reason for the seam*, not as what the AC asserts. **An implementation with a perfect
seam and an hour of DST drift passes AC-44.** Round 1 this lens certified that no AC sat
at code-existence level; AC-44 breaks that, and it is an **over-correction of this
lens's own F13**, which asked for one line in `## Test strategy` and got an AC.
*Directive:* invert it — assert the DST and zone outcomes, keep the seam as the "how".

**P6 — AC-48 discards an uncommitted repeat preview and nothing says the user is
told.** Every other value in flight at that moment is saved; every failure is stated.
The one thing silently thrown away is the only control in the feature with a deliberate
multi-step configuration, after the user has seen AC-23's disclosure. **The discard is
the right call; its silence is not stated as a choice.**

**P7 — OQ6 is now blocking, and was not in round 1.** AC-47 defers durability across a
reload or kill to OQ6 and "binds within the running app and no further". **The notice
exists to survive an outage — and reload is the first thing a user does when an app
misbehaves during one.** The notice most likely to matter is the one most likely to be
destroyed by the user's own recovery gesture. Design is being asked to build a family
that does not exist (T-152) whose persistence model is undecided; answering OQ6 after
the family is drawn means redrawing it. Round 1 this lens called OQ6 "more answered than
it admits" because AC-2 defined the behaviour; **AC-47 changed that.** OQ1, 3, 4, 5, 10,
11, 12 are correctly open and non-blocking.

**P8 — across 48 ACs there is not one timing bound**, and four need one: AC-1's "one
action" has no open latency; AC-32's "zero AI calls" is a mechanism whose actual promise
is that the by-hand path stays responsive when the assistant is down; AC-38's "when the
app opens" has no moment; and **AC-43 states a floor with no number** — "it survives
long enough to be reached by keyboard and by a screen reader". QA cannot write AC-43's
assertion at all: the floor **is** the accessibility guarantee and it is unmeasurable.
No project non-functional baseline exists to inherit from (`market_context: ""`, no
`specs/_shared/non-functional-req.md` — this lens's round-1 F14).

**P9 — WCAG 2.2.1 Timing Adjustable is absent from AC-33's enumeration**, and it is
precisely the criterion AC-43 and AC-47 both reason about without naming ("a purely
time-based dismissal is not sufficient on its own"; "it does not end by timing out").
Both are transient-affordance-with-an-action, the textbook 2.2.1 case. **The spec has
done the 2.2.1 thinking and left it uncited, so it is checked by nobody.**

## LOW

**P10 — AC-29 gives the user no "this occurrence only" scope.** A note added for one
week propagates to every week thereafter. Todoist prompts "this occurrence" vs "all
future occurrences" on exactly this gesture. **This is a round-1 miss of this lens** —
it listed AC-29's edit-forward semantics as "at or above the market bar" and did not
test the sentence against the user story it is written for. *Directive:* a sentence in
`## Out of Scope` or an open question — the model is defensible, its unstated cost is not.

**P11 — AC-41 is a new write path and no AC constrains it to the caller's own rows.**
The permissions table says it; no AC carries it. Existing routes scope by `userId`
(`app.ts:188`), so the pattern exists to inherit — but a new route is where it gets
missed and no AC would turn red.

**P12 — no upper bound on note or title length, no bound on step count**, while AC-6
requires a long note to be "never truncated" — an unbounded write on a field the
assistant can also set.

## `## Impact` in product terms

§7's four-row mobile table is correct and its fourth row is **raised as OQ11 rather than
settled**, the right disposal. §13 **verified against the artifact, not read**: F-001's
status header records revision 5 and revision 6; both halves genuinely discharged. This
was the claim most worth checking and it holds.

**Silently settled where a question was owed: two**, and both are findings — AC-38's
one-shot resolution rule (P1) and AC-43's non-stacking undo as the sole recovery door
(P4). Neither was put to the owner; both are product decisions with a user-visible cost.

## The revision-2 log — all 14 product dispositions verified against spec text

F1 → `completed_by_parent` in AC-19 *and* the `## Data` table · F2 → AC-27's
whole-days-when-all-day bullet plus the Test strategy row · F3 → AC-38 exists, AC-11
rewritten, OQ2 retired · F4 → five `(mobile)` tags present, AC-39 takes the minimum
obligation verbatim · F5 → stale premise corrected in §7, Out of Scope and §9 · F6 →
AC-36 requires one fixture row per permitted field · F7 → AC-43 names step deletion ·
F8 → AC-22's disclosure and AC-33's 4.1.3 both name "the date AC-22 creates" · F9 →
market claim withdrawn, OQ12 opened · F10 → superseded by the addendum, **with revision
2's wording and its product-F10 reason kept verbatim, which is the right way to
overrule** · F11 → AC-42 · F12 → AC-20's named cadences · F13 → AC-44's zone clause ·
F14 → correctly no-action. **No row claims something the spec does not say.**

## Checked, clean

All 48 ACs rated. **Beyond AC-44 (P5), no AC sits at code-existence or feature-presence
level** — same result as round 1, across 11 more ACs. Scope: no over-build, re-derived
independently. `INV-INBOX-FILING` not touched. AC-39, 40, 41, 45, 46 clean on all four
lenses. **AC-47 and AC-48 are the two best-written ACs in the spec** — and P1 is a
finding *because* AC-47 sets a standard AC-38 does not meet.

Market sources: Todoist recurring dates; Microsoft To Do create/edit/delete/restore;
Todo Cloud restore-deleted-tasks; W3C Applying WCAG 2.2 to Mobile Applications; native
mobile support for status messages (4.1.3); "A toast to an accessible toast" (Scott
O'Hara).
