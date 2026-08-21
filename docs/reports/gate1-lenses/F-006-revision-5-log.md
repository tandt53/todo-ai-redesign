# F-006 revision 5 — per-finding disposition (T-188, 2026-08-21)

Gate 1 **round 2** put **nine lenses** on F-006 revision 4 and returned **14 HIGH ·
20 MEDIUM · 3 LOW, 37 findings**. **All 37 have a row here.**

**This is the last revision. There is no round 3.** The owner waived the round cap once,
and the substance of the waiver is the constraint: **no new ACs — 17 before, 17 after,
nothing renumbered, added or deleted.**

**The reason is measured, not stylistic.** Of round 2's 14 HIGH:

| where | count |
|---|---|
| AC-14 / AC-15 — the owner's read permission, added **after** round 1 | 7 |
| AC-17 — created by a **round-1 fix**, never read by any lens | 3 |
| AC-9 / AC-7 — clauses **added** by round-1 fixes | 4 |
| text that existed at round 1 and survived it | **0** |

**Every new HIGH was on text nobody had read. A revision that adds is a revision that
ships unreviewed text.**

| | |
|---|---|
| Findings dispositioned | **37** — 14 HIGH, 20 MEDIUM, 3 LOW |
| **fixed** | **35** |
| **recorded** (routed, deliberately unanswered in this spec) | **2** — design F6's stacking bound → `F-005 AC-47`'s; dev-web F3's missing notice timer → `F-005` revision 5's implementation |
| **rejected** | **0** |
| **HIGH fixed** | **14 of 14** |
| ACs before → after | **17 → 17.** Ids 1–17 contiguous, every AC platform-tagged |
| ACs amended | **AC-3 · AC-5 · AC-7 · AC-9 · AC-10 · AC-12 · AC-13 · AC-14 · AC-15 · AC-16 · AC-17** — eleven of seventeen |
| ACs retagged | **AC-14**, `(api)` → `(api, web, mobile)` — the reply is a sentence the user hears and was verified at no tier that renders it (tester-web F3) |
| `declared-elements.sh` | **exit 0** — all 4 declared `## Data` fields accounted for |
| Spec length | 717 → **857** lines |

---

## No AC was added, and one finding came close to needing one

**C1 is the case.** The owner's read permission authorises a sentence with no declared
spoken frame, and `F-002 AC-22` makes an unframed utterance **fail** rather than ship
generated text. The rule that closes it is *"the reply is composed from a declared frame,
and here are the two frames it needs"* — and that is a constraint on AC-14's own read
permission, so **AC-14 carries it.** A new AC would have said the same thing one id further
away from the permission it constrains, and would have been the eighteenth AC nobody reads.

**The two frames themselves are not an AC at all** — they are artifacts owed to
`components.md § Spoken frames`, which is F-002's owning section and design's to write.
`## Impact` §9 and §10 route them with the writer named, which is where every other owed
artifact in this spec already lives.

---

## The seven convergences

| # | Finding | Lenses | Severity | Disposition | ACs / sections touched |
|---|---|---|---|---|---|
| **C1** | The assistant is required to say something no vocabulary can say — `§ Spoken frames` has no row, `turn.outcome.kind` is seven closed members, and the only reachable free-text field would report an answered question as unsupported | design F1 · tester-web F1 · tester-api F1 | HIGH ×3 | **fixed** — AC-14 states the reply is a declared frame and names what it must say; the two frames (owner §1) are routed to design, and the outcome member to architect | AC-14 · `## API Touch Points` · `## Impact` §9, §10 |
| **C2** | The read grant manufactures an intent the turn path answers with `no_match` — the improvisation `turns.ts:603` already excludes by name | product F1 · tester-web F3 · tester-mobile F4 | HIGH · MED · MED | **fixed** — AC-14: such a turn is answered by naming the trash and the way to reach it, **never `no_match`**; three test-strategy assertions make it fail | AC-14 · `## Users & Permissions` · `## Test strategy` |
| **C3** | The assistant's read is the read that purges, and AC-12 still says two doors | architect F1 · dev-api F1 | HIGH ×2 | **fixed** — the count is of read *paths*; AC-5's path has two callers, **the removal write happens on the surface's caller only**, the expiry predicate on both | AC-5 · AC-12 · `## API Touch Points` |
| **C4** | Restore is the third write and the only one with no failed or offline post-state; `## Impact` §11's *"three writes"* names two | design F2 · dev-mobile F2 | HIGH ×2 | **fixed** — AC-9 gains the post-state rule (not optimistic · failed leaves the entry · offline refused, never queued); AC-15, AC-16 and §11 now name three writes | AC-9 · AC-15 · AC-16 · `## Impact` §11 · `## Out of Scope` |
| **C5** | AC-17's confirmed set and destroyed set are not bound — a task deleted between the read and the confirm is destroyed without being named | tester-web F2 · dev-mobile F3 · dev-api F4 · product F3 | HIGH · MED ×3 | **fixed** — the set is pinned to the confirmation, as AC-11's is; and the confirmation states **entry count and row count**, which is where tester-web F2's second half lands | AC-17 |
| **C6** | A restore can resurrect an EXPIRED row and AC-12 says *"without exception"* — verified at `app.ts:610-617` | architect F2 | HIGH | **fixed** — AC-9's parent invariant is subject to AC-12 without exception; refusal (c) widens to cover a parent past its own 30 days | AC-9 · `## API Touch Points` · state diagram |
| **C7** | `## Impact` §1's criterion admits write-guard sites its table lacks, including `app.ts:524`, whose widening turns the soft-delete route into a hard-delete route | dev-api F3 · architect F4 | MED ×2 | **fixed** — ten sites added as a second table, each verified against the working tree; §1's heading drops its count (L-027) | `## Impact` §1 · AC-5 |

---

## Seen by one lens

| # | Lens | Finding | Sev | Disposition | ACs / sections |
|---|---|---|---|---|---|
| 1 | product F2 | The read is unbounded while AC-7 scopes step titles to *"this surface and nothing else"* — the cheapest implementation **speaks step titles**, breaking ADR-013 in the one path no AC asserts on | **HIGH** | **fixed** — AC-14's read is bounded to top-level tasks, mirroring the handle list; AC-7 names the turn path as explicitly not its exception. Needs no ADR-013 change | AC-14 · AC-7 · `## Users & Permissions` |
| 2 | dev-web F1 | AC-7's orphan clause **has no data source** — the client has only `parent_id`, so live / deleted / gone are indistinguishable and an implementation rendering nothing for all three passes every fixture | **HIGH** | **fixed** — the entry carries the parent's **title** and **state**, server-produced on the trash read by AC-3's producer rule | AC-7 · `## API Touch Points` |
| 3 | dev-mobile F1 | The restore notice is a **seventh** member of a closed six-member union (`carried.ts:62`) in a catalogue `platform/mobile.md` calls *"closed and structurally asserted"*; §4 calls it *"only a new member"* and §9 omits it | **HIGH** | **fixed** — AC-10 states the row needs its own id; §4's *"only a new member"* is corrected as true of AC-47's rule and false of the phone's union; §9 and §10 route the id to design | AC-10 · `## Impact` §4, §9, §10 |
| 4 | tester-mobile F3 | AC-17's *"expired or not"* **cannot fail at any product door**, and reading the trash to observe it is what destroys the expired rows | **HIGH** | **fixed** — AC-17 cites AC-12's raw-store harness read; the fixture empties **without an intervening trash read** | AC-17 · AC-12 · `## Test strategy` |
| 5 | design F3 | A failed trash read spoken as an empty one — the substitution AC-2 forbids by name, on the one channel AC-2 does not reach | MED | **fixed** — AC-14: a failed read is spoken as a failure. `SPK-FAILED-TURN` already exists, so the vocabulary is not the obstacle | AC-14 · `## Test strategy` |
| 6 | design F4 | ***Restore* is a forbidden word** — `§ Buttons` binds this concept to **put back** and lists *restore* among the words never used for it. 57 uses of `restor*`, 3 of *put back*, none in an AC body | MED | **fixed** — AC-9 separates the **mechanism** (`POST /tasks/{id}/restore`, a route and a field, unaffected) from the **control's word**, which is `§ Buttons`'. §9 routes the decision: *put back*, or a second word — never a forbidden synonym. `## Users & Permissions` and AC-10's notice clause switch to *put back*; the remaining
`restor*` uses name the mechanism or quote a prior revision, and the control's word is
design's to set, not this spec's | AC-9 · AC-10 · `## Users & Permissions` · `## Impact` §9 |
| 7 | design F5 | Notice content for **1 of 4** outcomes — (b), (c), (d) and the cascade have none, so three of the four outcomes AC-16's 4.1.3 requires announced have nothing to announce | MED | **fixed** — AC-10 reports which of AC-9's four outcomes occurred, and the cascade names both entries; wording and the two-task shape routed to design | AC-10 · AC-16 · `## Impact` §9 |
| 8 | design F6 | AC-10's three-in-a-row justification leans on undrawn multiplicity — **the third time this AC leans on behaviour it does not own** | MED | **recorded** — the AC stops re-justifying itself from it: each put-back is reported, and **how many reports coexist is `F-005 AC-47`'s anti-stacking bound**, named as a dependency | AC-10 |
| 9 | design F7 | AC-17 has no success post-state, and the only candidate copy says *"nothing has been deleted recently"* right after nine entries were destroyed by name | LOW | **fixed** — AC-17 states the success post-state; §9 routes a second wording for that empty state | AC-17 · `## Impact` §9 |
| 10 | architect F3 | `## Data` lists AC-17 against `delete_gesture_id` — which AC-17 addresses no instance of — and omits it from `deleted_at`, so the field keying the only account-wide irreversible act has **no AC tracing to it** | MED | **fixed** — both rows corrected; §10's `data-model.md` instruction corrected with it | `## Data` · `## Impact` §10 |
| 11 | dev-api F2 | **The dead end is 180 seconds wide, not absolute** — a voice undo of a delete un-deletes inside ADR-004's idle window, so an owner weighing the dead end is weighing the wrong shape | MED | **fixed** — AC-14 states the window and that it is `F-001`'s path, not an act of this surface; AC-15 says the same from its side | AC-14 · AC-15 |
| 12 | dev-web F2 | The `removed:`-is-a-no-op correction reached `## Impact` §11 and **not `platform/web.md`**, which is the document the web agent's contract binds it to follow | MED | **fixed** — §10's `platform/web.md` row gains it as a second correction beside the stale `ShellSurface` line; §11 cross-refers | `## Impact` §10, §11 |
| 13 | dev-web F3 | The ten-second notice group is **unbuilt in both clients** — `CarriedNotices.tsx` has no timer and its header states that absence as the requirement | MED | **recorded** — §4 and AC-10 name it as a dependency on `F-005` revision 5's implementation. Not this feature's to build, and an implementer adding a timer before it lands is fighting a written rule | AC-10 · `## Impact` §4 |
| 14 | dev-web F4 | AC-17's success post-state exists only by reference, and the three inherited items are **all failure halves** | LOW | **fixed** — same clause as #9 | AC-17 |
| 15 | product F4 | AC-3's *"no wording on this surface may promise that"* reads surface-wide, and catches the confirmations' *"this cannot be undone"* — for which it is **true** | LOW | **fixed** — the ban is scoped to the retention copy and to nothing else | AC-3 |
| 16 | tester-api F2 | Reading the trash to observe the empty is what destroys the expired rows, so the clause is certified by a test that never exercised it | MED | **fixed** — same fixture rule as #4, stated in AC-12 as well as AC-17 because AC-12 owns the removal write | AC-12 · AC-17 · `## Test strategy` |
| 17 | tester-api F3 | Three paths now hard-remove a row and AC-13 names one fixture — L-012's shape on the act that destroys an account's whole trash | MED | **fixed** — AC-13 and `## Test strategy` name all three: AC-11, AC-17, and AC-12's removal on the read | AC-13 · `## Test strategy` |
| 18 | tester-mobile F1 | Model-testable rules routed to the device debt group — the two prohibitions revision 3 added for the phone land in the group *"not ticked on a node run"* and are **verified at no tier at all**; the connectivity seam exists and a test already uses it | MED | **fixed** — the split is now by **observable** (decision vs render), with the seam cited | `## Test strategy` |
| 19 | tester-mobile F2 | The mobile enumeration is incomplete and its count wrong — thirteen ACs carry `(mobile)` not twelve, AC-8 and AC-16's 4.1.3 are in **neither** group, and AC-12 (`api` only) sits in the mobile list | MED | **fixed** — the enumeration is stated in full and **no count is stated** (L-027, which AC-5 already publishes) | `## Test strategy` |
| 20 | tester-web F3 | AC-14 is `(api)`-tagged, so the sentence the user hears is verified at **no tier that renders it**; a reply omitting that the task is recoverable passes its one fixture | MED | **fixed** — AC-14 retagged `(api, web, mobile)` with the reason stated, and the reply must say how to reach the trash by hand. **The retention date is deliberately not spoken** — it would need a sixth slot type and the owner chose the five-slot answer | AC-14 · `## Test strategy` |
| 21 | tester-web F4 | A trash that empties under the user has no stated state, and nothing says whether *empty trash* is offered at zero entries | MED | **fixed** — AC-17: offered only from a loaded trash holding at least one entry; the control goes with the last entry | AC-17 |
| 22 | product F3 | A confirmation that must name entries, in states with no listing — either it names nothing, which is weaker than the excluded count-only fallback, or the clients diverge on rules nobody wrote | MED | **fixed** — same clause as #21, plus the pinned set in C5 | AC-17 |
| 23 | dev-mobile F3 | AC-17's confirmed set and destroyed set are not bound | MED | **fixed** — C5 | AC-17 |
| 24 | dev-api F4 | The same, from the api side: a task deleted between the read and the confirm is destroyed without being named | MED | **fixed** — C5 | AC-17 |
| 25 | tester-web F2 | The confirmation imports AC-11's **per-entry row count** rule and then enumerates **entries** — two readings differing by the scale of the largest irreversible act in the product | **HIGH** | **fixed** — C5: names, overflow, **entry count and row count** | AC-17 |

*(Rows 20 and 22–25 are members of C2 and C5, listed again individually so **every lens's
finding has a row of its own** — L-009: a finding that clusters with nothing disappears, and
so does one that is only ever reachable through its cluster.)*

### Coverage check — 37 unique findings, every lens accounted for

| lens | findings | where each is dispositioned |
|---|---|---|
| design | 7 | F1→C1 · F2→C4 · F3→#5 · F4→#6 · F5→#7 · F6→#8 · F7→#9 |
| architect | 4 | F1→C3 · F2→C6 · F3→#10 · F4→C7 |
| product | 4 | F1→C2 · F2→#1 · F3→C5/#22 · F4→#15 |
| dev (mobile) | 3 | F1→#3 · F2→C4 · F3→C5/#23 |
| tester (web) | 4 | F1→C1 · F2→C5/#25 · F3→C2/#20 · F4→#21 |
| dev (api) | 4 | F1→C3 · F2→#11 · F3→C7 · F4→C5/#24 |
| dev (web) | 4 | F1→#2 · F2→#12 · F3→#13 · F4→#14 |
| tester (api) | 3 | F1→C1 · F2→#16 · F3→#17 |
| tester (mobile) | 4 | F1→#18 · F2→#19 · F3→#4 · F4→C2 |
| **total** | **37** | 14 HIGH · 20 MEDIUM · 3 LOW — **all 14 HIGH fixed** |

---

## Two things this log should say plainly

**The consolidation omitted ten findings, one of them HIGH.** Nine lens files carry 37
findings; `F-006-r2-consolidated.md`'s seven convergences and its *"Seen by one lens"* list
between them account for 27. The ten it does not name are **product F2 (HIGH — the assistant
speaking step titles)**, product F4, architect F3, design F3, F5, F6, F7, dev-web F2, F4 and
tester-api F3. **This is L-009 arriving exactly as written** — *"a finding that clusters with
nothing disappears"* — and it is why this revision was written against the nine lens files
and not against the consolidation. Had it been written against the consolidation, product F2
would have shipped: an unbounded assistant read that speaks step titles and breaks ADR-013 in
the one path no AC asserts on.

**A correction carried from the orchestrator's own note, because it is an argument that gets
reused.** An earlier note claimed *"a hallucinated task name deletes the wrong thing."* **That
is false** — deletion is id-driven, so a wrong name still deletes the right row. **What breaks
is consent:** the user says yes to a sentence that does not match the action. The correct form
is what AC-17's pinned-set clause and AC-11's confirmation rule are both about.

---

## What round 2 affirmed, and is not re-litigated here

- **All 56 round-1 findings hold**, verified independently by nine lenses, most against the
  source or the working tree rather than against the disposition log.
- **Every store measurement reproduces exactly** — 839 / 57 / 53 null-gesture / 0 `parent_id`
  / 420 turns / 24 turns naming a soft-deleted row — re-derived by five lenses.
- **All 14 rows of `## Impact` §1 verified against the working tree**, file, line and
  description. The ten write-guard rows added this revision were verified the same way.
- **AC-6's closed membership is stated once and all four referrers cite it.**
- **AC-12's reachability-not-storage promise is still un-misreadable.**
- **AC-16's *"2.2.1 is not engaged"* is correct** — the criterion's own exception covers
  limits beyond 20 hours.
- **AC-17's three-names-plus-count exceeds the comparables** — Gmail's *Empty Trash now* and
  Apple Reminders' *Delete All* name nothing at all.
- **No migration is owed. No new entity, field or endpoint that does not already exist.**
- **The routed question came back unanimous: the dead end is acceptable.** Nobody asked the
  owner to reverse it. *"The consensus is not 'the decision was wrong'. It is 'the decision is
  not yet sayable'"* — which is C1, and C1 is fixed.

---

## What leaves this spec unanswered, for architecture

Each is recorded in the spec's own words in `## API Touch Points` or `## Impact` §10, with a
writer named. None is a defect in the spec; each is a shape only architecture can fix.

1. **The `turn.outcome` member the two new frames select on**, and the field supplying each
   slot — `turn.outcome.kind` is seven closed members and none is a trash answer.
2. **A row in `F-002 § What speaks, and from what`**, which is declared *"exhaustive and
   closed"* — spec-agent's, on F-002, alongside T-185.
3. **The two frames' utterances** in `components.md § Spoken frames` — design's.
4. **The put-back report's `CarriedRowId`** — a seventh member of a closed six-member union.
5. **The word for the 30-day put-back** in `§ Buttons`, and the second wording for AC-2's
   empty state after an *empty trash* — design's.
6. **The five distinguishable outcomes of `POST /tasks/{id}/restore`**, now including the
   widened refusal (c).
7. **The raw-store harness read** AC-12 and AC-17 both assert through.
8. **The trash read's two callers** — the shape that lets the turn caller read without
   carrying the removal write.
9. **`series_ended_at` on restore** — Open Question 2, the owner's, **T-181. Untouched by
   this revision.**
