# F-005 — revision 4 log: what happened to every round-3 finding

**Date:** 2026-08-19 · **Task:** T-159 · **Agent:** spec-agent
**Reads against:** `reports/gate1-lenses/F-005-r3-consolidated.md` and **all nine** persisted
lens returns beside it (L-009 — several of this round's sharpest findings came with
measurements the consolidation compresses: row counts, line numbers, and one account walked
through three readers), plus `reports/owner-decision-2026-08-19-close-gate-one.md` (three
answers, all binding).

**There is no round 4.** The owner closed Gate 1 with this pass. That changes what this log
is for: the round-3 log determined a re-review's dispatch set, and this one is a **handover
to architect-agent** — the `disposition` column says whether a finding was *fixed here* or
*recorded for architecture*, and the recorded ones are the input to the next phase.

## Counts

| | HIGH | MED | LOW | total |
|---|---|---|---|---|
| Round 3, per the nine lens returns | 25 | 22 | 11 | **58** |
| `fixed` — the spec contradicted itself, another spec, or an owner decision | 20 | 16 | 9 | **45** |
| `recorded for architecture` — a mechanism this spec cannot state | 5 | 5 | 2 | **12** |
| `recorded as an open question` — a product choice (dev-backend F5 → **OQ16**) | 0 | 1 | 0 | **1** |
| `rejected` | 0 | 0 | 0 | **0** |
| | **25** | **22** | **11** | **58** |

**Every finding has a disposition and none is closed by a clause that cannot carry it.** The
twelve `recorded` rows are deliberate and they are the substance of the owner's split:
*"an unstated mechanism is what the architecture phase exists to state. Making spec-agent
invent answers means architect either inherits a guess or unpicks it."* Each is written into
`## API Touch Points` with the finding's own words about what is unknown — not paraphrased
into a decision.

## The constraint, and whether it held

Amend-only, third revision running: **48 ACs before, 48 after, contiguous 1–48, nothing
renumbered, nothing deleted, nothing added.** Verified mechanically
(`grep -c "^- \[ \] \*\*AC-"` = 48; the id list sorts to 1…48 with no gaps).

**No finding required a new AC**, and seven of nine lenses said so themselves before this pass
started. The one exception a lens named — dev (mobile) F3, where AC-2's mobile obligation was
closed by pointing at a `(web)` AC's rules and *"the pointer does not carry the rule across the
tag"* — is closed by **retagging AC-47 `(web, mobile)`**, which is the honest amendment the lens
asked for and is not a new AC.

`declared-elements.sh` exits **0** — and this time that is a real pass rather than a broken
checker's silence: the SIGPIPE defect L-016 records was fixed on 2026-08-18 (the script now
uses a shell `case` glob and no pipe), and it was re-run **before** this revision as well as
after, so a failure could have been attributed rather than assumed.

## The three owner answers — where each landed, and what followed automatically

| Answer | Landed in | Consequences that were not separate decisions |
|---|---|---|
| **1. The hand-action undo renders in AC-47's notice family, not on the row** | AC-43's *shape* bullet (the in-place sentence **withdrawn, not deleted**); AC-47's undo-offer bullet; AC-31 ("immediate undo", not "in-place"); AC-41's no-op bullet | **(a)** AC-43's enders gain the **reload** — that family does not survive one, so *"and by nothing else"* over three enders was false the moment placement was settled. **(b)** **OQ13 re-stated with both causes of permanent loss** — non-stacking *and* reload — because answering the depth question with one hidden is answering a different question. **(c)** The row's mark budget is **three without the undo**: AC-9's urgency, AC-17's step counter, AC-39's repeat indicator, stated as **one** list in AC-9, `## Impact` §8 and OQ5 |
| **2. Acknowledging is a deliberate per-reminder act on the surfacing** | AC-38's *what acknowledging is* sub-bullet (opening the task, scrolling past and rendering are each named as **not** it); the no-bulk-dismissal sub-bullet with the cost stated in the AC; `## Data`'s `reminder_shown_at` cell; `## Test strategy` | **AC-38's offline half changes**: an offline acknowledgement is **not recorded** and the reminder re-surfaces at the next open. Revision 3's *"recorded when connectivity returns"* is the queue-and-replay shape the OQ6 answer forbids **by name**, written into the same revision |
| **3. AC-2's third state is scoped to a server-owned row** | AC-2's third state and three new sub-bullets; the User Flow flowchart (the offline edge **splits**); `## Users & Permissions`; `## Out of Scope`; OQ6; `## Ops`; `## Test strategy` (a paired case for the locally-created row); the revision-3 summary sentence | The rule as written **removed working behaviour** (`persistLocal()` saves the edit, `pushLocalTasks` replays it) and its first arm fires **while online**. *"No queue, no durable store, no replay"* is restated as *no **new*** ones, because the store and the replay it denied **ship today** |

## The four withdrawn sentences, recorded rather than deleted

Every one is a new rule landing in one place while the sentence it replaces stayed standing —
the single most common shape in this round, and the one the owner's scoping note calls out.

| Sentence | Where it stood | Why it moved |
|---|---|---|
| *"never the stored value"* (AC-47 bullet 4) | four bullets below the supersession rule written to replace it, under a heading reading as the authoritative reconciliation | It was written when the user was the only writer of the field. AC-36 made the assistant a writer of all four and requires a fixture row per field |
| *"No affordance this feature adds is withdrawn by time alone"* (AC-33's 2.2.1) | in the AC the a11y cases are authored from, **quoting AC-43 as saying a sentence AC-43 no longer contains** | *Time alone* is satisfied by a five-second timer extended on focus — the exact reading tester W8 had already removed from AC-43 |
| *"and F-001 AC-32's non-stale list"* (AC-45's layout bullet) | four bullets above the bullet that withdraws it, in the bullet a reader stops at | With the detail in the list's column, the list is rendered at **no** width, and F-001 AC-24 rev 5 says AC-32 is conditional on the list being rendered |
| *"violating the invariant the whole recurrence section rests on"* (`## Impact` §4) | withdrawn by AC-26 in **revision 2** and still asserted here | A QA author reading §4 for AC-46's fixture writes an assertion that is **red on AC-28's own path** |

## The two amendments complete on one class and silent on the other

| AC | Governed | Covered | Now |
|---|---|---|---|
| **AC-46** | a row a turn *creates* **or changes** | only created rows — AC-28's five conditions **cannot be satisfied by a cascade-ticked step by construction** (no `series_id`, predates the turn, `updated_at !== created_at`), so **no cascaded step was ever reverted**, which is *exactly the defect `## Impact` §4 says AC-46 closes* | stated **per class**: created successor under AC-28's five conditions; cascade-changed step on its own snapshot under AC-19's `completed_by_parent` guard. **And the skipped set names top-level tasks only**, because `undo.ts`'s `skipped` carries a `title` and would otherwise put eight step titles the user has never seen into one message |
| **AC-25** | how a series ends | *"all three ways"* — AC-30's series delete was not among them, and `series_live` was defined against that list, so a **deleted** series stayed live and AC-39 marked its surviving completed occurrences forever | **four endings**, the fourth being the series delete; `series_live` and AC-39's negative case both carry it, and the state diagram gains the transition |

---

## Every finding, by lens

`fixed` = traceable to changed spec text, named in the *where* column.
`recorded` = written into an existing section **unanswered**, with the finding's own words.

### tester (api) — 4 HIGH · 4 MED · 2 LOW

| id | sev | acs touched | disposition | where it landed |
|---|---|---|---|---|
| T32 | HIGH | AC-38 | fixed | AC-38's headline: *"surfaced once"* struck, the no-reappearance guarantee scoped to an **acknowledged** reminder, and *"an unacknowledged one does reappear"* stated; the `(api)` falsifiable clause requoted in the who-writes-the-marker bullet |
| T33 | HIGH | AC-38, AC-2 | fixed (owner §3) | AC-38's offline sub-bullet: an offline acknowledgement is **not recorded**, the reminder re-surfaces at the next open; *"recorded when connectivity returns"* withdrawn with its reason |
| T34 | HIGH | AC-44 + six | **recorded** | `## API Touch Points` — the zone's **write path**, with the measurement (**no account entity exists in the store**) and the consequence (an account that has never sent a turn has no zone, so every date computation is refused — the AC-32 by-hand user). AC-44 points at it |
| T35 | HIGH | AC-25, AC-26, AC-28 | **recorded** | AC-25 gains a sub-bullet stating the gap in the lens's own terms (nothing in `## Data` records that an occurrence was ever completed; the `count: 3` observable is quoted); `## API Touch Points` carries the obligation |
| T36 | MED | AC-44, AC-13 | **recorded** | `## API Touch Points` — the refusal is **write-shaped and AC-13's use is a read**, with **0 of 790 rows carry `due_all_day`** and both improvisations named |
| T37 | MED | AC-38, AC-36, AC-40 | **recorded** | `## API Touch Points` — who may write `reminder_shown_at`: may a turn set it, may a caller acknowledge another user's reminder. AC-41's caller-scoping clause named as the precedent that was not applied here |
| T38 | MED | AC-43, AC-47 | fixed (owner §2) | AC-43's ender list gains the **reload**; AC-47's undo-offer bullet states the consequence; OQ13 carries it as the second cause |
| T39 | MED | AC-25, AC-30, AC-39 | fixed | AC-25's **four** endings; `series_live` false for a deleted series; AC-39's negative case gains the surviving completed occupant; `## Data`'s `series_live` cell; the state diagram |
| T40 | LOW | AC-26, AC-2 | fixed | AC-26's headline restated in the **per-occurrence** form its own sub-bullet resolved it to; AC-2's offline bullet cites the rule rather than the old phrase |
| T41 | LOW | `## Impact` §4 | fixed | The stale invariant withdrawn with its reason; the sentence now says **half-reverted turn**, which is what is actually wrong |

### tester (web) — 2 HIGH · 3 MED · 0 LOW

| id | sev | acs touched | disposition | where it landed |
|---|---|---|---|---|
| R1 | HIGH | AC-3, AC-2, AC-47 | fixed | AC-3's precedence rule **scoped to accepted writes**; on a failed or refused user write **AC-2 governs the control**; the deferred assistant value is neither applied nor discarded (it is already stored); **the arrival cue does not fire on a reversion caused by a failure** |
| R2 | HIGH | AC-47 | fixed | Bullet 4's *"never the stored value"* withdrawn with its reason; **a superseded notice reports and offers no retry**; supersession moved out of the ender list, where it contradicted the reporting rule in the same AC |
| R3 | MED | AC-44, `## API Touch Points` | **recorded** | `## API Touch Points` — a named **client-side clock-and-zone door** is owed; `window.__assistantSeams` named as the existing guarded precedent, with the measurement that `ControllerDeps.now` is an in-process parameter no browser run can reach |
| R4 | MED | AC-33, AC-43 | fixed | AC-33's 2.2.1 restated at the strength its two siblings state it (**no withdrawal by the passage of time at all**, timer-extended-on-focus included); the **stale quotation of AC-43 removed** and the mechanism of that error recorded |
| R5 | MED | AC-38 | fixed (owner §3) | AC-38's *what acknowledging is* sub-bullet; the negative case named as constructible only because the gesture set is now closed |

### tester (mobile) — 3 HIGH · 2 MED · 1 LOW

| id | sev | acs touched | disposition | where it landed |
|---|---|---|---|---|
| M11 | HIGH | AC-35 | fixed | AC-35's construction path stated **per reader**: the empty-state choice reads raw cardinality, the a11y id set reads the **drawn rows**. Revision 3's alternative withdrawn with the reason — in the account the same sentence names, `collectionTasks` is empty, so `tasks-view.ts:113` returns `empty-first`, the state the sentence forbids. `## Test strategy`'s earlier bullet corrected too |
| M12 | HIGH | AC-38 | fixed (owner §3) | The offline recording is gone, so its two unenumerated doors go with it; the sub-bullet records both, and why the remedy for the opening doors did not reach it |
| M13 | MED | AC-38 | fixed | Same sub-bullet: **the app being killed while offline needs no separate answer** — there was nothing pending to lose |
| M14 | HIGH | AC-44, AC-13 | **recorded** | `## API Touch Points` — the offline mobile create computes client-side with `refreshTasks()` returning early, so the only zone in reach is `ControllerDeps.timezone`, *the one-row-three-answers source AC-44 was rewritten against*. Three outcomes named, none chosen |
| M15 | LOW | AC-42, AC-43, `## Impact` §8/§9 | fixed | `## Impact` §8 gains an explicit **debts owed to design** list — the undo's word, the mark budget, the one-or-two-families question, **and the mobile ids for an element that does not exist**; §9 routes `F-003`'s closed catalogue |
| M16 | MED | AC-2, AC-42, AC-47 | fixed | The circular pointer broken: **the phone owes the retry**, in the notice, and **AC-47's lifetime rules bind it there**. AC-47 retagged `(web, mobile)` |

### dev (backend) — 3 HIGH · 3 MED · 1 LOW

| id | sev | acs touched | disposition | where it landed |
|---|---|---|---|---|
| F1 | HIGH | AC-44, AC-32, AC-13 | **recorded** | `## API Touch Points` — with the store measurement verbatim and AC-32's guarantee named as what the refusal collides with |
| F2 | HIGH | AC-44, AC-13, AC-18 | **recorded** | `## API Touch Points` — *"writes nothing has no referent on a read"*, with **0 of 790** and both bad improvisations |
| F3 | HIGH | AC-46, AC-28, AC-19, AC-35 | fixed | AC-46 per class (above), **plus** the skipped set naming top-level tasks only, and the note that `undo.ts:98`'s whole-row replacement means the cascade's steps are reverted as their own rows |
| F4 | MED | AC-41 | **recorded** | `## API Touch Points` — **53 of 790 rows soft-deleted with no `delete_membership`, across 18 accounts, all predating the field**; named as a migration question about live data, with the `parent_id` key AC-41 rejects called out as one of the three guesses |
| F5 | MED | AC-42, AC-43, AC-41 | **open question** | **OQ16**, with the cost stated in AC-42 rather than only in the question — both branches named, and the default (offer it, reverse locally) flagged as a **second undo mechanism**, which is why the choice is the owner's |
| F6 | MED | `## Impact` §3, AC-36 | fixed | §3 gains a **consequence and a routing line** in the form §13 and §14 use; the analogy to AC-41's restore withdrawn in **both** places, because it compared a cross-spec amendment to an in-feature contract item this spec discharges |
| F7 | LOW | `## Impact` §1, `## API Touch Points` | fixed | **six → seven** in the heading, the body and the API section, with the arithmetic stated as the check (7 + 9 = 16); **the wire shape named as the seventh**; `ContextTask`'s rationale corrected (it is a projection, not a constructor) |

### dev (web) — 3 HIGH · 1 MED · 3 LOW

| id | sev | acs touched | disposition | where it landed |
|---|---|---|---|---|
| H1 | HIGH | AC-2 | fixed (owner §3) | AC-2's third state scoped by **row provenance**, with all three disjuncts named and the online-arm case closed |
| H2 | HIGH | AC-14, `## Out of Scope` | fixed | `## Out of Scope`'s sentence **qualified** — what is rejected is queue-and-replay for **edits** — and AC-14 gains the matching clause; the flowchart's offline edge splits; the *considered and rejected* entry qualified too |
| H3 | HIGH | AC-47 | fixed | See R2 |
| M1 | MED | `## Impact` §14, §7 | fixed | §14 gains the **second predicate** (`mobile/model/task-link.ts:54`) and states why routing it as one predicate leaves the phone with the collection filter |
| L1 | LOW | `## Impact` §1, `## API Touch Points` | fixed | See F7 |
| L2 | LOW | AC-45 | fixed | The retracted sentence struck **where it stood**, with the correcting bullet named |
| L3 | LOW | AC-44 | fixed | **nine** defaulted clocks, the ninth at `mobile/model/task-link.ts:54` — the same file M1 is about |

### dev (mobile) — 4 HIGH · 1 MED · 0 LOW

| id | sev | acs touched | disposition | where it landed |
|---|---|---|---|---|
| F1 | HIGH | AC-2 | fixed (owner §3) | See H1; *"no queue, no durable store, no replay"* restated as *no **new*** ones, exactly as this lens directed |
| F2 | HIGH | AC-14, `## Out of Scope` | fixed | See H2 |
| F3 | HIGH | AC-2, AC-47, `§ SaveNotice` | fixed | **AC-47 retagged `(web, mobile)`** — the retagging this lens named as the honest amendment; AC-2's mobile bullet states that the notice is not cleared by leaving the surface, with `PathSwitch` named; §9 routes `§ SaveNotice` a second time and for this reason |
| F4 | HIGH | AC-38, AC-2 | fixed (both halves) | *(i)* `## API Touch Points` states that **`reminder_shown_at` is carried on the wire** — the explicit statement AC-25 made for `series_live` and AC-38 did not, without which every passed reminder re-surfaces on every offline foreground. *(ii)* the offline acknowledgement is not recorded, so **there is no holder to build**, and the side-door queue this lens named cannot arise |
| F5 | MED | AC-33 | fixed | AC-33's `(mobile)` list goes **four → five**, the fifth being AC-2's offline refusal — the announcement this AC itself calls *"the one that fires during an outage"* |

### architect — 2 HIGH · 2 MED · 2 LOW

| id | sev | acs touched | disposition | where it landed |
|---|---|---|---|---|
| F1 | HIGH | AC-14, AC-2, `## Out of Scope`, flowchart | fixed | See H2 — **including the flowchart edge** this lens named: `E -->|offline| V` routed *add a step* to the refusal node by name, and the edge now splits between an edit to a server-owned step and a locally-created step |
| F2 | HIGH | AC-46, AC-28, AC-19 | fixed | AC-46 per class (above), which is this lens's own directive verbatim |
| F3 | MED | AC-21, `## Data` | **recorded** | AC-21's *"scalar fields"* corrected to **per-member rows**, with two of six named as sets; `## API Touch Points` carries the diff-row shape as unanswered; §9 routes `data-model.md § assistant_turn` |
| F4 | MED | `## Data`, AC-14 | fixed | The `step_order` cell: **assigned by the server when the create supplies none, and a supplied position preserved** — with the note that this is the cell the create contract is written from |
| F5 | LOW | AC-15 | **recorded** | `## API Touch Points` — the prior position has two sources in one sentence pair and the contract owes one |
| F6 | LOW | `## API Touch Points` | fixed | The multi-row enumeration gains the **cluster delete** (N+1 rows, and it now also writes `delete_membership`) |

### design — 2 HIGH · 4 MED · 1 LOW

| id | sev | acs touched | disposition | where it landed |
|---|---|---|---|---|
| D21 | HIGH | AC-43, AC-47, AC-9, `## Impact` §8, OQ5 | fixed (owner §2) | One home, stated at all five sites; the in-place sentence withdrawn with what was right about it kept |
| D22 | HIGH | AC-38 | fixed (owner §3) | See R5 — including that `## Test strategy`'s *"open, do not acknowledge, reopen"* case is now constructible |
| D23 | MED | `## Impact` §8, AC-9, OQ5 | fixed | **One** list of three (AC-9, AC-17, AC-39) in all three places; the violet constraint travels with the affordance rather than with the row |
| D24 | MED | AC-47 | fixed | **Placement added to the "what is *not* design's" list**, and the verb tightened from *reachable* to **visible**, with the badge-then-tap design named as what the weaker verb admits |
| D25 | MED | AC-45, AC-48, AC-33 | fixed | AC-45's justification names the one object it was false for and **applies AC-48's rule at the close door** — the preview is discarded and the user is told, once, under 4.1.3; AC-33's 4.1.3 list carries both doors |
| D26 | MED | AC-4, AC-47, AC-33 | fixed | The deletion report's lifetime is AC-47's: **it ends when the user dismisses it, and by nothing else except a reload** — stated because it is a report rather than an affordance, so 2.2.1 needed saying rather than assuming |
| D27 | LOW | AC-43, `## Impact` §8 | fixed | §8 gains the explicit **debts owed to design** list, so the pointer names items instead of a section |

### product — 2 HIGH · 2 MED · 1 LOW

| id | sev | acs touched | disposition | where it landed |
|---|---|---|---|---|
| P13 | HIGH | AC-43, AC-47, OQ13 | fixed (owner §2) | The reload named as a fourth ender **and** as OQ13's second cause of permanent loss, in AC-43, AC-41 and OQ13 |
| P14 | HIGH | AC-2, AC-14 | fixed (owner §3) | See H1 |
| P15 | MED | AC-38 | fixed (owner §3, declined) | **No bulk dismissal**, with the owner's reasoning and the accepted N-gesture cost stated **in the AC**, so it can be overturned by someone reading the AC rather than the decision doc |
| P16 | MED | AC-38, AC-2 | fixed (owner §3) | See T33 — this lens's *"the safe default needs one sentence and contradicts nothing"* is the sentence that landed |
| P17 | LOW | AC-44 | **recorded** | `## API Touch Points` — a refusal the user cannot act on, most likely on a first run, recorded beside the write-path gap it follows from |

---

## What a reader should check first

Three amendments in this pass are the ones most worth a second pair of eyes, because each
narrows a rule that other clauses lean on:

1. **AC-2's provenance scope.** It is now the only place in the spec where an offline behaviour
   depends on where a row came from. Six sites state it and they were changed together; a
   seventh that contradicted it would be a defect of exactly the kind this round was about.
2. **AC-46's per-class rule.** The created class and the changed class now have different
   conditions, and `## Test strategy` requires two structurally distinct cases plus one
   assertion of absence (no step title in the message).
3. **AC-47's `(web, mobile)` retag.** The *trigger* stays web-only and the *family* does not.
   That distinction is stated in the tag bullet, in AC-2's mobile bullet and in `## Impact` §7;
   read as a whole-AC retag it would commission a detail surface on the phone, which nothing
   here does.
