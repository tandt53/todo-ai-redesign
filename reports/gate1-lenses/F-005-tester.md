# Gate 1 — F-005 — tester lens

Persisted at dispatch time per **L-009**.

**HIGH 5 · MEDIUM 7 · LOW 4.** Confidence HIGH. All 37 ACs.
Questions asked: is the observable named, is the absence assertable, is the
precondition constructible, does one AC bundle guarantees that must fail
independently.

## HIGH

### T1 — AC-36 — the refusal cannot be exercised
The shape a turn would use to *attempt* the refused write does not exist:
`TaskChanges` carries only title/due_at/reminder_at/priority/status, so **no
fixture row can express `parent_id`, `step_order` or `recurrence.*` at all.** The
spec's own Test strategy says AC-36 "needs a fixture row that *tries*, or it
asserts nothing at all". **Earliest catch is never; C5 passes on a suite that
cannot fail.**
**Directive:** say which AC-36 is — a runtime refusal with a visible outcome (then
the AI-facing shape must carry the field), or a type-level impossibility (then
the observable is the contract file, and "refused with a visible outcome" must go).

### T2 — AC-26/28/30 — the invariant is broken by a sibling AC on purpose
AC-26: *"exactly one open occurrence exists per series at any moment."* AC-28
deliberately leaves **both rows open**. So the invariant assertion cannot be
written honestly — it is red on AC-28's own path. AC-30's "every unfinished
occurrence" is **plural only in the state AC-26 says cannot exist**, so its
plural branch has no reachable fixture except through AC-28.
**Directive:** restate AC-26 as a *generation* rule; say what a series delete does
when two open occurrences exist. Then AC-28's case becomes AC-30's fixture
instead of contradicting it.

### T3 — AC-2/3/6 — blur has two incompatible obligations
AC-6: leaving the field **saves** it. AC-3: a deferred assistant value **applies**
when focus leaves. Nothing says what happens when both are pending on the same
field at the same blur — and **this is the single most likely interleaving in the
feature**, the one AC-2 asks to be proven by interleaving.
**Directive:** state focused + dirty + incoming → which value is stored, which is
displayed, what the user sees.

### T4 — AC-15/19/31 — three ACs assert on an undo nothing defines
F-001's undo is **turn-shaped**, and a hand delete has no undo at all today. Yet
AC-15 asserts a no-op drop "creates no undo entry", AC-19 says a deleted parent's
cluster is restored by undo, and AC-31 introduces an in-place undo with **no
lifetime, no dismissal rule, and no stated relationship to the turn-undo
affordance.** There is no object to assert on: no entry list to inspect, no
gesture named, no duration to wait inside.
**Directive:** give the hand-action undo its own AC, or drop AC-15's fourth edge.

### T5 — AC-12 — "this weekend" has no defined resolution
Its two siblings are exact ("today at 18:00", "tomorrow at 09:00"). This one names
no day and no time, and says nothing about **when today is already Saturday or
Sunday** — exactly the boundary a picker gets wrong. Any test written against it
**encodes the implementer's choice, making the test a mirror rather than a check.**

## MEDIUM

- **T6 — AC-12/13/22/23 — the clock the ACs read is not the clock the harness
  controls.** The web-tagged date behaviour reads the **device** clock; the only
  seam is server-side (`FakeClock`, `POST /__qa__/advance-clock`), and the
  "injectable clock is mandatory" sentence names four **api-side** ACs. Result:
  date-dependent web TCs become wall-clock dependent — *"green until a Friday CI
  run."*
- **T7 — AC-8/15/34 — three preconditions are unconstructible.** AC-8's tolerant
  read needs a stored priority outside the new set, **which the same AC's write
  path refuses** — so the API cannot create it. AC-34 needs an old-shape snapshot
  and names no way to inject one (the spec correctly notes a self-captured
  snapshot *cannot fail this*). AC-15's "survives a restart" has nothing to
  survive: the harness composes `new MemoryStore()`, fresh per process.
  **AC-8's migration half — the one touching 790 live rows — is the one with no
  reachable fixture.**
- **T8 — AC-5 — the assertion passes for an unrelated reason.** `task-equals`'s
  field list contains `updated_at`, so a hand edit to **any** field is detected as
  modified-since. A test that edits a note and asserts the undo skips it is green
  **whether or not `note` ever joined the comparison** — L-012's shape exactly, and
  the spec notices the hazard in prose without constraining it in an AC.
  **Directive:** require modified-since to be proven with `updated_at` held equal.
- **T9 — AC-2/6/23/25 — two save models, unassigned.** Field-level immediate write
  versus a staged control with an explicit commit. **Every step of every repeat TC
  is a guess.**
- **T10 — AC-18/21 — "not expressible" without an outcome.** Some clauses name the
  refusal, others don't. A test author has three choices per case (400, ignored,
  coerced), and the wrong guess **passes against a system that silently drops the
  field** — the failure AC-36 refuses elsewhere in the same spec.
- **T11 — AC-1 — the most-referenced test of the feature is unwritable.** "Every
  field this spec names" resolves to a 13-row table including `step_order`,
  `series_id`, `parent_id`, `due_all_day` — three are not user controls. And
  "activating a task row" is a gesture the row **already** answers (inline rename;
  arrival target). **An implementation rendering ten of thirteen passes.**
- **T12 — AC-23 vs AC-29 — the most obvious recurrence TC has two defensible
  expected results.** Task due Monday, rule changed to weekly-on-Thursday: due
  becomes Thursday now (AC-23), or stays Monday and only the successor lands
  Thursday (AC-29). **The spec supports both.**

## LOW

- **T13 — AC-6** — *"line breaks survive any export"*: **nothing in this repo
  exports anything**, so that clause is a permanently green line in the coverage
  matrix. And "a long note scrolls rather than truncating" names no length.
- **T14 — AC-7/9/17** — the prohibition's only falsifiable form is a differential
  (row renders identically with and without a note), and **two other ACs mutate
  that same row in the same release** with nothing saying they must be held equal.
- **T15 — AC-33** — five of the six success criteria have direct observables;
  **1.4.3 contrast needs tooling the project does not have** (no axe). The half
  AC-9 depends on gets verified by eye or not at all.
- **T16 — AC-3** — the borrowed arrival cue is defined for **a task row scrolled
  into view from a message**; re-attaching it to a field value applying at
  focus-out inherits the constants but not the subject.

## Checked, sound (anti-theatre)

AC-19's four transitions (each separately reachable, distinct observables) ·
AC-28's five conjunctive conditions **with one case per door and the other four
shut — L-012's remedy applied correctly** · AC-24's clamp naming the concrete
shipped failure · AC-27's four independent regression targets · AC-35 cannot pass
vacuously (named predicate, named mutation, plus a control assertion) ·
AC-14/20/32's zero-AI-call claims have a working seam already used by F-001 TCs ·
AC-32's erroring-assistant state is constructible (`kind: fail` fixture rows) ·
AC-37 enumerates all three empty forms · AC-10's clear is distinguishable from a
zero date or empty string · AC-16 names its SC · AC-17's zero case has a companion
positive · **AC-2's interleaving method is named rather than left to inspection —
the right proof shape** · AC-4's race is constructible with request delay ·
Impact §5 checked against the two-axis model as it now stands.
