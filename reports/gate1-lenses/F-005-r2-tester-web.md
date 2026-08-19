# Gate 1 round 2 — F-005 — tester lens (web)

Persisted by the orchestrator at return time per **L-009**. The lens wrote
nothing, which is its contract.

**HIGH 4 · MEDIUM 9 · LOW 2.** Confidence HIGH. All 48 ACs examined; findings
scoped to the 36 web-tagged ACs, the two `(api)` ACs whose stated observable lands
on web (AC-36, AC-40), and `## Impact` in tester terms.

**Round-1 disposition check.** Both re-checks the briefing named landed: **T1**
(AC-36 now chooses the runtime refusal and requires the AI-facing shape to
*carry* the structural fields, so a fixture row can attempt one) and **T2**
(AC-26 restated as a generation rule; AC-28's two-open-occurrence outcome named as
AC-30's plural fixture). Twelve of the other fourteen landed. **T3** and **T6**
did not fully land (W2, W4). **T14 landed but was not carried forward** when
AC-39 arrived (W14).

## HIGH

```yaml
- id: W1
  severity: HIGH
  acs: [AC-2, AC-47]
  claim: >
    A write that is still in flight when the detail closes, and fails afterwards,
    is covered by neither AC-2 nor AC-47. AC-47's trigger is "when the detail
    closes … while a write on it is in the failed state AC-2 describes" — the
    failure must already exist at the moment of closing. AC-2's in-flight bullet
    says only that the write "resolves against the stored task"; it is silent on a
    failed resolution, and by then there is no field for AC-2's governing sentence
    ("leaves the user's value in the field") to act on.
  consequence: >
    The user's typed value is lost with no notice — the exact silent loss AC-2
    forbids and AC-47 exists to prevent, arriving through the ordering the owner's
    own reasoning identifies as the ordinary one: a server outage means the write
    is pending at close and fails after. `## Ops` already names this case
    ("failed writes that outlived their surface"), so the intent exists and only
    the trigger sentence is wrong. Earliest catch is a web e2e test nobody will
    write, because neither AC asks for the case.
  would_not_be_a_finding_if: >
    AC-47's trigger read "a write started on this detail that fails, whenever it
    fails", or AC-2's in-flight bullet stated what a post-close failure does.
  directive: >
    Widen AC-47's trigger from "in the failed state at close" to "fails at any
    point after being started on that detail", and say so in AC-2's in-flight
    bullet.

- id: W2
  severity: HIGH
  acs: [AC-3]
  claim: >
    The both-pending clause added to close T3 has two readings that produce
    opposite observables, and its own summary sentence states two guarantees that
    cannot both hold. "Saves the user's value first, and the deferred value then
    applies only if it still differs from what was stored": if "what was stored"
    is the store after the user's save, the assistant's deferred value always
    differs and always applies, so the user's edit is replaced on screen; if it
    is the value the deferred arrival came from, it never differs and never
    applies. The next sentence — "the user's edit is never lost to an arrival and
    an arrival is never lost to an edit" — is violated by one reading each way.
  consequence: >
    The spec's own `## Test strategy` calls this "the highest-value single case in
    the feature" and it has two defensible expected results, so the test written
    for it encodes whichever the implementer chose — a mirror, not a check
    (round-1 T5's shape, applied to the case T3 was raised about). This is the
    one interleaving that AC-2's field-level guarantee is proven by.
  would_not_be_a_finding_if: >
    AC-3 named the value the control displays once the blur resolves, as one
    observable — e.g. "the control displays the value the store holds after both
    writes resolve, in write order" — instead of a conditional plus a two-sided
    guarantee.
  directive: >
    Replace the conditional with a precedence rule and one observable: which value
    is stored, which is displayed, and whether the arrival cue fires. Drop
    whichever half of the two-sided guarantee the rule does not keep.

- id: W3
  severity: HIGH
  acs: [AC-47, AC-3, AC-36]
  claim: >
    AC-47's notice "ends … when a later successful write to that same field
    supersedes the value", and does not say whose write. An assistant turn setting
    `note` is a later successful write to that field — and AC-36 plus the owner's
    voice decision make it a *required* fixture row, not a hypothetical. Read one
    way the notice dies and the user's typed value disappears with it, silently.
    Read the other way the notice stands, and reopening the detail shows "the
    user's value, still failed, never the stored value" (AC-47) over a newer
    assistant value that AC-3 guarantees will be displayed.
  consequence: >
    Either the value is silently discarded — which is what AC-47's own
    no-self-dismiss bullet forbids, one screen later — or AC-3's live-update
    guarantee is false for any field carrying a notice. Both are shippable and
    the test author cannot tell which to assert. Earliest catch is a bug report
    from a user who spoke to the assistant while a notice was outstanding.
  would_not_be_a_finding_if: >
    AC-47's supersede clause named whose write counts, and stated what the
    reopened detail shows in the case it excludes.
  directive: >
    Say whether a turn's write supersedes a notice. If it does, the supersede must
    be visible rather than a disappearance; if it does not, say what the reopened
    field shows and that AC-3's guarantee is suspended for that field until the
    notice resolves.

- id: W4
  severity: HIGH
  acs: [AC-44, AC-12, AC-13, AC-23, AC-25, AC-38]
  claim: >
    AC-44 requires "a single injectable clock seam per side" — a code requirement,
    which is what T6 asked for — but nothing requires the web tier to be able to
    *drive* the client seam, and nothing requires the two seams to be held at one
    instant. Checked against the harness that exists: `qa-test-server.ts` exposes
    only `POST /__qa__/advance-clock` over a server-side `FakeClock`
    (`src/assistant/api/ports/clock.ts`), and the browser under Playwright runs
    the real app against `npm run dev:web` on the real wall clock. The two sides
    are already at different instants today.
  consequence: >
    Five web-tagged date ACs cross the boundary — AC-12 resolves shortcuts on the
    client and sends an instant, AC-23 aligns on the server in the user's zone —
    so a web e2e test computes its expected date from one clock while the app uses
    two. `## Test strategy` states the failure mode itself ("green until a Friday
    CI run") and AC-44 is named as its remedy, which makes this L-014's shape: the
    remedy is adopted and the tier that needs it still cannot use it. Earliest
    catch is a CI failure on a date boundary, attributed to flake.
  would_not_be_a_finding_if: >
    AC-44 or `## Test strategy` required the client seam to be settable from the
    e2e harness and the two seams to be held at one instant for a run, or if the
    web-tagged date ACs were assigned to a tier that already owns both clocks.
  directive: >
    Add to AC-44: both seams are settable by the test harness, and a run holds
    them at the same instant and zone. Name the mechanism for the client seam the
    same way the server's `/__qa__/advance-clock` is named.
```

## MEDIUM

```yaml
- id: W5
  severity: MEDIUM
  acs: [AC-1]
  claim: >
    The T11 disposition removed the 13-row table but the replacement guarantee
    names no object. "Never as absent from the surface's own account of itself"
    does not say what that account is — a list, a summary, an accessible
    description — and the AC explicitly says the guarantee is *weaker* than "eleven
    empty inputs are drawn at once", so asserting all seven controls are visible
    would fail a compliant implementation that collapses empties behind a
    disclosure. The reachability half has no action budget.
  consequence: >
    AC-1 is the precondition of every other web TC in the feature and has no
    assertable form. Both available tests are wrong: visibility over-constrains,
    reachability has no bound.
  would_not_be_a_finding_if: >
    AC-1 named the object constituting "the surface's own account of itself", or
    gave the reachability bound an action budget.
  directive: >
    Name the account (or require all seven controls present), and give reaching a
    field an action count the way AC-1 gives opening the detail one.

- id: W6
  severity: MEDIUM
  acs: [AC-39, AC-30, AC-25]
  claim: >
    Both web ACs turn on "a live series" and nothing defines it. AC-25 makes
    `series_id` survive clearing the repeat, so `series_id != null` is not it;
    AC-25 gives three endings and only the first is described as leaving "an
    ordinary task". A row whose end date has passed but whose occurrence is still
    open has no answer.
  consequence: >
    Three predicates all pass the only test a spec-derived author would write.
    AC-30's second control ("present only on a task in a live series") inherits
    the same hole, so a user can be offered "delete the whole series" on a series
    that ended.
  would_not_be_a_finding_if: >
    The spec defined "a live series" once, as it defines "empty" for AC-37 and
    "this weekend" for AC-12.
  directive: Define it in one place and have AC-30 and AC-39 both cite it.

- id: W7
  severity: MEDIUM
  acs: [AC-38]
  claim: >
    AC-38 is new and under-determined in the three dimensions its two structural
    siblings each settle: no dismissal rule and no lifetime (AC-43 and AC-47 both
    have one); no aggregation rule for a user with N passed reminders (AC-2 and
    AC-47 both state "one, not N", with the same 4.1.3 reasoning); and it does not
    say who writes `reminder_shown_at` or at what moment.
  consequence: >
    "Surfaced once" has no deterministic observable at the reload boundary — the
    open-then-reload test races whatever writes `reminder_shown_at` — and the
    N-reminder case has no expected result at all: ten passed reminders may be one
    surface or ten, and whether all ten are marked shown when only three were seen
    is undecided, which loses reminders permanently.
  would_not_be_a_finding_if: >
    AC-38 stated its dismissal rule, its aggregation for N reminders, and who
    writes `reminder_shown_at` and when.
  directive: >
    Give AC-38 the three clauses AC-47 already has, and say whether marking shown
    is the server's on read or the client's on render.

- id: W8
  severity: MEDIUM
  acs: [AC-43]
  claim: >
    AC-43's lifetime names three enders and then adds that it "survives long
    enough to be reached by keyboard and by a screen reader, which is a floor on
    the duration". No floor value is given, and the phrasing permits a timer
    alongside something else. AC-47 states the analogous rule exactly —
    "elapsing is not a resolution" — and AC-43 does not.
  consequence: >
    Three implementations pass: no timer, a 5-second timer extended on focus, a
    30-second timer. The test author invents a threshold and the test becomes a
    mirror of that invention. The undo is the only reversal for four destructive
    actions including step deletion.
  would_not_be_a_finding_if: >
    AC-43 named a minimum duration, or said as AC-47 does that elapsing is not a
    dismissal.
  directive: Pick one and state it: no time-based dismissal, or a named minimum.

- id: W9
  severity: MEDIUM
  acs: [AC-47, AC-4, AC-31, AC-42]
  claim: >
    AC-47 forbids *creating* a notice when the failure's cause is that the task is
    gone. It does not say what happens to a notice that already exists when the
    task is deleted afterwards — by a turn (AC-4), from the detail (AC-31) or from
    a list row (AC-42). Deletion is none of its three enders.
  consequence: >
    A retry button offering to write to a soft-deleted row: dead, or a
    resurrection — the state AC-47 forbids by one door and leaves reachable by
    three others. This is L-005's shape, which this spec cites four times.
  would_not_be_a_finding_if: >
    AC-47 named deletion of the task as an ender of an outstanding notice.
  directive: >
    Add deletion to the enders, and say whether the value it was carrying is
    reported or dropped.

- id: W10
  severity: MEDIUM
  acs: [AC-45]
  claim: >
    AC-45's central claim — "a single application state placed by CSS at both
    widths — never two states selected by a measured width" — is stated as an
    implementation prohibition with no runtime observable. The only test it
    directly supports is a source grep for a width read, which L-002 records as
    evidence rather than proof.
  consequence: >
    The falsifiable form is that the detail's subject, focused field, dirty value
    and uncommitted repeat preview all survive a viewport crossing of
    `breakpoints.split` — and nothing asks for it, so a two-state implementation
    that resets on the crossing passes every test derived from this AC while a
    grep of the source stays clean (the width read can be in a hook, a media query
    listener, or a resize observer).
  would_not_be_a_finding_if: >
    AC-45 or `## Test strategy` named the state-survives-the-crossing observable.
  directive: >
    State the runtime consequence: crossing the split while the detail is open
    changes nothing about what it holds.

- id: W11
  severity: MEDIUM
  acs: [AC-13]
  claim: >
    `## Impact` §10 names the two code sites AC-13 changes and names no existing
    assertion that changes with them. Checked: two shipped web tests pin
    `dueAtForCollection('today')` to local midnight and both carry comments citing
    ADR-009 §4 as the reason — `src/assistant/web/__tests__/collections.test.ts:793`
    and `src/assistant/web/__tests__/app.test.tsx:1052`. §9's routing list, which
    is careful about every document that becomes wrong, does not mention ADR-009 §4.
  consequence: >
    §10 tells the implementer to change `dueAtForCollection`, and doing so turns
    two green ADR-cited tests red — putting whoever ships it in front of exactly
    the "weaken the assertion to green" decision the ethos forbids, arrived at
    legitimately because the spec asked for it. If instead the stored instant does
    *not* change and only the flag and the formatter do, §10's first consequence
    names the wrong site and the web QA tier will author against it.
    (The same shape exists once at the api tier:
    `src/assistant/api/__tests__/tasks.test.ts:74` asserts `POST /tasks` with
    `reminder_at` returns 400 naming the field, which `## API Touch Points`
    requires to invert.)
  would_not_be_a_finding_if: >
    §10 named those two assertions and said which way they resolve, or stated that
    the stored instant is unchanged and only `due_all_day` and `formatDue` move.
  directive: >
    Say whether `dueAtForCollection`'s stored instant changes. If it does, route
    ADR-009 §4 in §9 with the other documents and name the two assertions.

- id: W12
  severity: MEDIUM
  acs: [AC-33, AC-38, AC-47, AC-36, AC-40]
  claim: >
    AC-33's 4.1.3 and 2.1.1 clauses are closed enumerations, and they are the
    mechanism by which behaviour specified on non-web-tagged ACs reaches the web
    tier. Four things needing it are absent: AC-36's and AC-40's refusals (both
    `(api)`, both promising a "visible outcome" that no web-tagged AC verifies),
    AC-38's on-open surfacing and its reachable control, and AC-47's notice —
    which declares its own membership from a side AC-33 was not updated to match.
  consequence: >
    The web a11y TC is authored from AC-33 and will verify a set that no longer
    matches the feature. AC-36's refusal is the sharper half: revision 2 changed
    five platform tags precisely because tags decide which tier verifies an AC,
    and AC-36's refusal keeps a web-side observable on an api-only tag.
  would_not_be_a_finding_if: >
    AC-33's lists were extended, or each of AC-36/AC-38/AC-40/AC-47 carried its
    own web-verifiable announcement clause rather than a reference to a list it is
    not in.
  directive: >
    Extend AC-33's two enumerations, or make AC-36's "visible outcome" a
    web-tagged obligation in its own right.

- id: W15
  severity: MEDIUM
  acs: [AC-9, AC-8, AC-33]
  claim: >
    AC-8 defines four priority states. AC-9 inherits a *one-glyph* visual
    vocabulary — "the original product's single top-level `!`", explicitly chosen
    over Apple's graduated `!` / `!!` / `!!!` — and AC-33's 1.4.3 forbids carrying
    the difference in colour. One shape, no colour, three marked levels: nothing
    says how `low`, `medium` and `high` are visually distinguished, or whether
    `low` and `medium` are marked at all.
  consequence: >
    Only two of four states have a defined visual observable, so an implementation
    that renders a mark for `high` and nothing for `low` and `medium` passes every
    test AC-9 supports. Only the accessible-name half is assertable across all four.
  would_not_be_a_finding_if: >
    AC-9 said the four states are distinguished by the accessible name and the
    visual mark distinguishes only marked from unmarked, or gave a visual
    vocabulary for three marked levels.
  directive: >
    State which of the four states carry a visual mark and how marked levels
    differ from each other without colour.
```

## LOW

```yaml
- id: W13
  severity: LOW
  acs: [AC-16]
  claim: >
    AC-16 enumerates the move mode as idle → grabbed → moving → dropped →
    cancelled and names entry conditions for every state but `cancelled`.
  consequence: >
    The state-transition case for `cancelled` has no trigger, so it is written
    against whatever the implementer chose (Escape, a drop outside the list, blur)
    or skipped — on the accessible path the AC exists to stop being built last and
    worst.
  would_not_be_a_finding_if: AC-16 named what enters the cancelled state.
  directive: >
    Name the cancel trigger, or say it is design's and that the state is reachable
    by keyboard.

- id: W14
  severity: LOW
  acs: [AC-7, AC-39, AC-9, AC-17]
  claim: >
    The T14 disposition landed in `## Test strategy` — "AC-7's differential must
    hold the row equal while AC-9's mark and AC-17's counter mutate that same row
    in the same release" — but was written before AC-39 existed. AC-39 puts a
    third mark on the same row in the same release and is not named there.
  consequence: >
    AC-7's only falsifiable form is a differential, and a differential that
    controls for two of three mutations is not one. A repeat mark appearing on the
    row would be indistinguishable from the note marker AC-7 forbids.
  would_not_be_a_finding_if: That sentence named AC-39 alongside AC-9 and AC-17.
  directive: >
    Add AC-39 to the list of row mutations the AC-7 differential must hold equal.
```

## Checked, sound (anti-theatre)

Round-1 dispositions verified as landed **in the spec text rather than the log**:
**T1** (AC-36 chooses the runtime refusal; the AI-facing shape must carry the
structural fields; a row that tries is part of the AC) · **T2** (AC-26 restated as
a generation rule; AC-28's two-open outcome named as AC-30's plural fixture) ·
**T4** (AC-43 exists with scope, shape, non-stacking and an explicit "not the turn
undo") · **T5** ("this weekend" = the nearer of Sat/Sun 09:00 still in the future —
one rule, no boundary hole) · **T7** (`## Test strategy`'s seed-path bullet covers
all three unconstructible preconditions, including AC-15's restart as a store
re-open) · **T8** (AC-5 requires `updated_at` held equal — L-012's remedy stated in
the AC, not only in prose) · **T9** (two save models assigned; "no third model") ·
**T10** (AC-18 states the refusal outcome once for the whole spec) · **T11**
(partially — see W5) · **T12** (the AC-23/AC-29 boundary is drawn) · **T13** (the
export clause is removed rather than left as a permanently green row) · **T15**
(1.4.3 computed from `tokens.json`) · **T16** (the arrival cue re-subjected).

Examined and found no finding: AC-4's terminal state · AC-6's note round-trip and
the empty/whitespace/newline distinction · AC-8's four states · AC-10's clear
distinguishable from a zero date and an empty string · AC-11's load-bearing half ·
AC-14's one-call create · AC-15's four edges · AC-17's zero case · AC-19's four
transitions with `completed_by_parent` making the un-complete case readable ·
AC-20/AC-32's zero-AI-call claims against F-001's existing counter seam · AC-23's
disclosure-before-commit · AC-25's until-and-count refusal · AC-30's two controls ·
AC-31/AC-41's restore as a server row rather than a client buffer · AC-35's six
named readers · AC-37's three empty forms · AC-42's "same undo" · AC-48's swap
case, including the preview-discard asserted directly · AC-47's three named
mutations and the one-retry-path-two-doors rule.

`## Impact` in tester terms: §5's six readers check out against the existing web
first-run assertion — `qa/assistant/F-001/web/TC-031` seeds an *empty* account, so
it stays green and would not catch the steps-only regression, which is exactly why
the Test strategy's steps-only case is needed and is present. §6's priority
narrowing breaks no shipped assertion. §10 is where the section stops short in this
lens — W11.

**Scope note.** `acs_covered` is all 48. Findings are confined to the tester lens's
four questions and to `## Impact` in tester terms; no comment on artifacts that do
not exist at Gate 1, on scope or spec length, or on `INV-INBOX-FILING`.
