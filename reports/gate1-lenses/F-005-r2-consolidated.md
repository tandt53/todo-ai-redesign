# Gate 1 — F-005 — consolidation, round 2

**Verdict: REJECT. Round 2 of a cap of 2 — the cap is now reached.**
**HIGH 40 · MEDIUM 44 · LOW 15 = 99 findings** across nine lenses. Every lens
returned an explicit `checked:` list, so the anti-theatre rule was satisfied by all
nine, and every one examined all 48 ACs.

| Lens | HIGH | MED | LOW | Verdict |
|---|---|---|---|---|
| tester (api) | 8 | 5 | 2 | REJECT |
| tester (web) | 4 | 9 | 2 | DONE |
| tester (mobile) | 5 | 4 | 1 | DONE |
| dev (backend) | 5 | 2 | 1 | DONE |
| dev (web) | 4 | 3 | 3 | DONE |
| dev (mobile) | 5 | 4 | 1 | DONE |
| architect | 4 | 6 | 1 | DONE |
| design | 3 | 4 | 1 | DONE |
| product | 2 | 7 | 3 | **REJECT** |

Round 1 was 5 lenses, 20 HIGH on 37 ACs. **Round 2 is 9 lenses on 48 ACs, eleven of
which no lens had ever read.** Individual returns are persisted beside this file per
**L-009**; this consolidation is routing and is not a substitute for them.

---

## What this round was asked to do that round 1 could not, and what it found

The second question — *does the revision log's `resolved` actually appear in the spec?*
— earned its cost. **Four lenses independently found dispositions that did not land**,
and one found a log row that credits a fix to an AC carrying half the finding:

- **tester (api)** — four of its sixteen round-1 findings landed incompletely (T17,
  T19, T22, T23), all four recorded `resolved`.
- **design** — twelve of twelve design rows are on disk and say what they claim, **and
  one is true as an edit and false as an outcome**: D9's replacement directive ("pick
  an accent from unspent tokens") **cannot be executed**, because the palette has no
  unspent accent. Repeated in three places, so every reader believes it is solved.
- **dev (web)** — round-1 dev-F8 was two claims; AC-44 carries one, and the log credits
  the whole finding.
- **product** — all fourteen of its dispositions hold, verified against spec text.

**The disagreement worth recording:** tester (api) calls the seed-path disposition
**HIGH and unlanded** — it is a sentence in `## Test strategy`, with no AC, no
`## API Touch Points` entry, no mechanism and no owner — while tester (web) reads the
same bullet as landed. This is not a conflict of directives; it is a disagreement about
whether prose in a non-normative section discharges a requirement. The api lens's
argument is the stronger one and it names the precedent: **this is the same shape
revision 2 refused to accept for AC-41**, which is exactly why AC-41 was promoted from
prose to an AC.

---

## Convergences — found independently by two or more lenses

In rough order of cost.

**1. The clock and the zone — six lenses.** (tester-api T23, tester-web W4, dev-backend
F2, dev-web M1+M2, dev-mobile F9, product P5.) AC-44 was created to end wall-clock
dependence and it displaces the problem rather than closing it, in four distinct ways:
the **zone travels only with a turn** (`req.timezone` is allowlisted on
`POST /assistant/turn` alone; the CRUD endpoints 400 on an unknown field) while every
computation AC-44 names is triggered by a **task write**; the **web harness cannot
drive the client seam** (`/__qa__/advance-clock` is server-side only, the browser runs
on the real wall clock); **the client seam AC-44 says does not exist already exists**
(`ControllerDeps.now`, and there are five inline sites, not three, two of them mobile);
and **AC-44 asserts the seam rather than the outcome**, so a perfect seam with an hour
of DST drift passes. AC-13 is the sharpest consequence: tagged `(api, web, mobile)`, it
would be resolved by the server without a zone and by each client in the device zone —
**three tiers asserting one AC on one row and getting three answers.**

**2. Close-then-fail — three lenses, on the owner's own decision.** (tester-web W1,
design D13, architect F4.) AC-47's trigger is keyed to the write's state **at the moment
of closing**; AC-2's in-flight bullet describes only a successful resolution. **The
ordinary order in an outage is close → then fail**, and on that path neither AC applies:
the value is lost silently, which is what AC-2 forbids and AC-47 exists to prevent.
**The trade the owner made — give up the hold, gain the notice — buys nothing on the
most likely close.** Corroborated by the spec's own `## Ops`, which counts two
categories of failed write and has no third, and by `## Test strategy`, which tests
fail-then-close and never close-then-fail. Architect adds that AC-48 already asserts
what the plain close does not grant, so **one of the two doors out of the detail is
specified and the other is not.**

**3. The multi-row write — four lenses, two halves.** (architect F1, dev-backend F3,
dev-mobile F2, tester-mobile M3.) *Sender:* the rule is stated as a **closed list of
three writes** and at least four more qualify — un-completing a parent, un-completing a
repeating task, restoring a cluster, deleting a series, and a step reorder if positions
are dense. *Receiver:* **nothing requires a client to read the response, and neither
client does** — all three shared write methods await and discard the `ApiResult` with no
`refreshTasks`. On mobile that makes **AC-39 vacuously true on the platform it was
created for**: the successor is never drawn, so no mutation of the repeat indicator can
turn the case red. Backend also finds `## API Touch Points` rejecting the blind-GET
alternative **on a false premise** — the controller already performs exactly that after
every mutating turn.

**4. `reminder_shown_at` — four lenses, two halves.** *No clear rule* (tester-api T20,
architect F6): re-setting a reminder on a task whose earlier one was shown leaves it
dead, and AC-27's successor clear-list names only `completed_by_parent`, so **every
occurrence after the first has a reminder that never fires** — the write-only data path
the owner's answer exists to close, rebuilt one level down. *Render is not resolution*
(design D16, product P1): a user who opens the app and is interrupted **has spent their
only delivery, on every device, permanently.** Product's framing is the sharpest —
**AC-47 forbids exactly this for a strictly less important object** ("elapsing is not a
resolution"), and AC-47 names AC-38 as its sibling. L-015's shape between two owner
answers of the same day.

**5. Accessibility falls off the mobile edge — five lenses.** (tester-api T29,
tester-web W12, tester-mobile M5, dev-mobile F3, product P2+P9.) **AC-33 is `(web)`**
and is a *closed enumeration*, and it is the mechanism by which behaviour specified on
non-web ACs reaches any tier at all. Four things need it and are absent: AC-36's and
AC-40's refusals (both `(api)`, both promising a "visible outcome" no tier verifies),
AC-38's surfacing, and **AC-47's notice, which declares its own membership in a list it
is not in.** Meanwhile AC-42/AC-43 put new affordances on the phone and defer their
announcement to that `(web)` AC — whose mobile counterparts (F-003 AC-9, AC-12) F-003
itself records as **unticked, "no headless observable at all"**. Product raises it to
HIGH on contract: `MANIFEST ## Knowledge` declares WCAG 2.1 AA, and **2.2.1 Timing
Adjustable — the criterion AC-43 and AC-47 both reason about without naming — is absent
from AC-33's list.**

**6. "A live series" is undefined — three lenses.** (tester-api T24, tester-web W6,
dev-mobile F6.) AC-25 makes `series_id` survive clearing the repeat, so it cannot be
the predicate; the recurrence fields survive both endings. **Every implementation that
keys off `series_id` or `recurrence.frequency` passes the positive case and marks
ex-repeating tasks forever**, and AC-39's falsifiable half cannot be written. AC-30's
"delete the whole series" control inherits the same hole, so it can be offered on a
series that ended.

**7. Offline is an uncovered state, and `## Impact` §1's list is short — three lenses.**
(dev-web H1+H4, dev-mobile F2+F5.) The three shared write methods **return before
attempting anything** when offline, and `persistLocal()` saves only `local === true`
rows — so an offline edit to a server task is **never sent, never queued, and replaced
at the next refresh**: the silent revert AC-2 forbids, arriving with nothing having
failed. **OQ6's premise is therefore wrong** — there is no pending edit whose durability
is in question. And `pushLocalTasks`'s five-field replay literal is a **fifteenth closed
field list** that §1 does not name and whose omissions produce no compile error, so a
note, reminder, step, priority or repeat set on an offline-created task is **silently
discarded at reconnect**.

**8. AC-38's "when the app opens" is two doors — two lenses, and it is L-005 again.**
(tester-mobile M4, dev-mobile F1.) `init()` and `onForeground()`, on the exact file
L-005 names in its Scope line, where BUG-002 was one obligation installed at one door.
F-003 AC-8 enumerates the transition set for the session read; AC-38 does not. And
because `reminder_shown_at` is a **stored** fact, two doors racing is a write race, not
a display glitch — while an **offline open cannot write it at all**.

**9. AC-46's undo record — two lenses.** (architect F2+F3, dev-backend F6.) The
snapshot is contractually captured **before** apply and AC-46's rows do not exist until
**during** it, so the touched-row set must be computed before capture — an ordering no
AC states, and *"inside the transaction"* does not supply it. Worse, undo removes the
successor on a **whole-row comparison** while AC-28's fifth condition is *"no step of it
ticked or changed"* — a ticked step does not touch the parent row, so **undo
hard-deletes a successor whose steps the user has worked on**, in exactly the case AC-28
exists to protect. Backend adds the unanswered half: does a turn-caused row enter the
turn's *anatomy*? Included, a voice "done" renders diff lines naming **step titles the
user has never seen**.

**10. AC-41's restore has no membership rule — three lenses.** (dev-backend F5,
tester-api T17, architect F7.) A hand `DELETE` sets `deleted_at` on one row and
**records nothing about what the gesture covered**. Keyed on `parent_id` the restore
resurrects a step deliberately deleted an hour earlier; keyed on the delete's membership
it needs stored server state no AC names. And AC-30's series delete is in **neither**
AC-43's coverage list nor AC-41's stated unit — while AC-30 has already spent the
confirmation dialog against the undo it does not have.

---

## Uniquely seen, and load-bearing

- **design D14 — the accent palette is empty.** Five accents, each with an assigned
  meaning under DESIGN.md § Colour rules 1; there is no sixth. F-005 asks that empty set
  to serve **three new marked meanings at once** (AC-9 urgency, AC-39 repeat, AC-43
  undo — which cannot be violet, fixed as "the assistant's own act"). The round-1
  remedy was repeated in three places and is unexecutable, so the likely build is design
  silently re-spending an assigned accent — the collision D9 was raised to prevent.
- **dev-web H3 — the message door's gate is unamended, and its own reason does not
  survive.** `canReveal` renders a task outside the on-screen collection as plain text,
  and `DEFAULT_COLLECTION = 'today'`, so **a dateless task the assistant just created is
  already dead as a door.** F-001 AC-31's inert clause is unamended by revision 6 and
  justified by "an affordance that does nothing" — false once the postcondition is a
  detail that needs nothing from the list. Leave it → the swap is dead for the common
  case, in the arrangement rev 6 calls "most obviously alive". Branch it → a link
  appears and vanishes as the detail opens, and a shipped meta string chosen
  width-independent on purpose becomes false.
- **dev-backend F1 — the turn path has no refusal to be "identical" to.** `TurnOutcome`
  has six members and none is a refusal; F-002's speech table is closed and has none
  either. `## Impact` §3's "no new SPK-* row is owed" was checked against the
  **permitted** half of AC-36 only. Three wrong answers are available and one of them —
  write nothing, say nothing — **passes AC-40's own fixture row.**
- **dev-backend F4 — the voice decision's create half ships broken.** `NewTaskFields` is
  filed among §1's harmless constructors and is actually the **turn-path create
  allowlist**; `applyCreate` hardcodes `reminder_at: null` and has no note. *"Add a task
  to call the dentist and remind me at nine"* creates the task with the reminder
  silently dropped. AC-36's "one fixture row per permitted field" is satisfied by an
  **edit** row, so it ships green.
- **dev-mobile F7 — `uc-coverage-map.md` D8's *definition* is still stale** while its
  two rows are corrected, and the file's own convention is that divergences are defined
  once and referenced. **The canonical text is the false one** — the identical fact that
  produced round 1's false premise and that the owner had to be corrected on before
  answering. §7 says it is done, §9 says it is owed.
- **dev-mobile F8 — `components.md § SaveNotice` already exists**, is persistent and
  dismissible, is drawn in all three shell mockups, has two reserved mobile ids, and its
  central argument is AC-47's no-self-dismiss rule *already reasoned*. AC-47 says no
  family exists; the phone already has the reserved home that two other mobile
  obligations need.
- **tester-mobile M1 — a fifth mobile leak §7 does not list.** Owner answer 3 makes
  `priority` voice-settable and the turn path runs on both clients; **AC-9, the only AC
  that renders priority, is `(web)`.** Say "make this high priority" on the phone and
  nothing on that client ever shows it.
- **tester-mobile M8 — the steps-only state is not constructible.** AC-18, AC-19 and
  AC-41 each close a path to it, so three of AC-35's six named readers are named for a
  state **no fixture can build**.
- **product P4 — the restore path has exactly one consumer and it does not stack.**
  Delete a task, delete a step two seconds later, and the task is **gone permanently**
  while the row sits there with `deleted_at` set and a working route pointed at it. The
  owner decided delete should be undoable regardless of door; **the depth was never put
  to them.**
- **product P7 — OQ6 is now blocking and was not in round 1.** AC-47 defers durability
  across reload to OQ6, and **reload is the first thing a user does when an app
  misbehaves during an outage** — the notice most likely to matter is the one most
  likely to be destroyed by the user's own recovery gesture.
- **product's re-derivation, second time: no over-build.** 24 requirements from
  `## Purpose` alone, 20 matched, **nothing in the spec absent from the derived list.**
  The eleven new ACs are not scope creep.

## No conflicts

No two lenses gave incompatible directives on the same AC. The one disagreement (the
seed path, §"what this round was asked to do") is about sufficiency, not direction.

## What did land, and is worth recording

Round 1's seven convergences are closed or reduced: AC-36's refusal is now exercisable
and AC-26's invariant no longer red on a sibling's path (tester); AC-35's six readers are
enumerated and the handle list asserted directly (four lenses verified it in source);
AC-45 is **buildable exactly as written** — `settings` is the shipped precedent for
replacing the centre and never the panel, every surface is mounted at every width, and
`display:none` makes F-001 AC-31 rev 6's "below the split the case does not arise" hold
**structurally rather than by intent**; the dateless-repeat branch now has one order
through a shared preview node; and AC-16's move mode is, in the design lens's words,
**the best-specified region in the feature**. Product rates AC-47 and AC-48 the two
best-written ACs in the spec — and P1 is a finding *because* AC-47 sets a standard AC-38
does not meet.
