# Gate 1 round 2 — F-005 — tester lens (api)

Persisted by the orchestrator at return time per **L-009**. `docs/reports/` is
orchestrator-owned; the lens wrote nothing, which is its contract.

**Verdict: REJECT — 8 HIGH · 5 MEDIUM · 2 LOW.** Confidence HIGH. All 48 ACs
examined. Finding ids continue from this lens's round-1 return (T1–T16).

## Part A — did round 1's dispositions land?

All 16 round-1 findings are traceable to changed spec text. **Four landed
incompletely**, and each is a HIGH below, because the revision-2 log records them
`resolved`:

| round 1 | claimed landing | actual state |
|---|---|---|
| T4 (undo undefined) | AC-43 new | AC-43 exists but **omits AC-30's series delete**, which AC-30 says it covers → **T17** |
| T6 (clock seam) | AC-44 new | AC-44's zone arrives **only with a turn**; the hand path has none → **T23** |
| T7 (unconstructible preconditions) | "seed path is part of the contract" | a sentence in `## Test strategy` only — **no AC, no endpoint, no owner** → **T22** |
| T10 (refusal without an outcome) | AC-18 refusal clause | states *"writes nothing"* but never says whether that scopes to the field or the whole write → **T19** |

T1, T2, T3, T5, T8, T9, T11, T12, T13, T14, T15, T16 landed fully and are not
re-reported.

## Part B — findings

```yaml
findings:
  - id: T17
    severity: HIGH
    acs: [AC-30, AC-43, AC-41]
    claim: >
      AC-30 justifies having no confirmation on the series delete on the ground that
      "both have AC-43's undo", but AC-43's own "What it covers" list enumerates four
      actions and the series delete is not one of them; AC-41's restore is scoped to
      "a parent and its steps in one call", not to N occurrences each with their own steps.
    consequence: >
      The series-delete undo has no mechanism and no scope. A QA author cannot write the
      case at all: there is no defined call, and no answer to whether one undo action
      returns every unfinished occurrence or only the one the user was looking at.
      Meanwhile AC-30 has already spent the confirmation dialog against it. Earliest
      catch is the execute phase, on a destructive multi-row action with no dialog.
    would_not_be_a_finding_if: >
      AC-43's coverage list named AC-30's series delete, and AC-41 said whether its
      one-call restore takes a cluster (parent+steps) or a series (N occurrences,
      each a cluster).
    directive: >
      Add the series delete to AC-43's coverage list and state AC-41's restore unit —
      one call per cluster, or one call per series. If per series, add it to AC-26's
      multi-row-response list.

  - id: T18
    severity: HIGH
    acs: [AC-46, AC-28, AC-26]
    claim: >
      Undoing a turn that completed a repeating task whose successor has since been
      edited has three defensible expected results in three different documents:
      AC-46 ("undo reverses the whole of what the turn caused, or none of it") deletes
      the successor; AC-28's five conjunctive conditions leave both rows standing;
      F-001 AC-7 skips a task modified after the turn and names it in the outcome
      message — which is what the successor now is, since AC-46 puts it in the turn's record.
    consequence: >
      The single highest-value AC-46 case is a mirror of whichever branch the implementer
      wrote. Two of the three answers leave two open occurrences of one series — the state
      AC-30's plural branch exists for — and the third silently deletes a row the user edited
      by hand, which is precisely what AC-28's asymmetry was written to prevent.
      No test can fail here, because all three results are citable.
    would_not_be_a_finding_if: >
      AC-46 stated whether a turn-caused row is reverted under AC-28's conditions, under
      F-001 AC-7's modified-since skip, or unconditionally — and what the reverted-outcome
      message says in each case.
    directive: >
      Add one clause to AC-46 naming which rule governs a turn-caused row that was touched
      after the turn, and say whether it is named in F-001 AC-7's skip list.

  - id: T19
    severity: HIGH
    acs: [AC-40, AC-36, AC-18]
    claim: >
      AC-40 requires an illegal value attempted through the turn path to be "refused
      identically to the HTTP path", but the HTTP path's outcome is a 400 with a field
      name and a turn has no such thing; and AC-18's refusal rule says a refused write
      "writes nothing" without saying whether that scopes to the refused field or to the
      whole turn. A turn that sets note="ok" and title="" — now the ordinary case, since
      the owner's voice answer made four fields speakable — has no defined outcome.
    consequence: >
      Three observables are unspecified and each is separately guessable: is the note
      written, is the task in changed_task_ids, and is a diff rendered. The wrong guess
      passes against the exact failure `## Impact` §1 names — a task marked changed with an
      empty diff, rendering an F-001 AC-4 message that names a task and cannot say what
      happened to it. AC-40's own falsifiability clause ("a fixture row per rule that
      attempts the illegal value") is unwritable without this.
    would_not_be_a_finding_if: >
      AC-18's refusal clause said whether "writes nothing" is per-field or per-write, and
      AC-40 named the turn-path observable (message text, diff contents, changed_task_ids
      membership) instead of deferring to "identically to the HTTP path".
    directive: >
      State the refusal's scope once, in AC-18, and replace AC-40's "identically" with the
      turn-path observable: same rule, same rejected value, and a named outcome on the
      turn side.

  - id: T20
    severity: HIGH
    acs: [AC-38, AC-27, AC-10]
    claim: >
      `reminder_shown_at` has exactly one stated write ("set when AC-38 surfaces the
      reminder") and no stated clear. Three events have no rule: AC-27's roll (does the
      successor carry it?), setting a new reminder on a task whose old one was already
      shown, and clearing a reminder.
    consequence: >
      If the successor carries it, every generated occurrence's reminder is pre-marked
      shown and never surfaces — reproducing, one occurrence downstream, the write-only
      data path the owner's reminder answer exists to close, and reproducing the shipped
      defect AC-27 already names ("the generator silently lost the successor's reminder").
      If a re-set reminder does not clear it, the second reminder a user ever sets on a
      task is dead. Both are invisible: nothing renders the flag, and the happy-path test
      (set reminder, advance, open, see it) passes in every variant.
    would_not_be_a_finding_if: >
      `## Data`'s `reminder_shown_at` row named its clear conditions, or AC-27 said whether
      the successor inherits it, or AC-38 said the flag is keyed to the reminder instant
      rather than to the row.
    directive: >
      State when `reminder_shown_at` clears — at minimum: cleared on the successor, and
      cleared whenever `reminder_at` is written to a different instant or cleared.

  - id: T21
    severity: HIGH
    acs: [AC-38]
    claim: >
      AC-38 is tagged `(web, mobile)`. Its one falsifiable clause — "'already shown' is a
      stored fact and not a session fact ... not on the next launch, on the next device,
      or after a reload" — is a server-persistence assertion, and the cross-device half is
      observable at no other layer.
    consequence: >
      Tags decide which tier verifies an AC — the spec's own instrument, and the reason
      revision 2 corrected five of them. With no api tag, the only difference between
      AC-38 as written and a session-scoped implementation is asserted by nobody. Both
      client tiers pass against an in-memory flag. `reminder_shown_at` is in `## Data` but
      appears in no AC that any api tier owns.
    would_not_be_a_finding_if: >
      AC-38 carried `(api, ...)`, or the stored-fact clause were carved into an api-tagged
      AC of its own, or `## API Touch Points` named the endpoint that writes it and an
      api-tagged AC constrained that write.
    directive: >
      Tag AC-38 `(api, web, mobile)` and name in `## API Touch Points` which write sets
      `reminder_shown_at` and who calls it — it is in no allowlist today and AC-40 makes
      that a rule-binding question, not a schema one.

  - id: T22
    severity: HIGH
    acs: [AC-8, AC-34, AC-15]
    claim: >
      T7's three unconstructible preconditions are dispositioned `resolved` on the strength
      of a `## Test strategy` bullet ("a seed path that bypasses the write validation is
      part of the contract"). That is a sentence in a non-normative section: it is not an
      AC, it is absent from `## API Touch Points`, it names no mechanism and no owner, and
      no agent's scope includes building it.
    consequence: >
      This is the same shape revision 2 correctly refused to leave for AC-41 — asserted in
      prose, buildable by nobody, and promoted to an AC for exactly that reason. The three
      preconditions are still unreachable: AC-8's tolerant read needs a stored priority its
      own write path refuses; AC-34 needs a snapshot recorded in the pre-F-005 shape, and
      the spec itself notes a self-captured snapshot cannot fail it; AC-15's "survives a
      restart" needs a durable store. Backend-agent builds ACs and reads api-contracts;
      architect writes api-contracts from `## API Touch Points`. The QA agent discovers the
      gap at execute, which is one gate too late — and AC-8's half touches 790 live rows.
    would_not_be_a_finding_if: >
      An AC required the seed path, or `## API Touch Points` listed it beside the restore,
      or it named the existing `__qa__` namespace (which already carries
      `POST /__qa__/advance-clock`) as its home with a stated shape.
    directive: >
      Give the seed path the same treatment AC-41 got: an AC, or a `## API Touch Points`
      entry naming what it must be able to construct (an out-of-set stored priority, an
      old-shape snapshot record, a store that survives a process restart). Representation
      is architecture's; that it exists is not.

  - id: T23
    severity: HIGH
    acs: [AC-44, AC-22, AC-23, AC-24, AC-26, AC-27, AC-13]
    claim: >
      AC-44 says the server computes rolls, alignment and clamps "in the user's zone
      (`req.timezone` already travels with a turn)". Every one of those computations is
      also reachable through the hand path — AC-22/AC-23 fire on a PATCH that sets a
      repeat, AC-24 on the same, AC-26/AC-27 on a PATCH that sets status=done from the
      detail or a list row — and `api-contracts.md § Prototype task CRUD` carries no
      timezone on POST, PATCH or DELETE. AC-13's read rule ("all-day iff the instant is
      that day's local start") is zone-dependent and is evaluated on every read.
    consequence: >
      The api tier cannot supply, let alone control, the zone through the endpoints these
      ACs are exercised by, so the DST case `## Test strategy` explicitly asks for — a
      daily 09:00 repeat keeping 09:00 across the change — has no way to be set up. Worse
      for AC-13: it is tagged `(api, web, mobile)`, the server would resolve "that day's
      local start" without a zone while both clients resolve it in the device zone, so
      three tiers can assert the same AC and get three answers on one row. This is the
      wall-clock dependence AC-44 was created to end, displaced from the clock onto the zone.
    would_not_be_a_finding_if: >
      AC-44 said where the zone comes from on the hand path (a request field, a stored
      account attribute, or UTC by policy), or the date computations were stated to happen
      only on the turn path.
    directive: >
      Add one clause to AC-44 naming the zone's source for a non-turn write, and say which
      side owns AC-13's all-day read. `## API Touch Points` then owes the CRUD endpoints
      that field, the same way it now owes the restore.

  - id: T24
    severity: HIGH
    acs: [AC-39, AC-25]
    claim: >
      AC-39 requires a row "belonging to a live series" to be identifiable as repeating on
      every client. No field the spec names distinguishes a live series from a dead one:
      AC-25 states `series_id` is assigned once and **never cleared**, and the recurrence
      fields survive both "repeat cleared" and "end date passed / run count reached" (the
      state diagram's `Ended`).
    consequence: >
      The AC's falsifiable half — a task whose repeat was cleared, or whose series has
      ended, shows no repeat mark — cannot be written, because the tester has no way to
      construct "not in a live series" as an observable distinct from "in a series". Every
      implementation that keys the mark off `series_id` or off `recurrence.frequency`
      passes the positive case and marks ended tasks forever. On mobile this is the whole
      of AC-39: it is the only thing that explains an unexpected row, and it would be
      wrong on every ex-repeating task.
    would_not_be_a_finding_if: >
      AC-39 or AC-25 named the observable for liveness — a cleared `recurrence.frequency`,
      an explicit ended flag, or a wire-level derived boolean — rather than the phrase
      "belonging to a live series".
    directive: >
      Define "live series" as a readable fact on the wire, and add the negative case to
      AC-39: a task whose repeat was cleared and a task whose series has ended both show
      no repeat mark.

  - id: T25
    severity: MEDIUM
    acs: [AC-26, AC-28, AC-30]
    claim: >
      AC-26's generation rule — "completing generates exactly one successor" — does not say
      whether the guarantee is per completion or per occurrence. AC-28's both-rows-stay
      outcome makes re-completion reachable: complete, un-complete after the successor was
      edited (both stay), complete again.
    consequence: >
      Second completion either generates a second successor (three rows, a series
      accumulating without limit) or generates none (the occurrence is silently sterile).
      Both are defensible readings of the same sentence and the fixture is AC-28's own,
      which is the fixture AC-30's plural branch already depends on — so the ambiguity sits
      directly under the only constructor for that branch.
    would_not_be_a_finding_if: >
      AC-26 said "one successor per completion" or "at most one successor per occurrence,
      idempotent on re-completion".
    directive: Pick one and say it in AC-26; the phrase "no path generates a second" is what carries the ambiguity.

  - id: T26
    severity: MEDIUM
    acs: [AC-25, AC-28]
    claim: >
      AC-25 counts runs from completions rather than from a stored counter, deliberately.
      It does not say whether un-completing an occurrence (AC-28) un-counts its run.
    consequence: >
      A user who mis-taps and un-ticks either loses a run permanently or does not — and the
      observable is whether the series ends one occurrence early or one late. It is the
      ordinary case, since AC-28's whole reason for existing is that un-ticking is how a
      mis-tap is fixed. A test asserting "the series ends after N runs" is green under both
      implementations unless it includes an un-complete, and nothing says it must.
    would_not_be_a_finding_if: >
      AC-25 said the count reads occurrences currently in the done state, or said a
      completion once counted is never un-counted.
    directive: One clause in AC-25 stating whether the count is over the current done set or over completion events.

  - id: T27
    severity: MEDIUM
    acs: [AC-15, AC-26, AC-43]
    claim: >
      A step move can renumber siblings, and the spec never says whether it is one write or
      several. AC-26's rule "a write that changes more than one row returns every row it
      changed" enumerates three such writes and reordering is not among them; AC-43 requires
      a reorder to be reversible by a **single** action.
    consequence: >
      If a move is N PATCHes, AC-43's single-action undo must reverse N writes with no
      stated grouping, and AC-3's live-update guarantee renders the intermediate orders to
      every other client — the same window AC-14 refused for POST-then-PATCH. If it is one
      write returning N rows, AC-26's list is incomplete and architecture will not build the
      multi-row response for it. The api tier cannot write "the order persists" without
      knowing which it is.
    would_not_be_a_finding_if: >
      AC-15 said a move is a single write (e.g. a sparse or fractional position that touches
      one row), or reordering appeared in AC-26's multi-row list.
    directive: State the write shape of a move in AC-15, and add it to AC-26's enumeration if it is multi-row.

  - id: T28
    severity: MEDIUM
    acs: [AC-43, AC-48, AC-47]
    claim: >
      AC-43's undo offer ends only by use, dismissal, or replacement by a later undoable
      action. AC-48 enumerates what the subject swap settles — focused dirty fields, an
      uncommitted repeat preview, a step move in flight — and does not mention an
      outstanding undo offer. A surface teardown is none of AC-43's three endings.
    consequence: >
      Delete a step, then activate a message's door to another task: either the offer
      silently disappears — which is the loss AC-47 built a whole notice family to prevent,
      one door over, on the one action in this feature that is otherwise irreversible — or
      it survives with nowhere stated to render. AC-47's own test note asserts across a
      teardown; AC-43's asserts in place, so neither tier covers the composition.
    would_not_be_a_finding_if: >
      AC-43 named a surface teardown as an ending, or AC-48 listed the undo offer alongside
      the preview and the in-flight move, or AC-47 said the offer joins its notice family.
    directive: >
      Add the undo offer to AC-48's settle list, and say whether it ends with the surface or
      outlives it. If it outlives it, AC-47 already answers where — say so, so design is
      asked once (AC-47 already makes that point about AC-38).

  - id: T29
    severity: MEDIUM
    acs: [AC-33, AC-47, AC-38, AC-40]
    claim: >
      AC-33's 4.1.3 enumeration is the QA checklist for announcements, and it was not
      updated by the T-153 amendment or by AC-40. AC-47 says "it joins AC-33's 4.1.3 list"
      but AC-33 does not name it; AC-38's passed-reminder surfacing is an announcement that
      renders outside any surface and is absent; AC-40's turn-path refusals are new and
      absent, while AC-18's HTTP-path refusals are listed.
    consequence: >
      The a11y coverage of this feature is authored from AC-33's parenthesis. Three
      announcements are outside it, so three are asserted by nobody — including the one the
      owner's decision created and the one that fires during an outage, when a screen-reader
      user has least other information.
    would_not_be_a_finding_if: >
      AC-33's list named AC-47's notice, AC-38's surfacing and AC-40's turn-path refusal,
      or AC-33 read "every refusal and every status message in this spec" rather than
      enumerating.
    directive: Update AC-33's 4.1.3 list, or make it a rule instead of an enumeration.

  - id: T30
    severity: LOW
    acs: [AC-34]
    claim: >
      AC-34's "On replay (undo, and the AC-12 re-validation)" and `## Impact` §4's
      "`question.ask_snapshot` (AC-12)" both mean **F-001** AC-12. F-005's own AC-12 is the
      date-picker shortcuts.
    consequence: >
      AC-34 is api-tagged and its second replay site is a bulk-delete re-validation. A QA
      author resolving "AC-12" within the spec they are reading tests a date picker against a
      snapshot rule and never covers `ask_snapshot`'s old-shape exposure — which `## Impact`
      §4 says has the same shape and the same exposure as undo.
    would_not_be_a_finding_if: Both references were written "F-001 AC-12".
    directive: Qualify both.

  - id: T31
    severity: LOW
    acs: [AC-41]
    claim: >
      AC-41 states the restore for a soft-deleted row and gives no outcome for a restore
      aimed at a row that is not deleted. AC-18's "every refusal names its outcome" clause
      is written about nesting and recurrence shapes.
    consequence: >
      The idempotency case on a brand-new write path — the one AC-43's undo calls, on a
      surface where a double-tap is ordinary — has three guessable answers (200 no-op, 404,
      409) and the wrong guess passes against a silent no-op.
    would_not_be_a_finding_if: >
      AC-41 said a restore of a live row is a no-op, or brought it under AC-18's refusal rule
      explicitly.
    directive: One clause in AC-41.
```

## Part C — checked and sound (anti-theatre)

Examined against the lens's four questions and found nothing to report:

- **AC-1, AC-3, AC-5, AC-12, AC-23, AC-29** — T3/T5/T11/T12/T16's fixes are genuinely testable as rewritten; the both-pending clause in AC-3 gives one storable value and one displayable value, which is what T3 asked for.
- **AC-2's api half** — the interleaving proof is named rather than left to inspection, and `updated_at` advancing is a direct observable.
- **AC-6, AC-37** — all three empty forms enumerated on both; T13's permanently-green export clause is gone.
- **AC-8** — the migration is measured (790/783/7) and the tolerant read's fixture problem is correctly *named*; only its construction is unowned (T22).
- **AC-14, AC-18, AC-20, AC-21, AC-32** — one-call step create closes the undefined-position window; the zero-AI-call seam already has working F-001 precedent; AC-21's two exclusions each have a named refusal.
- **AC-19** — four transitions, each separately reachable, and `completed_by_parent` gives the un-complete case something to read instead of a timestamp comparison. This was the lens's strongest round-1 concern about invention and it is closed properly.
- **AC-24** — the clamp names the shipped failure and the `{30,31}`-in-April de-duplication is the case a month-boundary table would have missed.
- **AC-27** — four independent regression targets, and the all-day anchor for the reminder offset is stated; only `reminder_shown_at`'s lifecycle is missing (T20).
- **AC-28** — five conjunctive conditions with one case per door, L-012's remedy applied correctly; still the best-constructed AC in the spec.
- **AC-34** — the two opposite treatments (replay vs comparison) are correctly separated; only the precondition is unbuildable (T22).
- **AC-35** — six readers named, the mutation test (route it through `isFiled` and the collection half still passes) is stated, and the handle list is asserted directly. Convergence 7 landed in full.
- **AC-36** — runtime refusal chosen over type-level impossibility, one fixture row per permitted field, and the refusal made expressible. T1 is fully closed.
- **AC-45, AC-47, AC-48** — web-tagged and outside this tier, but examined for api preconditions: AC-47's teardown case and AC-48's swap case are constructible from client-side fault injection and need nothing from the api layer that does not already exist. AC-47's exclusions (AC-4's deleted-task case produces no notice; durability deferred to OQ6) are stated as absences that can be asserted.
- **`## Impact` §5, §10, §12** — the claims about what current suites assert are correct in this lens's terms: AC-35's round-1 assertion did pass green against five unreached readers, and `## Test strategy` now asserts the handle list directly, which is the half that let it pass.
- **`## Test strategy`** — AC-5's `updated_at`-held-equal proof, AC-7's differential held equal against AC-9/AC-17, AC-33's 1.4.3 computed from `tokens.json`, AC-43's no-op asserted as an absence, and AC-46's two turns: all four correctly shaped. The section's only defect is that one of its bullets (the seed path) is load-bearing infrastructure rather than test guidance (T22).

`acs_covered` is all 48. Nothing was skipped.

## Cross-lens note from the lens itself

T22 and T23 are both incomplete landings of this lens's own round-1 findings and
both resolve into `## API Touch Points`, which is architect-owned territory — if
the architect lens reaches them independently this round, that is **agreement the
section is short, not a conflict**. T21 (a missing platform tag) is the same class
as the five tags revision 2 corrected; it needs no lens debate, only the tag.
