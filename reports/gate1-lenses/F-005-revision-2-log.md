# F-005 — revision 2 log: what happened to every round-1 finding

**Date:** 2026-08-18 · **Task:** T-143 · **Agent:** spec-agent
**Reads against:** `reports/gate1-lenses/F-005-consolidated.md`, the five persisted lens
returns beside it (L-009), and `reports/owner-decision-2026-08-18-f005-gate1.md`.

**This file exists so the round-2 review is not spent re-deriving what changed.**
Round 1's cap is 2 — the review that reads this is the last one F-005 gets.

## Counts

| | HIGH | MED | LOW | total |
|---|---|---|---|---|
| Round 1, per the five lens returns | 20 | 34 | 10 | 64 |
| Disposition `resolved` | 20 | 34 | 9 | 63 |
| Disposition `noted, no action` | 0 | 0 | 1 | 1 |
| Disposition `deferred-to-OQ` | 0 | 0 | 0 | 0 |
| Disposition `rejected` | 0 | 0 | 0 | 0 |

**One arithmetic correction to the consolidation.** Its header reads *"HIGH 20 · MEDIUM
34 · LOW 8"*, but its own per-lens table sums the LOW column to **10** (tester 4,
architect 2, product 3, design 1). The per-lens returns are the record; **10** is the
number, and all ten are dispositioned below. Nothing was dropped by the discrepancy —
it is recorded because a count that disagrees with itself is how a finding goes missing
quietly.

**Finding ids are namespaced here.** Three lenses number their findings `F1…`, so a bare
`F2` is ambiguous across the returns. `T*` = tester, `dev-F*`, `arch-F*`, `prod-F*`,
`D*` = design.

## New acceptance criteria, and which findings forced each

**No AC was renumbered and none was deleted.** AC ids 1–37 keep their meaning; AC-38 …
AC-46 are new. Nine new ACs, every one of them forced by a finding rather than chosen:

| New AC | Tags | Forced by |
|---|---|---|
| **AC-38** — passed reminders shown on open | web, mobile | owner answer 1; prod-F3; D12 |
| **AC-39** — a generated successor is never indistinguishable from a user-created task | web, mobile | owner answer 2; prod-F4 |
| **AC-40** — field rules bind the write, not the door | api | dev-F2 |
| **AC-41** — a soft-deleted task can be restored | api, web | arch-F2; dev-F1 (convergence 1) |
| **AC-42** — the list row's delete gains the detail's undo | web, mobile | owner answer 4; prod-F11 |
| **AC-43** — the hand-action undo, defined | web, mobile | T4; prod-F7 (convergence 4) |
| **AC-44** — one clock, injectable, with a named zone | api, web | T6; dev-F8; prod-F13 (convergence 5) |
| **AC-45** — where the detail lives | web | D1; dev-F6 (convergence 6) |
| **AC-46** — turn-caused rows belong to the turn's undo record | api | arch-F4 |

**Platform tags changed** (tags decide which QA tier covers an AC, which is why this is a
finding and not a formatting choice — owner answer 2, prod-F4, dev-F9):
AC-2 → `(api, web, mobile)` · AC-13 → `(api, web, mobile)` · AC-19 → `(api, web, mobile)` ·
AC-26 → `(api, mobile)` · AC-35 → `(api, web, mobile)`.

## The four owner answers — where each landed

| Answer | Landed in | Open question closed |
|---|---|---|
| **Reminders** shown on open; no scheduler, push, permission or UC-26 dependency | **AC-38** (new); AC-11 rewritten — its self-contradicting disclaimer requirement removed; AC-10 and AC-27's reminder clause kept; `## Scope` gains a UC-26 *partly in* row; `## Out of Scope` scopes out scheduling only | **OQ2 removed** |
| **Mobile** web-first, three leaks plugged inside F-005 | five `(mobile)` tags above; **AC-39** (new); `## Impact` §7 rewritten with a four-row leak table; `## Out of Scope`'s mobile bullet rewritten. **The stale premise is corrected everywhere it appeared** (Impact §7, Out of Scope, the removed OQ8): `mobile/components/TaskList.tsx` calls `editTask` (line 71) and `removeTask` (line 136) | **OQ8 removed** |
| **Voice** — four value fields reachable; structure hand-only | **AC-36** rewritten: one fixture row per permitted field, and the refusal made *expressible* so it can be attempted; **AC-40** (new) closes the door AC-36 widens; `## Test strategy` carries both halves | **OQ9 removed** (AC-36 records it as answered) |
| **Delete** — the row delete gains its undo | **AC-42** (new), which makes **AC-41** (restore) mandatory rather than optional, and **AC-43** defines the undo all four delete ACs assert on | **OQ7 removed** |

## The seven convergences — resolved at every site the finding names

| # | Convergence | Sites fixed |
|---|---|---|
| 1 | Nothing can un-delete a row | **AC-41** (new) · `## API Touch Points` — the false *"No new assistant endpoints"* sentence replaced and the restore listed · `## Impact` §11 (new) · AC-15, AC-19, AC-31, AC-42 each now name AC-41 as the mechanism |
| 2 | Steps become voice handles; the message link goes inert | **the rule** — AC-35 gains the handle list as a named reader, AC-36 states a step is not addressable · **the test note** — `## Test strategy` asserts the handle list directly (*a task with eight steps contributes one handle*), which is the half that let this pass green · `## Impact` §12 (new) · `## Out of Scope`'s UC-18 argument re-checked against the narrower handle list and shown to survive |
| 3 | The dateless-repeat case had three answers | **AC-22** — one order stated: *create the due, then align it* · **AC-23** — alignment applies to a created due, a set due and a rule change alike; and the AC-29 boundary is drawn (T12) · **the flowchart** — the dateless branch now routes through the alignment decision and a shared preview node, and a paragraph under the diagram says so · the collection consequence stated once, in AC-22 |
| 4 | Three ACs assert on an undefined undo | **AC-43** (new): scope, shape, lifetime, dismissal, non-stacking, and an explicit *"it is not the turn undo"* · AC-15's no-op edge now has an object · step deletion is inside its scope (prod-F7) |
| 5 | The ACs' clock is not the harness's clock | **AC-44** (new), one seam per side and a named zone; `## Test strategy`'s clock bullet rewritten to name the four **web**-tagged date ACs, not only the api ones |
| 6 | The detail's containment is unstated; the shell has no room | **AC-45** (new): one application state placed by CSS, never a JS width branch; above the split it takes the list's column · **which F-001 AC is contradicted is named explicitly** — AC-24's *"zero actions above the split"* clause, with the corrected bound and the amendment routed as a dependency (`## Impact` §13, new; §9 routing) |
| 7 | The step exclusion does not reach every count | **AC-35** now names **six** readers, not one, including the mobile site that chooses between the first-run and empty-collection states and the a11y id set · `## Impact` §5 carries the six-row table · `## Test strategy` asserts the first-run/empty-collection choice for a user whose only rows are steps |

## Every finding, by lens

`resolved` = traceable to changed spec text, named in the *where* column.

### tester — 5 HIGH · 7 MED · 4 LOW

| id | sev | disposition | where it landed | reasoning |
|---|---|---|---|---|
| T1 | HIGH | resolved | AC-36 (refused half); `## Test strategy` | Chose the **runtime refusal** over type-level impossibility, on the product lens's reasoning that a refusal is testable and an incapacity is not. So the AI-facing change shape must be able to *carry* the structural fields, or no fixture row can attempt one. |
| T2 | HIGH | resolved | AC-26 (restated as a generation rule); AC-30 | The old invariant was red on AC-28's own path. Restated, AC-28's two-open-occurrence outcome stops being a contradiction and becomes AC-30's only fixture for its plural branch. |
| T3 | HIGH | resolved | AC-3 (both-pending clause) | Focused + dirty + incoming now has one answer: the user's value saves first, the deferred value applies only if it still differs. Named as the highest-value single interleaving case in `## Test strategy`. |
| T4 | HIGH | resolved | **AC-43** (new); AC-15, AC-19, AC-31 | The alternative the lens offered — drop AC-15's fourth edge — was rejected: the owner's delete answer needs the mechanism anyway, so defining it once is cheaper than removing one assertion and rebuilding it. |
| T5 | HIGH | resolved | AC-12 | *"This weekend"* = the nearest of Saturday 09:00 / Sunday 09:00 still in the future. One rule, no boundary hole, and it stops the test being a mirror of the implementer's choice. |
| T6 | MED | resolved | **AC-44** (new); `## Test strategy` | Convergence 5. |
| T7 | MED | resolved | AC-8, AC-34, AC-15; `## Test strategy` seed-path bullet | All three preconditions share one cause — the only way in is the write path that refuses them. The seed path is now stated as part of the contract rather than left to the harness. |
| T8 | MED | resolved | AC-5 sub-bullet; `## Test strategy` | Proof requires `updated_at` held equal. Without it the assertion is green whether or not the new field ever joined the comparison — L-012 exactly. |
| T9 | MED | resolved | AC-2 (save model); AC-20 | Value fields save on leaving the field; the repeat picker is the one preview-then-commit control. No third model, so no step of a repeat TC is a guess. |
| T10 | MED | resolved | AC-18 (refusal-outcome clause, stated once for the spec); AC-21 | A refusal with no named outcome passes against a system that silently drops the field — which is the failure AC-36 refuses elsewhere in the same document. |
| T11 | MED | resolved | AC-1 (restated to the user-settable set + activation gesture) | Also closes D2. `due_all_day`, `parent_id`, `step_order`, `series_id` are named as **not** user controls, so "every field this spec names" stops resolving to a 13-row table. |
| T12 | MED | resolved | AC-23 (AC-29 boundary clause); AC-29 | AC-23 governs the occurrence in front of you when the rule changes; AC-29 governs history. Both readings were supported; one is now. |
| T13 | LOW | resolved | AC-6 | The export clause is **removed** rather than kept — nothing in this repo exports, so it was a permanently green coverage row. "Never truncated" kept as the falsifiable half; the scroll height is design's number. |
| T14 | LOW | resolved | `## Test strategy` | AC-7's differential must hold the row equal while AC-9 and AC-17 mutate it in the same release. |
| T15 | LOW | resolved | AC-33 sub-bullet; `## Test strategy` | 1.4.3 is computed from `tokens.json`, not eyeballed. No axe needed, and the half AC-9 depends on stops being verified by nobody. |
| T16 | LOW | resolved | AC-3 (arrival cue re-subjected) | Constants inherited, subject changed, and a control holding a deferred value shows nothing until it applies. |

### dev — 5 HIGH · 4 MED · 0 LOW

| id | sev | disposition | where it landed | reasoning |
|---|---|---|---|---|
| dev-F1 | HIGH | resolved | **AC-41** (new); `## API Touch Points`; `## Impact` §11 (new) | Convergence 1. The false sentence is quoted and corrected in place rather than edited away, so the round-2 reviewer can see what changed. |
| dev-F2 | HIGH | resolved | **AC-40** (new) | The unguarded door is the one AC-36 widens, so this had to land in the same revision as the voice answer. AC-37's *"the guard belongs on the transition"* finally has a mechanism. |
| dev-F3 | HIGH | resolved | AC-35 (six readers); `## Impact` §5; `## Test strategy` | Convergence 7. |
| dev-F4 | HIGH | resolved | `## Impact` §10 (new); AC-13 sub-bullets | The lens's open sub-question — *what a pre-F-005 row with no `due_all_day` reads as* — is **decided**, not left open: all-day iff the instant is that day's local start. Safe because no picker has ever existed, so no stored due was a chosen time. |
| dev-F5 | HIGH | resolved | AC-35, AC-36; `## Impact` §12 (new); `## Test strategy` | Convergence 2. One fix closes both halves: a step that is never a handle is never named in a message, so the inert link cannot arise. |
| dev-F6 | MED | resolved | **AC-45** (new); `## Impact` §13 (new) | Convergence 6, and the contradicted F-001 AC is named. |
| dev-F7 | MED | resolved | AC-2 (mobile-half bullet) | Chose *change the shared controller* over *add a second write path*, and said so — the second is the duplication this spec objects to elsewhere. The `(mobile)` tag exists so a tier verifies F-001's row behaviour did not regress. |
| dev-F8 | MED | resolved | **AC-44** (new) | Convergence 5. |
| dev-F9 | MED | resolved (3 of 4 tagged; **AC-17 narrowed, with the reason stated**) | AC-2, AC-13, AC-35 gain `(mobile)`; AC-17 keeps `(web)` | AC-17's obligation is a **row that mobile does not draw**; its shared exposure is the count's derivation, which AC-17 already forbids sourcing from `collectionCount` and which AC-35's `(mobile)` tag covers at the model layer. Tagging AC-17 `(mobile)` would commission a mobile step counter this phase, which the owner's web-first answer does not. |

### architect — 4 HIGH · 7 MED · 2 LOW

| id | sev | disposition | where it landed | reasoning |
|---|---|---|---|---|
| arch-F1 | HIGH | resolved | AC-21 sub-bullet; `## Impact` §1; `## Data` closing note | The requirement is stated (cloning, equality and diffing must stay correct); **which** of the two remedies — flat columns or deep copy plus structural comparison — is architecture's, per this spec's scope. |
| arch-F2 | HIGH | resolved | **AC-41** (new); `## API Touch Points`; `## Impact` §11 | Convergence 1. The lens's second directive is answered too: a restore returns the parent **and its steps in one call**, which is why a client-side delay cannot substitute for it (AC-15 names a server row). |
| arch-F3 | HIGH | resolved | AC-22, AC-23, the flowchart | Convergence 3. |
| arch-F4 | HIGH | resolved | **AC-46** (new); `## Impact` §4 | Impact §4 analysed undo for row *shape* only; this is a row-*set* problem and it now has its own AC and its own Impact paragraph. |
| arch-F5 | MED | resolved | AC-26 sub-bullet; `## API Touch Points` | Both halves: a multi-row write returns every row it changed, and generation happens inside the completing write's transaction. |
| arch-F6 | MED | resolved | AC-36 sub-bullet; `## Impact` §1, §2 | `DIFF_FIELDS` splits in two. Impact §2 extended from note-in-a-diff-row to creates and deletes, which is the sharper case. |
| arch-F7 | MED | resolved | AC-35; `## Impact` §12 | Convergence 2. |
| arch-F8 | MED | resolved | AC-34 (second half, on comparison) | The two records need opposite treatments and revision 1 had only the replay one. An absent key in a stored record now compares **equal** to whatever is live. |
| arch-F9 | MED | resolved | AC-25 sub-bullet | Neither of the lens's two bad options: the count counts **completions**, not rows, so soft deletes cannot corrupt it and a series delete (which trashes only unfinished occurrences) cannot silently satisfy it. |
| arch-F10 | MED | resolved | AC-25 sub-bullet; `## Data` requiredness cell | `series_id` is assigned when a repeat is first set and **never cleared** — the alternative loses AC-30 and the run count their only key. |
| arch-F11 | MED | resolved | AC-14; `## API Touch Points`; `## Impact` §1 | One call, not POST-then-PATCH; the server assigns the position. The window the lens found is exactly the state AC-3 would render to another client. |
| arch-F12 | LOW | resolved | AC-35 sub-bullet; `## Impact` §5; §9 routing list | Both expressions narrow together and stay separate. The briefing's constraint is carried verbatim: `open_all` and `inbox_count` are **exactly equal today (716, all 193 accounts) and are two different facts**. |
| arch-F13 | LOW | resolved | AC-24; `## Data` | Candidates de-duplicated after clamping. Recorded with the lens's own point that the month-boundary table would not have contained the case. |

### product — 3 HIGH · 8 MED · 3 LOW

| id | sev | disposition | where it landed | reasoning |
|---|---|---|---|---|
| prod-F1 | HIGH | resolved | AC-19 (`completed_by_parent`); `## Data` | The lens offered *add a marker* or *overturn the decision and un-tick everything*. Took the marker: the decision it protects is the one the un-tick would break — tick a step, tick the parent a second later, lose your own tick. |
| prod-F2 | HIGH | resolved | AC-27 sub-bullet; `## Test strategy` | When `due_all_day` is set the offset is whole days and the reminder keeps its wall-clock time — never measured from a fabricated midnight, which is the anchor an implementer reaches for and the exact thing AC-13 forbids. |
| prod-F3 | HIGH | resolved **by the owner** | **AC-38** (new); AC-11 rewritten; OQ2 removed | The lens's third option — in-app surfacing only — is what the owner chose. It dissolves the contradiction rather than picking a side of it. |
| prod-F4 | MED | resolved | five `(mobile)` tags; **AC-39** (new); `## Impact` §7 | The lens's minimum obligation is taken verbatim as AC-39. Its verified good news (AC-35 reaches both clients through the shared `inCollection`) is recorded in §7 and in AC-35, because a checked backstop is worth as much as a found gap. |
| prod-F5 | MED | resolved | `## Impact` §7; `## Out of Scope`; §9 routes `uc-coverage-map.md` D8 | The stale sentence is corrected in all three places it appeared, and §7 states that the owner answered on corrected facts — so the decision is not later re-opened on the grounds that the premise was wrong. |
| prod-F6 | MED | resolved **by the owner** | AC-36 | One fixture row per permitted field. The lens's OQ9-widening is moot: the owner answered the wider question. |
| prod-F7 | MED | resolved | **AC-43** (new) | Step deletion is explicitly inside the hand-action undo's scope, so a step stops being the one thing in this feature you can destroy irreversibly. |
| prod-F8 | MED | resolved | AC-22 (disclosure clause); AC-33's 4.1.3 list | Same fix as D6. Any date the operation **adds or moves** is shown before commit — the asymmetry is closed in the direction of more disclosure, not less. |
| prod-F9 | MED | resolved, **and a new open question opened** | AC-7 re-sourced, market claim withdrawn; **OQ12** (new) | The prohibition survives on the source product's own removal decision. The false claim is removed rather than softened, and the *need* goes back to the owner — keeping it unexamined would repeat the cited lesson in the opposite direction. |
| prod-F10 | MED | resolved | AC-2 (close-over-write bullet) | Chose *the surface does not close while a write is unresolved*. The alternative needs a notice family that does not exist; recorded as the road not taken, in the AC and in `## Out of Scope`'s rejected list. |
| prod-F11 | MED | resolved **by the owner** | **AC-42** (new) | The lens's third option is what the owner took. |
| prod-F12 | LOW | resolved | AC-20 (named cadences) | No model change: labels over rules AC-21 already has. Closes the gap where the correct model reads as a missing feature. |
| prod-F13 | LOW | resolved | **AC-44** (zone clause); `## Test strategy` | A daily 09:00 repeat crossing DST keeps 09:00 — wall clock, not offset. |
| prod-F14 | LOW | **noted, no action** | — | The lens itself says *"no action for F-005"*: `MANIFEST market_context` is empty and no `specs/_shared/non-functional-req.md` exists. Both are project-level artifacts outside this spec's write scope. Named here so the absence of a row is not read as an oversight. |

### design — 3 HIGH · 8 MED · 1 LOW

| id | sev | disposition | where it landed | reasoning |
|---|---|---|---|---|
| D1 | HIGH | resolved | **AC-45** (new); AC-1 sub-bullets; `## Impact` §9, §13 | Convergence 6. Both sub-findings answered too: the activation gesture is named as distinct from inline rename, and *message → detail is two actions*, stated so the two claims are not later read as one. |
| D2 | HIGH | resolved | AC-1 (restated) | Restated as a reachability-and-visibility bound over **user-settable** fields; `due_all_day` moved out of the settable set, which is the sharpest case the lens named. Also closes T11. |
| D3 | HIGH | resolved | AC-3 (control classes) | Five classes enumerated, including the two with no answer at all in revision 1 — a step list mid-move and an uncommitted repeat preview. |
| D4 | MED | resolved | AC-2 (aggregate failure); AC-33's 4.1.3 | One message naming the failed fields; each field keeps its own value and its own retry. The build the lens predicted — one announcement per failure — is ruled out by name. |
| D5 | MED | resolved | AC-2 (save model); AC-20 | The repeat picker is the one preview-then-commit control, and AC-22/23/25's messages render inside it. Also closes T9. |
| D6 | MED | resolved | AC-22 | Same fix as prod-F8. |
| D7 | MED | resolved | AC-12 (date-only path) | Without it AC-13's protected state is unreachable by the user and the implementer ships the original product's exact defect. |
| D8 | MED | resolved | AC-45 (loading clause); AC-4 (exit clause, no Retry) | Two halves of one gap: a surface that has not read the task must not look like a task with no values, and a terminal *"it's gone"* state must not offer the one action that cannot work. |
| D9 | MED | resolved | AC-9 (colour dropped, shape kept); `## Impact` §8; OQ5 | The shape is worth inheriting; the colour is spent — `DESIGN.md` gives amber to *open question*, and every dated open row in the live store is overdue. This is the finding the lens most wanted the owner to see, so it is in the Impact section and in an open question, not only in the AC. |
| D10 | MED | resolved | AC-16 (move mode) | Five states plus the per-move announcement plus the two conditional cases AC-15 already fixes. Named here so the accessible path is not built last and worst. |
| D11 | MED | resolved | AC-30 (two controls) | Two controls, not one that interrogates sometimes. The catalogue has no vocabulary for a pre-action question and this spec twice cites the rule that an action with an undo does not need one. |
| D12 | LOW | resolved | dissolved by AC-38; AC-11's disclaimer requirement removed | The owner's answer removes the permanent-disclaimer requirement entirely, so the transient-family problem does not arise. |
| *(the lens's own arithmetic: ~48 states implied, ~20 named)* | — | resolved in part, **deliberately** | AC-2, AC-4, AC-16, AC-20, AC-30, AC-45 | Revision 2 closes the ones that were **decisions** (containment, commit model, loading, failure scope, reorder shape, delete control count) and leaves the **drawings** to design-agent. `## Impact` §8 records both halves and the split. Closing the drawings here would have design-agent reviewing a design system this spec wrote moments earlier. |

## Two things this revision did NOT do, and why

- **It did not shrink scope.** The product lens re-derived the requirements independently
  from `## Purpose` and the owner's quoted request *before* reading the spec, produced 16
  requirements, and found **nothing in the spec absent from its own list** — so *"too big"*
  was not available as a finding, and closing findings by deletion would have been closing
  them by removing the evidence. The spec is longer than revision 1, as expected.
- **It did not re-open the collection-model decisions it sits on**
  (`owner-decision-2026-08-18-four-buckets.md`, `…-inbox-is-unfiled.md`,
  `…-upcoming-create.md`, `ADR-009 § Amendment 2`). Where a finding touched them — arch-F3's
  Today-vs-Upcoming, arch-F12's INV-INBOX-FILING — the spec was changed to agree with them,
  not the other way round.

## Left for the owner

Six open questions carried forward, sharpened where round 1 gave a sharper framing
(**OQ 1, 3, 4, 5, 6, 10**), and **two new ones**:

- **OQ 11 — new, and it is a composition of two owner answers rather than a lens finding.**
  Voice can set a reminder (answer 3) and voice runs on both clients; passed reminders are
  shown on open (answer 1). If that second half is web-only, a phone user sets a reminder
  the app never mentions again — the write-only data path answer 1 exists to close, rebuilt
  on the other client. The spec **takes a default** (AC-38 carries `(web, mobile)` as a
  bound, not a drawn surface) and names the alternative, so the pipeline is not blocked on it.
- **OQ 12 — new, from prod-F9.** Whether a task with a note should show anything in the list.
  The prohibition stands for now on the source product's own removal decision; the false
  market claim that also supported it has been withdrawn.

**Retired ids: OQ2, OQ7, OQ8, OQ9** — answered by the owner, removed from the spec, and not
reused.

---

## Addendum — T-153, folded in after this log was written, before round 2 reads it

**Written by the orchestrator**, which owns `reports/`. It exists because the log
above describes 46 ACs and the spec now has 48: a round-2 lens reading only the
log would review a shape that no longer exists.

**Not a revision 3.** The round cap is 2. A change folded in now is reviewed; the
same change made after round 2 would ship unreviewed. That is why these landed
here rather than waiting.

**Source:** `reports/owner-decision-2026-08-18-detail-trap-and-message-door.md`.
Both were **found in composition** — each of the ACs involved had already been
reviewed and each is correct alone. Neither was a lens finding, and neither could
have been: review is per-artifact, composition is between artifacts
(`LEARNINGS.md` **L-015**, and its second-occurrence note).

| Change | What it is |
|---|---|
| **AC-2**, fourth sub-bullet, **narrowed** | The revision-2 wording — *"the surface does not close while a write is unresolved"* — is kept verbatim with its product-F10 reasoning, marked correct against the case it was looking at, and overruled by the case it was not: **an outage fails the write and the turn at once**, so the detail holds the column while F-001 AC-24 promises the list is one action away. Closing is now always available. The two states revision 2 collapsed are separated: a write **in flight** (closing is honoured at once, the write resolves against the stored task) and a write that has **failed** (value and failure move into AC-47). |
| **AC-47** (web), new | The notice that outlives the detail: carries the user's value, names task and field, offers *the same* retry as the in-surface one (one retry path, two doors — L-005), does not self-dismiss, one per task not per field, joins AC-33's 4.1.3 list. Two boundaries stated rather than discovered: a failure caused by the task being **gone** produces no notice (AC-4 forbids retry there, and a notice offering one would be a resurrection door), and durability across reload stays **OQ6** rather than being settled here. |
| **AC-48** (web), new | What the surface does when the door changes its **subject**. F-001 AC-31 + F-005 AC-2 + AC-3 settle the route and the saving and leave exactly one thing open: whether a focused control blocks an arriving *subject*. AC-3's exception is written about an arriving *value* and calls itself absolute, so an implementer reading only AC-3 answers the opposite way. AC-48 also states that an **uncommitted repeat preview is discarded rather than committed** — committing it is the undisclosed commit AC-22/23/25 exist to forbid. |
| **AC-45** sub-bullet | The closing action is now unconditional, since the owner narrowed AC-2 rather than AC-24's condition. |
| **F-001 AC-31, AC-24** | Revision 6. AC-31's route enumeration gains the detail-open entry (swap); its postcondition is unamended and is met by the detail *being* that task. Below the split the case does not arise, and that is now stated so the absence reads as considered. F-001 OQ10 and OQ11 are closed against the decision, kept not deleted. |

**Consequential edits, so the spec does not contradict itself:** the User Flow
flowchart node, `## Impact` §13 (both halves now discharged), `## Ops` counters,
`## Test strategy`, `## Out of Scope`'s *considered and rejected* list (the hold
is now a rejected option, reversed with date and reason), and the revision-2
decision summary. **A decision restated in five places has to be narrowed in five
places** — the flowchart is the one a downstream agent reads fastest.

## What this leaves owed, recorded here because round 2 will ask

**Design** — the outliving-notice family does not exist as a component: placement,
wording, accessible name and testids, the 4.1.3 announcement path, and the
no-self-dismiss rule. A deliberate call is owed on whether it shares a family with
**AC-38**'s passed-reminder-on-open, which is the only other obligation in F-005
that renders outside a surface's lifetime. Also `information-architecture.md` §3's
route table, whose last row — *"at or above it, the centre list only scrolls"* —
is now incomplete and is cited by F-001 AC-31. Tracked as **T-152**.

**QA (web tier)** — AC-47 across a surface teardown, with the AC-4 absence case;
AC-48's swap-with-edit-in-flight, with the preview-discard asserted **directly**
rather than inferred; the swap-with-failing-save, which exercises both owner
answers at once; AC-2's two closing states; F-001 AC-31's swap route and its
unchanged below-split route; and the composed outage case for F-001 AC-24 — turn
fails and write fails together, one action still available. The last of these is
the one no existing test could have caught: **F-001 AC-24's reachability half has
zero assertions today** (**T-150**).
