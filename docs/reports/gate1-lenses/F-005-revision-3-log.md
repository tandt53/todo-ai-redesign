# F-005 — revision 3 log: what happened to every round-2 finding

**Date:** 2026-08-18 · **Task:** T-154 · **Agent:** spec-agent
**Reads against:** `docs/reports/gate1-lenses/F-005-r2-consolidated.md` and **all nine** persisted
lens returns beside it (L-009 — five of the sharpest findings this round were seen by one
lens only, and three of those are in the three lenses that did not exist in round 1), plus
`docs/reports/owner-decision-2026-08-18-round-three-and-offline.md` (two answers, both binding).

**This file determines the targeted re-review's dispatch set.** T-155 re-reads only the ACs
a lens raised findings on, per lens — so the **exact AC ids** in each row are load-bearing in
a way the round-2 log's were not. Ids are namespaced by lens, because five lenses number
findings from `F1` or `M1`.

## Counts

| | HIGH | MED | LOW | total |
|---|---|---|---|---|
| Round 2, per the nine lens returns | 40 | 44 | 15 | **99** |
| `resolved` | 39 | 42 | 14 | **95** |
| `resolved in part` (the residue is a dependency on another spec, or an owner question) | 1 | 1 | 0 | **2** |
| `deferred to an open question` (with the AC clause that names the cost) | 0 | 1 | 1 | **2** |
| `rejected` | 0 | 0 | 0 | 0 |

**Every HIGH is closed by amending an existing AC, `## Impact`, `## API Touch Points`,
`## Data`, `## Test strategy` or `## Open Questions`.** The two `resolved in part` rows are
**dev-web H3** (the spec states the collision and its recommendation; the amendment is F-001's
to make) and **product P8** (AC-43's half is closed in the AC; the rest wants a project-level
non-functional baseline that does not exist). The two `deferred` rows are **product P4** and
**P10** — both product decisions with a user-visible cost, each with the cost stated in the AC
and the question put to the owner rather than answered here.

## The constraint, and whether it held

The owner waived the round cap once, and made the waiver conditional: **amend existing
acceptance criteria only; add none.** It held — **48 ACs before, 48 after, nothing
renumbered, nothing deleted, nothing added.**

**No finding required a new AC**, and this is the check rather than an assertion: the four
that came closest each had an existing home the round-2 lens itself named.

| Finding | Would have been an AC | Why an amendment is not a dodge |
|---|---|---|
| **tester T22** — the seed path | "an AC, **or** a `## API Touch Points` entry" — the lens's own directive | It is now an API Touch Points obligation naming what it must construct, **bound into AC-8, AC-15 and AC-34** so each has a falsifiable precondition rather than a wish. A new AC would have said the same thing to the same reader (architect writes contracts from that section). |
| **dev-backend F1** — the turn path has no refusal outcome | a new AC stating the outcome | AC-36 already owns *"refused with a visible outcome"*; what was missing was the outcome, which is a clause. The **wording is F-002's**, so the residue is a dependency, not an AC. |
| **product P2 / tester M5** — mobile accessibility | a mobile a11y AC | AC-33 is the accessibility AC. It gains `(mobile)` and names `F-003 AC-9` / `AC-12` as its counterparts. A second a11y AC is exactly the two-doors shape L-005 warns about. |
| **product P4** — undo depth | an AC bounding recovery | The **bound is a product decision the owner has not been given**, so it is `## Open Questions` **OQ13** with AC-41 naming the cost — the disposal the ethos requires, not an invented answer. |

## The owner's second answer — where it landed

| Answer | Landed in | Closed |
|---|---|---|
| **An offline field edit is refused, with the user's value kept on screen and the reason stated. No queue, no durable store, no replay.** | **AC-2's third state** (a write that is *never attempted* — the state its two existing states could not reach); the User Flow flowchart gains the branch; `## Users & Permissions`; `## Out of Scope` (offline editing is now a **decision**, with queue-and-replay recorded as rejected and why); `## Ops` counts refused-offline writes; `## Test strategy` gains the per-client case | **OQ6**, kept and marked closed rather than deleted |
| The same answer settles **AC-47's reload half** | AC-47: the notice **does not survive a reload** — there is nothing durable to carry across one — and the "durability is OQ6" bullet is retired | product **P7** |

**The premise correction is part of the answer and is recorded in the spec, not only here.**
OQ6 asked whether an offline edit is *kept and sent later, or lost*, and the spec said AC-2
already defined the behaviour with only durability open. It did not: `toggleTask`, `editTask`
and `removeTask` all **return before attempting anything** while offline and `persistLocal()`
saves only locally-created rows, so the edit was **never sent, never queued, and silently
replaced at the next refresh**. There was no pending edit whose durability was in question.

## Four round-2 dispositions of the *round-1* log that did not land, plus one that could not

Recorded because this log is also a correction of the previous one.

| Round-1 finding | Logged | Actually | Now |
|---|---|---|---|
| **T22** (seed path) | `resolved` | a `## Test strategy` sentence: no AC, no endpoint, no mechanism, no owner — **the same shape revision 2 refused for AC-41** | `## API Touch Points` obligation + clauses in AC-8, AC-15, AC-34 |
| **T23 / dev-F8 / prod-F13** (clock seam) | `resolved` | the zone travels **only** with a turn while every computation is triggered by a task write; the client seam was said not to exist and does; the AC asserted the seam, not the outcome | **AC-44 inverted and rewritten** |
| **T19** (refusal outcome) | `resolved` | *"writes nothing"* never said per-field or per-write | AC-18's scope clause + AC-40's named turn-path observable |
| **T17** (undo defined) | `resolved` | AC-43's coverage list omitted **AC-30's series delete**, which AC-30 had already spent its confirmation dialog against | AC-43 coverage + AC-30 clause + AC-41's restore unit |
| **D9** (the amber collision) | `resolved` | **true as an edit, unexecutable as an outcome** — "pick an accent from unspent tokens" names an empty set, repeated in three places so every reader believed it solved | AC-9, `## Impact` §8 and OQ5 all three: **carried without colour**, or a new token added to the system first; the row's three-mark budget stated once |
| **dev-web L2** (dev-F8's second half) | credited whole | AC-15's pointer reorder and AC-16's keyboard half had no tier assignment | `## Test strategy` assigns them |

## The ten convergences — resolved at every site each finding names

| # | Convergence | Lenses | Sites fixed |
|---|---|---|---|
| 1 | The clock and the zone | **6** | **AC-44 rewritten** (outcome-first; both seams drivable and held at one instant; the client seam exists and is widened not duplicated; the zone is one stored `timezone` on the account read by every write path, absence refused; `(mobile)` added) · AC-13 (the zone answer, and the server owns the absent-flag read) · `## API Touch Points` · `## Data` (`timezone`) · `## Test strategy` |
| 2 | Close-then-fail | 3 | **AC-47's trigger widened** to *fails at any point after being started on this detail* · AC-2's in-flight bullet says what a post-close failure does · the flowchart gains the edge · `## Test strategy` gains the case (revision 2 tested fail-then-close only) |
| 3 | The multi-row write, both halves | 4 | AC-26: **rule, not a list** (four more writes qualify) **and a receiver obligation** — the client applies every row a write returns · AC-2's mobile bullet · AC-39's mobile fixture (it was vacuously true on the phone) · `## API Touch Points`, including the **false premise** about the blind `GET` |
| 4 | `reminder_shown_at` | 4 | AC-10 (cleared when `reminder_at` is written or cleared) · AC-27 (never inherited by a successor) · AC-38 (**written on acknowledgement, not on render**) · `## Data` row rewritten |
| 5 | Accessibility falls off the mobile edge | 5 | **AC-33 `(web, mobile)`**, 4.1.3 restated as a **rule**, **2.2.1 Timing Adjustable** named, `F-003 AC-9`/`AC-12` named as the mobile counterparts and the `announce.ts` path named as needing widening · AC-43's mobile bullet · AC-36's refusal verified on web |
| 6 | "A live series" is undefined | 3 | **AC-25 defines it** (`series_live`: repeat still set **and** not ended; never `series_id`) · AC-39's negative case · AC-30 cites it · `## Data` row |
| 7 | Offline is uncovered, and §1's list is short | 3 | **AC-2's third state** (owner) · `## Impact` §1 gains the **fifteenth** list (`pushLocalTasks`) and the **sixteenth** site (`ContextTask`), and re-files `NewTaskFields` as gating · AC-13 (third writer of a bare midnight) · AC-14 (the offline create door) |
| 8 | AC-38's "when the app opens" is two doors | 2 | AC-38: the obligation attaches to the **transition** through the single installer, `init()` **and** `onForeground()`, with the offline open surfacing and writing nothing · `## Test strategy` requires one structurally distinct case per door (L-005's own remedy) |
| 9 | AC-46's undo record | 2 | AC-46: the touched-row set is computed **before** capture; a turn-caused row is reverted **only under AC-28's five conditions**; it joins the undo record and **not** the message anatomy · AC-28 · §9 routes the three contract documents |
| 10 | AC-41's restore has no membership rule | 3 | AC-41: **the delete records its own membership** (`delete_membership`) and the restore replays exactly that set; the unit follows the gesture, including AC-30's series · AC-30 · AC-43's coverage · `## Data` · `## API Touch Points` |

---

## Every finding, by lens

`resolved` = traceable to changed spec text, named in the *where* column. **`acs touched` is
what T-155 re-reads.**

### tester (api) — 8 HIGH · 5 MED · 2 LOW

| id | sev | acs touched | disposition | where it landed |
|---|---|---|---|---|
| T17 | HIGH | AC-30, AC-41, AC-43 | resolved | AC-43's coverage list gains the series delete; AC-30 gains the undo-and-unit clause; AC-41 states the restore **unit** per gesture; `## API Touch Points` restore bullet |
| T18 | HIGH | AC-46, AC-28, AC-26 | resolved | AC-46's second sub-bullet **picks one of the three citable answers**: a turn-caused row is reverted only if still removable under AC-28, else it stays and is named in the reverted turn's message (F-001 AC-7's existing behaviour) |
| T19 | HIGH | AC-18, AC-36, AC-40 | resolved | AC-18: the refusal's scope is **the whole write** — nothing written, not in `changed_task_ids`, no diff; AC-40 replaces *"identically to the HTTP path"* with the named turn-path observable |
| T20 | HIGH | AC-38, AC-27, AC-10 | resolved | AC-10 (cleared on any write or clear of `reminder_at`); AC-27 (never inherited); `## Data` row; AC-38's acknowledgement rule |
| T21 | HIGH | AC-38 | resolved | **AC-38 → `(api, web, mobile)`**; the **server** writes the marker on an acknowledgement the client sends; `## API Touch Points` names the write |
| T22 | HIGH | AC-8, AC-15, AC-34 | resolved | `## API Touch Points` **seed-path obligation** naming all three constructions; AC-8, AC-34 sub-bullets; AC-15's restart inside the API entry. *Promoted from prose exactly as AC-41 was, and for the reason this lens gave.* |
| T23 | HIGH | AC-44, AC-13, AC-22, AC-23, AC-24, AC-26, AC-27 | resolved | AC-44's zone clause (**a stored account attribute read on every path**, absence refused rather than defaulted); AC-13 says which side owns the all-day read; `## API Touch Points`; `## Data` |
| T24 | HIGH | AC-25, AC-39 | resolved | AC-25 defines a live series as `series_live`; AC-39 gains the **negative case** (repeat cleared, series ended → no mark) |
| T25 | MED | AC-26, AC-28, AC-30 | resolved | AC-26: **at most one successor per occurrence, idempotent on re-completion**; *"no path generates a second"* replaced |
| T26 | MED | AC-25, AC-28 | resolved | AC-25: the count is **distinct occurrences completed at least once** — un-completing does not un-count, re-completing does not double-count |
| T27 | MED | AC-15, AC-26, AC-43 | resolved | AC-15: **a move is one write** (sparse/fractional positions), or one request returning every row it changed and undone as one unit; AC-26's rule covers the latter |
| T28 | MED | AC-43, AC-47, AC-48 | resolved | AC-43: a surface teardown is **not** an ender; AC-47 says where the offer renders; AC-48's settle list names it |
| T29 | MED | AC-33, AC-38, AC-40, AC-47 | resolved | AC-33's 4.1.3 becomes **a rule**: every refusal and every status message this spec states is announced |
| T30 | LOW | AC-34 | resolved | Both references qualified as **F-001** AC-12 — in AC-34 and in `## Impact` §4 |
| T31 | LOW | AC-41 | resolved | A restore aimed at a live row is **a no-op that says so** (not 404, not 409) |

### tester (web) — 4 HIGH · 9 MED · 2 LOW

| id | sev | acs touched | disposition | where it landed |
|---|---|---|---|---|
| W1 | HIGH | AC-2, AC-47 | resolved | Convergence 2 — AC-47's trigger widened; AC-2's in-flight bullet |
| W2 | HIGH | AC-3 | resolved | The both-pending clause **rewritten as a precedence rule with one observable**: the user's edit always reaches the store, the control always displays what the store holds, the cue fires when the display changes. Revision 2's two-sided guarantee is half-withdrawn, with the reason |
| W3 | HIGH | AC-47, AC-3, AC-36 | resolved | AC-47: **a later successful write supersedes whoever made it, and a supersede by a turn is announced rather than silent**; what a reopened field shows in each case |
| W4 | HIGH | AC-44, AC-12, AC-13, AC-23, AC-25, AC-38 | resolved | AC-44: **both seams are settable by the harness and held at one instant and zone for a run**, with the client mechanism named beside `/__qa__/advance-clock` |
| W5 | MED | AC-1 | resolved | AC-1 names the account ("the accessible enumeration of its own controls") and gives reaching a field **an action budget of one** |
| W6 | MED | AC-25, AC-30, AC-39 | resolved | Convergence 6 |
| W7 | MED | AC-38 | resolved | AC-38 gains all three: no self-retirement (acknowledgement), aggregation for N, and who writes the marker and when |
| W8 | MED | AC-43 | resolved | AC-43: **it does not elapse.** The unmeasurable "floor on the duration" is gone; 2.2.1 named in AC-33 |
| W9 | MED | AC-47, AC-4, AC-31, AC-42 | resolved | Deletion of the task is an **ender** of an outstanding notice (AC-47), and AC-4 states it from the other side |
| W10 | MED | AC-45 | resolved | The runtime observable: **crossing the split changes nothing about what the detail holds** |
| W11 | MED | AC-13 | resolved | AC-13: **the stored instant does not change**; the flag and the formatter do. `## Impact` §10 names the two ADR-009-citing assertions, §9 routes ADR-009 §4 |
| W12 | MED | AC-33, AC-36, AC-38, AC-40, AC-47 | resolved | Convergence 5 |
| W13 | LOW | AC-16 | resolved | The `cancelled` state gains its trigger and its restore-and-announce outcome |
| W14 | LOW | AC-7, AC-9, AC-17, AC-39 | resolved | `## Test strategy`: the AC-7 differential must hold the row equal against **three** mutations, AC-39 included |
| W15 | MED | AC-8, AC-9, AC-33 | resolved | AC-9: `none` never marks, `high` always does, `low`/`medium` are design's within the one-glyph vocabulary (OQ5); **all four are distinguished in the accessible name** |

### tester (mobile) — 5 HIGH · 4 MED · 1 LOW

| id | sev | acs touched | disposition | where it landed |
|---|---|---|---|---|
| M1 | HIGH | AC-9, AC-36, AC-38 | resolved | `## Impact` §7 gains the **fifth leak row**; **AC-9 → `(web, mobile)`** as a bound; **OQ11 widened** to carry priority as its second instance |
| M2 | HIGH | AC-2 | resolved | AC-2's mobile bullet states the **post-state** of a failed row write; *"did not regress"* withdrawn as untestable |
| M3 | HIGH | AC-2, AC-26, AC-39 | resolved | The receiver obligation (AC-2, AC-26) and AC-39's positive mobile fixture that does not depend on the phone generating the successor |
| M4 | HIGH | AC-38 | resolved | Convergence 8 — both doors, the single installer, the offline open, one structurally distinct test per door |
| M5 | HIGH | AC-33, AC-42, AC-43 | resolved | Convergence 5 — AC-33 `(mobile)` with `F-003 AC-9`/`AC-12` named; AC-43's mobile bullet names the `announce.ts` path and rules out `assistant-undo-button` |
| M6 | MED | AC-13, AC-44 | resolved | AC-13's zone; **AC-44 → `(api, web, mobile)`** with the two mobile inline sites named |
| M7 | MED | AC-19, AC-35 | resolved | `## Test strategy`: AC-19's mobile case is **composed** — mobile tick, api read-back, mobile assertion — or it is AC-35's case wearing AC-19's name |
| M8 | MED | AC-18, AC-19, AC-35, AC-41 | resolved | AC-35 names the **one construction path** for the steps-only state, and the alternative (derive the three readers from `collectionTasks`) if even that is unreachable |
| M9 | MED | AC-39, AC-42, AC-43 | resolved | `## Impact` §8 and AC-9/AC-39/AC-43: the mobile ids are owed to **F-003's closed catalogue**, not invented |
| M10 | LOW | AC-38, AC-39, AC-42, AC-43 | resolved | `## Test strategy` makes the node/device-lab split and points the device half at F-003's existing debt list |

### dev (backend) — 5 HIGH · 2 MED · 1 LOW

| id | sev | acs touched | disposition | where it landed |
|---|---|---|---|---|
| dev-backend F1 | HIGH | AC-36, AC-40, AC-18 | resolved *(with an F-002 dependency)* | AC-36: **a refused turn is its own outcome**, wording owned by F-002; AC-40's observable; `## Impact` §3 corrected — its "no new SPK-* row" finding covered the **permitted** half only; `## API Touch Points` |
| dev-backend F2 | HIGH | AC-44 (+AC-13, AC-22–AC-27) | resolved | Convergence 1 — the zone at all four doors |
| dev-backend F3 | HIGH | AC-2, AC-3, AC-26, AC-39 | resolved | Convergence 3, including the **false premise** in `## API Touch Points` about the blind `GET` |
| dev-backend F4 | HIGH | AC-36, AC-40 | resolved | `## Impact` §1: `NewTaskFields` re-filed as the **turn-path create allowlist** (a gating list, so six not five) and `ContextTask` added as the read side; AC-36 requires a fixture row per permitted field **on the create path** and puts note/reminder into the model's context |
| dev-backend F5 | HIGH | AC-41, AC-15, AC-19 | resolved | Convergence 10 — `delete_membership` |
| dev-backend F6 | MED | AC-46 | resolved | AC-46: the row joins the **undo record** and not the message anatomy, so a voice "done" never renders step titles the user has not seen |
| dev-backend F7 | MED | AC-2, AC-42, AC-43 | resolved | AC-42: the undo follows the **write's result**; a failed row delete is AC-2's failed-write case, not an undo case |
| dev-backend F8 | LOW | — (`## Impact` §12, §5) | resolved | §12 narrowed (plain text **deliberately**, not an inert control); the account figure corrected to **190** in §5 and AC-35 |

### dev (web) — 4 HIGH · 3 MED · 3 LOW

| id | sev | acs touched | disposition | where it landed |
|---|---|---|---|---|
| dev-web H1 | HIGH | AC-2 (OQ6) | resolved **by the owner** | AC-2's third state; OQ6 closed with its premise corrected; `## Out of Scope` |
| dev-web H2 | HIGH | AC-47, AC-3 | resolved | AC-47's supersession rule (see W3) |
| dev-web H3 | HIGH | AC-48 (+ F-001 AC-31) | **resolved in part** | **`## Impact` §14 (new subsection)** states the collision, both costed options and this spec's recommendation; AC-48 carries it as a **dependency**. The amendment is F-001's to make — routed to the orchestrator, exactly as §13 was |
| dev-web H4 | HIGH | AC-13, AC-14 (+ `## Impact` §1) | resolved | §1's **fifteenth** closed list, with why "a missed field is `undefined`" does not reach a replay projection |
| dev-web M1 | MED | AC-44 | resolved | AC-44: the client seam **exists** (`ControllerDeps.now`), five inline sites not three, eight defaulted `now` parameters; widen, never duplicate |
| dev-web M2 | MED | AC-44 | resolved | Convergence 1 |
| dev-web M3 | MED | AC-47 | resolved | AC-47 names **where the mechanism lives** — shared code, which mobile compiles: a fifth instance of §7's table |
| dev-web L1 | LOW | AC-45 | resolved | AC-45: **F-001 AC-32 is not in force while the detail is open**; only AC-3 keeps a subject |
| dev-web L2 | LOW | AC-15, AC-16 | resolved | `## Test strategy` assigns the pointer reorder to web e2e and AC-16's move mode to the unit tier |
| dev-web L3 | LOW | — (`## Impact` §1) | resolved | Citation corrected to `_shared/controller.ts:673` |

### dev (mobile) — 5 HIGH · 4 MED · 1 LOW

| id | sev | acs touched | disposition | where it landed |
|---|---|---|---|---|
| dev-mobile F1 | HIGH | AC-38 | resolved | Convergence 8, including **an offline open cannot write the marker** |
| dev-mobile F2 | HIGH | AC-2, AC-19, AC-26 | resolved | AC-2's third state and receiver clause; AC-26's "no path generates none" reconciled (there is no completion) |
| dev-mobile F3 | HIGH | AC-33, AC-42, AC-43 | resolved | Convergence 5 and AC-43's mobile bullet, including **offline the undo cannot run at all** |
| dev-mobile F4 | HIGH | AC-2 | resolved | AC-2's mobile bullet: **the phone's gap is one level earlier than the close** — there is no field, and `§ SaveNotice` is the reserved home |
| dev-mobile F5 | HIGH | AC-13, AC-14 | resolved | The third writer of a bare local midnight; `api-contracts.md § Creating a task in a collection` routed in §9 |
| dev-mobile F6 | MED | AC-25, AC-39 | resolved | Convergence 6; and AC-39/AC-9's mobile home is **F-003**, so "no spec" is true of web only |
| dev-mobile F7 | MED | — (`## Impact` §7, §9) | resolved | §7 now says D8's **definition block** is still stale while its rows are corrected; §9 routes it. §7 and §9 no longer contradict each other |
| dev-mobile F8 | MED | AC-47 | resolved | AC-47's "the family does not exist" corrected — `§ SaveNotice` exists, is persistent and dismissible, has two reserved mobile ids, and already reasons the no-self-dismiss rule |
| dev-mobile F9 | MED | AC-44 | resolved | Both false claims corrected (see dev-web M1); `(mobile)` added |
| dev-mobile F10 | LOW | AC-2 | resolved | The `api-contracts.md:353-358` over-cite corrected — it covers `toggleTask` only |

### architect — 4 HIGH · 6 MED · 1 LOW

| id | sev | acs touched | disposition | where it landed |
|---|---|---|---|---|
| arch F1 | HIGH | AC-26, AC-15, AC-19, AC-28, AC-30, AC-41 | resolved | Convergence 3 — the enumeration becomes a rule and the four missing writes are named |
| arch F2 | HIGH | AC-46 | resolved | **The capture ordering is stated**: the write plans the rows it will touch, records them, then applies. §9 routes `data-model.md § assistant_turn`, `POST /assistant/turn` rule 6 and the undo endpoint's *Revert shapes*. *(One of the two the lens said nothing downstream could catch.)* |
| arch F3 | HIGH | AC-46, AC-28 | resolved | Undo obeys **AC-28's five conditions**, so it cannot hard-delete a successor whose steps the user has worked on |
| arch F4 | HIGH | AC-2, AC-47 | resolved | Convergence 2. *(The other of the two nothing downstream could catch.)* |
| arch F5 | MED | AC-21 | resolved | A recurrence change is reported in the diff **as scalar fields**, so `turn.diff`'s declared shape and F-001 AC-4's rendering are unaffected |
| arch F6 | MED | AC-10, AC-27, AC-38 | resolved | Convergence 4 |
| arch F7 | MED | AC-15, AC-43 | resolved | AC-15: the undo replays the **prior position the move's own response carried** — no new record, and this is not the case AC-15 rules out (that one is a restore after delete) |
| arch F8 | MED | AC-8 | resolved | **`none` is the absence of a stored value**, which is what makes `Required: yes` and the migration-free claim true together; `## Data` validation cell |
| arch F9 | MED | AC-48 | resolved | The headline no longer says *settled before* — the swap does not block on an in-flight write |
| arch F10 | MED | AC-14 | resolved | The offline create door carries `parent_id` **and** the position, and the server preserves a supplied one |
| arch L1 | LOW | AC-28 | resolved | *"Removes the successor"* is a **hard** removal — the one exception to every-delete-is-soft, stated |

### design — 3 HIGH · 4 MED · 1 LOW

| id | sev | acs touched | disposition | where it landed |
|---|---|---|---|---|
| D13 | HIGH | AC-2, AC-47 | resolved | Convergence 2 |
| D14 | HIGH | AC-9, AC-33, AC-39, AC-43 | resolved | **All three sites** — AC-9, `## Impact` §8, OQ5: carried **without colour**, or a new accent token added to the system first; and the **three simultaneous mark meanings** stated in one place so the row's mark budget is one decision |
| D15 | HIGH | AC-2, AC-45, AC-47 | resolved | AC-47: **reachable from wherever the user is** — the reading that makes AC-2's promise true — with `§ SaveNotice`'s clearing rule named as the thing not to follow, plus the N-tasks and above-the-split states bounded |
| D16 | MED | AC-38 | resolved | Render is not resolution; the below-split Talk landing routed to `§ LandingSummary`; the shared-family question stated as **one** decision with the opposite lifetimes named |
| D17 | MED | AC-9, AC-39 (+ §8) | resolved | §8 names **three** marks, the `(web)`/`(web, mobile)` asymmetry, and Done's rows keep the repeat mark (AC-39) |
| D18 | MED | AC-45 | resolved | **Three edges**, the two IA navigations answered (**the detail is not preserved**), §9 routes IA §4 and §6 |
| D19 | MED | AC-43 | resolved | The no-elapse rule, and **one word for this mechanism added to `§ Buttons`' table before the screens are drawn** — design's word, this spec's requirement |
| D20 | LOW | AC-4, AC-47 | resolved | Deletion after the notice exists is an ender (see W9) |

### product — 2 HIGH · 7 MED · 3 LOW

| id | sev | acs touched | disposition | where it landed |
|---|---|---|---|---|
| P1 | HIGH | AC-38, AC-47 | resolved | **`reminder_shown_at` is written on acknowledgement**, and the surfacing ends on completion, deletion or a changed reminder — AC-47's resolution triple applied to its own named sibling |
| P2 | HIGH | AC-33, AC-38, AC-42, AC-43 | resolved | Convergence 5 — AC-33 `(mobile)`, with the mobile criteria named rather than re-derived |
| P3 | MED | AC-38 | resolved | One surfacing for N reminders, oldest first, and only what is acknowledged is marked |
| P4 | MED | AC-41, AC-43 | **deferred to OQ13** | AC-41 states the cost as an outcome (**depth of one**, permanent loss reachable in two gestures); **OQ13** puts the depth to the owner. No trash surface proposed |
| P5 | MED | AC-44 | resolved | **AC-44 inverted**: the DST and zone outcomes are the assertion, the seam is the how |
| P6 | MED | AC-48 | resolved | The discarded preview is **announced**, under AC-33's 4.1.3 |
| P7 | MED | AC-47 (OQ6) | resolved **by the owner** | The notice does not survive a reload; OQ6 closed, so nothing is blocked on it |
| P8 | MED | AC-1, AC-32, AC-38, AC-43 | **resolved in part + OQ15** | AC-43's unmeasurable floor is replaced by *it does not elapse*. The other three want a **project** non-functional baseline that does not exist — **OQ15**, rather than three invented numbers |
| P9 | MED | AC-33 | resolved | **2.2.1 Timing Adjustable** named — the criterion AC-43 and AC-47 both reasoned about without citing |
| P10 | LOW | AC-29 | **deferred to OQ14** | AC-29 states the cost of carry-forward-only; `## Out of Scope` records it; **OQ14** asks whether a scope prompt is wanted |
| P11 | LOW | AC-41 | resolved | The restore is scoped to the caller's own rows, in the AC and not only in the permissions table |
| P12 | LOW | AC-6, AC-14, AC-37 | resolved | Any bound is **stated and refused, never silently truncated or enforced** |

---

## What this revision did NOT do, and why

- **It did not add an acceptance criterion.** That was the condition of the waiver, and the
  four findings that came closest are in the table at the top with their homes named.
- **It did not shrink or re-derive scope.** The product lens re-derived the requirements from
  `## Purpose` for the second time, matched 20 of 24, and found **nothing in the spec absent
  from its own list** — so "too big" was not available as a finding, and closing findings by
  deletion would be closing them by removing the evidence.
- **It did not re-open an owner decision.** Where a finding touched one — convergence 2 and
  architect F9 both land on the detail-trap answer — the finding is that the answer was
  implemented with **one door narrowed and the other left open**, which is the answer being
  completed rather than argued with.
- **It did not settle two questions that are the owner's.** OQ13 (how deep undo goes) and
  OQ14 (a per-occurrence edit scope) are product decisions with user-visible costs; each has
  a default stated in the AC so nothing is blocked.

## Left for the owner

**OQ6 closed.** Carried forward: **OQ1, 3, 4, 5, 10, 12** (unchanged in substance; OQ5's
remedy corrected). **OQ11 widened** — the same composition happens twice, for reminders and
now for priority, and one answer settles both. **Three new**, each a round-2 finding whose fix
is a decision rather than a clause:

- **OQ13** — the **depth** of "delete is undoable". The offer does not stack, so two gestures
  make the first deletion permanent while the row sits on disk with a working restore pointed
  at it. The owner decided the *door* symmetry; the depth was never put to them (product P4).
- **OQ14** — whether editing one occurrence of a repeat should offer *this occurrence only*.
  The default is carry-forward, unasked, and the cost is now stated in AC-29 (product P10).
- **OQ15** — whether this project wants a **non-functional baseline**. Across 48 ACs there is
  not one timing bound, three want one, and there is nothing to inherit (product P8).

## Two dependencies leaving this spec

Neither is F-005's to write, and both are named in the spec rather than left as notes:

1. **`F-001 AC-31`'s activatability gate** (`## Impact` §14, AC-48). `canReveal` renders a task
   outside the collection on screen as plain text, and the collection is one AC-45 puts on
   screen at no width — so the swap route is dead for the common case. Its own stated reason
   (*"an affordance that does nothing"*) does not survive a postcondition that needs nothing
   from the list. F-005's recommendation is in §14; the amendment is F-001's.
2. **F-002 owes the wording of a turn-path refusal** (AC-36, `## Impact` §3). `TurnOutcome` has
   six members and none is a refusal, and F-002's speech table is closed. Until it exists, the
   only reachable implementations are a lie, a false server error, or the silent drop AC-36
   and AC-18 both forbid.

## One tool defect, found while running the required check

`bash .claude/tools/spec-check/declared-elements.sh specs/assistant/F-005-task-detail.md`
**exits 1 and reports nine false orphans** — `title`, `note`, `priority`, `due_at`,
`due_all_day`, `reminder_at`, `parent_id`, `step_order`, `series_id`. Each of them is in fact
mentioned 5–32 times in the ACs. **The spec is not what fails; the checker is.**

The cause is exact and reproducible: the check tests `printf '%s' "$HAY_NORM" | grep -qF …`
under `set -o pipefail`. Once the haystack (the `## Acceptance Criteria` + `## Open Questions`
+ `## Out of Scope` sections, normalised) exceeds the **64 KB pipe buffer**, `grep -q` exits at
the *first* match and `printf` takes **SIGPIPE (141)**, which `pipefail` promotes to the
pipeline's status — so **the earlier a field appears, the more certainly it is reported
missing.** Fields whose first match happens to fall near the end of the haystack still pass,
which is why the failure list looks arbitrary.

Measured: a multi-line haystack of 64 KB returns 0 and one of 72 KB returns 141. Revision 2's
haystack was under the line (reconstructed and re-run: **exits 0, all 18 fields accounted**);
revision 3's is 118 KB, so this revision is what crossed it.

**The fix is one line** and it belongs to whoever owns `.claude/tools/` — not to this agent,
whose write scope is `{specs}/`:

```sh
# current — SIGPIPE + pipefail makes an early match look like an orphan
if printf '%s' "$HAY_NORM" | grep -qF "$(normalise "$field")"; then
# fix — no early exit, so no SIGPIPE
if printf '%s' "$HAY_NORM" | grep -cF "$(normalise "$field")" >/dev/null; then
```

**This is not only F-005's problem.** The same script is C13 at Gate 2, so **any** spec whose
AC section grows past ~64 KB will fail structural review with a list of fields it does in fact
constrain — and the failure mode is one a reader is likely to believe, because it names real
fields. Verified independently with a SIGPIPE-immune equivalent: **all 21 declared fields are
accounted for.**
