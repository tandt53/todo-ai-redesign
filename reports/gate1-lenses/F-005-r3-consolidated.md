# Gate 1 — F-005 — consolidation, round 3 (targeted)

**HIGH 25 · MEDIUM 22 · LOW 11 = 58 findings** across nine lenses, each re-reading
only the ACs it raised findings on. Round 2 was 99. All nine returned a `checked:`
list; all nine verified dispositions against spec text rather than the log.

| Lens | ACs re-read | HIGH | MED | LOW |
|---|---|---|---|---|
| tester (api) | 25 | 4 | 4 | 2 |
| tester (web) | 25 | 2 | 3 | 0 |
| tester (mobile) | 15 | 3 | 2 | 1 |
| dev (backend) | 17 | 3 | 3 | 1 |
| dev (web) | 11 | 3 | 1 | 3 |
| dev (mobile) | 13 | 4 | 1 | 0 |
| architect | 17 | 2 | 2 | 2 |
| design | 9 | 2 | 4 | 1 |
| product | 14 | 2 | 2 | 1 |

## The headline: the dispositions landed. The amendments are what broke things.

Round 2's question was *did the fix land?* — and four lenses found dispositions that
had not. **Round 3's answer is different and better: essentially every disposition
landed.** tester (api): all fifteen, eleven in full. product: all twelve, "none is a
paper row". dev (web), dev (mobile), architect: all of theirs. design: seven of eight.

**Almost every finding this round is damage the amendment itself did.** Six lenses
said so in their own words, and three named the same mechanism: *an amendment that
closes a finding and opens a defect in the same paragraph.*

**The constraint held.** 48 ACs before and after, contiguous, none renumbered. Seven of
nine lenses state explicitly that none of their findings needs a new AC. **One lens
names the exception the owner asked to hear about** — dev (mobile) F3: AC-2's mobile
obligation was closed by *pointing at a `(web)` AC's rules*, and the pointer does not
carry the rule across the tag. Retagging was the honest amendment.

---

## Convergences

**1. AC-2's third state was written without the qualifier the owner's own decision
carries — four lenses.** (dev-web H1, dev-mobile F1, architect F1, product P14.)
The owner's answer was decided on, and the decision document says, *"an edit to a
**server-owned** task is never sent."* AC-2's rule dropped "server-owned". The shipped
guard is `task.local === true || this.state.offline || !this.onlineNow()`, and for a
**locally-created** row `persistLocal()` genuinely saves the edit and `pushLocalTasks`
genuinely replays it. So the spec as written **removes working behaviour**: create a
task offline, then be unable to fix a typo in it. Worse, the first arm fires **while
online**, so the stated reason is *a lie the user can disprove by looking at the
connection*. And QA writes from the spec — **the test asserts the refusal and the
regression ships green.** This is not a re-opening of the decision; it is a scoping slip
in how it was written down, and every lens said so.

**2. AC-38's acknowledgement model — six lenses, two distinct halves.**
*The gesture is undefined* (tester-web R5, design D22, product P15): "shown" was
replaced by "acknowledges", which is equally undefined, and the AC slips vocabulary
within four lines. If tapping through to the task counts, **a user who taps to look and
is interrupted has spent the delivery permanently, on every device** — the exact defect
the amendment exists to close. `## Test strategy`'s own case ("open, **do not
acknowledge**, reopen") **cannot be authored until the gesture set is closed.**
*The offline half contradicts the owner's answer* (tester-api T33, tester-mobile M12/M13,
dev-mobile F4, product P16): AC-38 says the acknowledgement "is recorded **when
connectivity returns**" while AC-2's third state — same revision — forbids exactly that
("never by a timer and **never by reconnection**"). tester (mobile) adds that the
recording has **two doors of its own** that AC-38 never enumerates, one clause after
installing L-005's remedy for the opening doors; dev (mobile) adds that
`reminder_shown_at` **is never named as carried on the wire**, so an offline open cannot
filter and every passed reminder re-surfaces on every foreground.

**3. `## Out of Scope` forbids exactly the change AC-14 requires — three lenses.**
(dev-web H2, dev-mobile F2, architect F1.) One section says "no widening of
`pushLocalTasks`'s replay literal"; AC-14 says "the replay carries the step's
`parent_id` and its position" and even names that literal as carrying neither today.
**There is one literal.** Read `## Out of Scope` last and an offline-created **step**
replays with `parent_id` dropped — **it returns as an ordinary top-level task, in every
collection and every count, which is what AC-35 exists to prevent** — silently, at
reconnect, invisible to type-checking. **C3 does not catch it: it checks endpoint ↔
handler, not a client projection.** Architect: this blocks *it* specifically — the
create contract cannot be written until it is answered.

**4. AC-44's zone is read everywhere and written nowhere — four lenses.**
(tester-api T34, dev-backend F1+F2, tester-mobile M14, product P17.) dev (backend)
measured the store: **there is no account entity at all**, so there is no record to
refresh and no write that could refresh it; the only channel is `req.timezone` on the
turn path. **An account that has never sent a turn has no zone, so every date
computation is refused** — which is precisely the by-hand user AC-32 guarantees can work
with zero AI calls while the assistant is erroring. Second half: **the refusal is
write-shaped and AC-13's use of it is a read** — measured, **0 of 790 rows carry
`due_all_day`**, so on day one that is every row on every `GET /tasks`; either the list
endpoint refuses (**the app cannot render**) or the server falls back silently, which
AC-44 forbids by name in the same sentence.

**5. AC-46's revert rule covers only the created class — two lenses, and it is one
word.** (architect F2, dev-backend F3.) AC-46's subject is "creates **or changes**" and
it names the AC-19 cascade as one of the two things it exists to cover — but AC-28's
five conditions **cannot be satisfied by a cascade-ticked step** (no `series_id`,
predates the turn, `updated_at !== created_at`). Read literally, **no cascaded step is
ever reverted**, which is *exactly the defect `## Impact` §4 says AC-46 closes*. dev
(backend) found the second half in code: the clause says the un-reverted row is "named
in the reverted turn's outcome message", and that is `undo.ts`'s `skipped` list, which
carries a `title` — so **undoing a voice "done" on a parent with eight steps puts eight
step titles into the message**, which AC-46's own third bullet and AC-35 forbid.

**6. AC-47 states the reopen case twice, in opposite directions — two lenses.**
(tester-web R2, dev-web H3.) The supersession rule landed; **the revision-2 sentence it
exists to replace was not withdrawn**, and that sentence is absolute ("**never** the
stored value") and sits under a heading that reads as the authoritative reconciliation.

**7. Where the hand-action undo lives, and whether a reload ends it — three lenses.**
(design D21, product P13, tester-api T38.) Three homes across three amendments: "in
place at the moment of the action", "where AC-47's notice renders", and counted among
the marks that "want this row". And AC-43 says its three enders are exhaustive ("and by
nothing else") while the family it now renders in **does not survive a reload** — so a
reload is a fourth ender of the only reversal for the only irreversible action here.
product: **that is OQ13's permanent-loss path reached by a second mechanism OQ13's text
does not mention**, so the owner would be answering the depth question with one of its
two causes hidden.

## Uniquely seen

- **tester (mobile) M11** — AC-35's new construction path offers two options and **the
  alternative turns the AC's own named account red**; the three readers need opposite
  sources, verified by running the account through all three.
- **dev (backend) F4** — **53 of 790 rows are already soft-deleted with no
  `delete_membership`**, across 18 accounts, all predating the field, and AC-41 makes
  them addressable while covering only the live-row case.
- **dev (backend) F5** — `removeTask` short-circuits on `task.local === true`
  **regardless of connectivity**, so a locally-created row is deleted with no server
  write *while online* — a third delete state neither AC-42 nor AC-43 names.
- **design D25** — AC-45's unconditional close is justified by "anything a close would
  lose is governed by AC-2 and AC-47", which is **false for an uncommitted repeat
  preview** — announced at the swap door (AC-48) and silent at the close door.
- **design D23** — `## Impact` §8 uses "three" for **two different sets** two paragraphs
  apart, so the mark budget is decided against the wrong count.
- **dev (backend) F6** — the F-002 dependency is stated without a consequence or a
  routing line, unlike §13 and §14, **and its analogy files a cross-spec amendment as an
  in-feature contract item this spec already discharges** — so it reads as handled.
- **dev (mobile) F3** — `§ SaveNotice`'s lifetime rule **clears on leaving the surface**,
  and on the phone `PathSwitch` is one tap and is primary navigation, so a value refused
  offline is cleared by the next tap to Talk.

## What is now solid

Both findings the architect lens called uncatchable-later landed: **AC-46's capture
boundary** is normative and §9 routes all three falsified contract documents, and
**close-then-fail** is closed at AC-47, AC-2, the flowchart, `## Ops` and
`## Test strategy`. `## API Touch Points` now carries five obligations that were prose —
tester (api) calls it **"the largest single improvement in the revision"**, because it
is the section architect builds from. AC-8's `none`-is-absence reconciles `Required: yes`
with the measured migration-free claim. AC-33's 4.1.3 became a **rule** rather than an
enumeration, and product verified **nothing was lost in the conversion**. AC-9's
unexecutable accent directive is gone from all three sites. product's second
re-derivation again found **no over-build**, and its deferrals (OQ13, OQ14) are the model
it asked for: the cost is stated in the AC, not only in the open question.
