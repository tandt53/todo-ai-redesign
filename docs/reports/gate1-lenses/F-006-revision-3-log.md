# F-006 revision 3 — per-finding disposition (T-184, 2026-08-21)

Gate 1 round 1 put **nine lenses** on F-006 revision 2 and returned **REJECT — 21 HIGH ·
29 MEDIUM · 6 LOW, 56 findings**. **All 56 have a row here.** This log determines the
targeted re-review set: each lens re-reads only the ACs it raised findings on, so **a
finding missing from this table is a finding nobody re-reads.**

**The round cap is 2 and this revision reaches it.** After the targeted re-review, F-006's
Gate 1 closes.

| | count |
|---|---|
| Findings dispositioned | **56** — 21 HIGH, 29 MEDIUM, 6 LOW |
| **fixed** | **54** |
| **recorded** (routed, deliberately unanswered here) | **2** — product F4 → OQ4; dev-web drift → `## Impact` §10 |
| **rejected** | **0** |
| ACs before → after | **16 → 17.** One added: **AC-17** (*empty trash*, split out of AC-11). Nothing renumbered, nothing deleted. Ids 1–17 contiguous, every AC platform-tagged |
| ACs amended | **AC-1 · AC-2 · AC-3 · AC-4 · AC-5 · AC-6 · AC-7 · AC-8 · AC-9 · AC-10 · AC-11 · AC-12 · AC-13 · AC-14 · AC-15 · AC-16** — every one of the sixteen |
| `declared-elements.sh` | **exit 0** — all 4 declared `## Data` fields accounted for |
| Spec length | 466 → **681** lines (F-005, the comparable, is 889) |

---

## The one added AC, and why an amendment could not carry it

**AC-17 — *empty trash*, split out of AC-11.** Every AC added in a revision is unreviewed
after this round, and *a revision adds ACs → the new ACs are unreviewed → the next round
finds them* is the mechanism that produced F-005's rounds 2 and 3. So the bar was: an
amendment must genuinely be unable to carry the rule.

It cannot here, for a reason that is **C1's own subject**. The two destructive acts are
**keyed differently** — AC-11's set is one gesture's membership, AC-17's is *every deleted
row of the account* — and revision 2's AC-11 asserted both under one id, which is what let
*delete forever*'s membership be defined twice and divergently (tester-web F1, dev-api F1).
Splitting them makes the keying difference structural rather than a sentence. It also fixes
the coverage problem tester-web F6 named: six or more P1 cases against one id means the
matrix cannot show that *empty trash*'s confirmation was never verified while *delete
forever*'s was. `F-005 AC-31`/`AC-42` is the precedent.

**Every other finding was closed by amending an existing AC or a non-normative section.**

---

## C1 — the closed membership rule, and the three convergences that fall out of it

Seven of nine lenses found this independently. It is fixed **once**, in **AC-6**:

> An entry's membership is **exactly the rows that one delete gesture trashed**… **Nothing
> is ever added to that set** — not a parent, not a step, not a row from another gesture,
> not a row that arrived by an invariant. **AC-9, AC-11 and AC-12 all act on *this* set
> and none of them re-derives it. AC-17 is the one act that deliberately does not — it
> addresses no entry and takes every deleted row of the account — and it says so in its own
> text rather than leaving the difference to be inferred.**

The three rules that used to re-derive it now refer to it:

- **AC-9** — the restore's parent invariant is a **restore-only** rule (dev-api's
  sharpening of architect's directive). It does not widen membership and it never destroys.
  It *can* end a second entry, and **that outcome is now told to the user** rather than
  being silent.
- **AC-11** — its destroy set is AC-6's membership **restricted to rows still deleted at
  the moment of the act**, so a stale entry can never hard-remove a live task.
- **AC-12** — an entry's expiry is its members' shared `deleted_at` + 30 days, well defined
  because the delete writes one instant to every row of the gesture (`plan.ts:851`).

**The four undefined outcomes each have a stated answer:**

| # | Outcome | Answer, and where |
|---|---|---|
| 1 | *Delete forever* on a stale entry hard-removes a **live** task | Cannot happen — AC-11 restricts to rows still deleted |
| 2 | Destroying one entry destroys a row from an entry the user did not select | Cannot happen — AC-6's set is closed and AC-11 adds nothing to it |
| 3 | Restoring one entry silently empties another | It can still end a second entry (the parent invariant is real and shipped) — **AC-9 makes it non-silent**: the outcome names the entry restored *and* says a second entry came back with it |
| 4 | Restoring an orphaned step produces a permanently invisible row | **AC-7**: the entry stays listed, says its parent is gone, and **is not restorable**; **AC-9** states the refusal |

**Outcome 4 is the one that needed a product-shaped choice** and the three alternatives are
recorded in AC-7 so it can be overturned cheaply: restoring anyway produces the state
`app.ts:602`'s own comment calls unreachable; destroying the step's entry with its parent's
reinstates exactly the cross-entry destruction AC-6 just closed; leaving it undefined is
what four lenses objected to.

---

## Per-finding disposition — all 56

`fixed` = the spec now says something that would have prevented the finding, per its own
`would_not_be_a_finding_if:`. `recorded` = deliberately not answered here, routed with a
named destination.

### product — 2 HIGH · 2 MEDIUM

| ID | Sev | ACs | Finding | Disposition | Where |
|---|---|---|---|---|---|
| P-F1 | HIGH | AC-2, AC-3, AC-6 | No AC requires an entry to identify the task it holds; *"title"* appears once in 466 lines, as a prohibition | **fixed** | **AC-3** gains *"what it holds"*: the entry **names the task it covers**, a cluster says how many rows come back, a series how many occurrences; **AC-7** carries the step case |
| P-F2 | HIGH | AC-1, AC-16 | One inbound path, and three separate refusals of the others, each locally defensible with no AC owning the sum | **fixed** (owner §7, option A) | **`## Purpose`** records the inbound path as **`F-005 AC-43`'s**, once, and references it; **`## Impact` §4** points at the owner's answer and **settles nothing**. F-005 half is **T-185** |
| P-F3 | MED | AC-7 | AC-7 fails its own stated purpose — *"named by that parent"* leaves two steps of one parent indistinguishable | **fixed** | **AC-7** takes a **scoped exception to ADR-013**: this surface renders the step's own title **and** its parent's. Exception scoped to this surface; ADR-013 note routed in §10 |
| P-F4 | MED | AC-4, AC-14, AC-15 | The assistant's **read** is excluded on a **write** rationale, and the spec presents it as derived | **recorded** | **New Open Question 4**, the owner's, with costs both ways and no recommendation; **AC-14**'s assistant half rewritten so it no longer claims a refusal it cannot construct; `## Users & Permissions` points at OQ4 |

### architect — 2 HIGH · 3 MEDIUM · 2 LOW

| ID | Sev | ACs | Finding | Disposition | Where |
|---|---|---|---|---|---|
| A-F1 | HIGH | AC-6, AC-9, AC-11, AC-12 | A trash entry's membership is not a closed set | **fixed** | **AC-6**'s closed membership rule (C1 above), plus AC-9 / AC-11 / AC-12 |
| A-F2 | HIGH | AC-9, AC-12, AC-16 | *"unchanged"* plus a new precondition is a contradiction; three user-facing states collapse into two wire outcomes | **fixed** | **`## API Touch Points`** withdraws *"nothing about it moves"* explicitly; **AC-9** states **five distinguishable outcomes**; §10 names architect as the writer of the contract change |
| A-F3 | MED | AC-5, AC-6, AC-11 | The entry has no identity on the wire; §10 does not name the wire field list, so the change would land unrouted | **fixed** (architect's directive taken verbatim) | **AC-6**: grouping is **server-side**, an entry is addressed by **any member task id**, the gesture id stays internal. **`## Data`** amended. **§10 gains `§ Task on the wire` as a no-change confirmation** |
| A-F4 | MED | AC-3, AC-12 | No named producer for the displayed date — the default is three copies of the number the user is promised | **fixed** | **AC-3**: *"the date the entry states is produced by the server, on the same read that lists the entry, against the same clock AC-12's predicate uses. No client derives it."* **`## Data`**'s retention row says one reader tier |
| A-F5 | MED | AC-1, AC-4, AC-12 | Two decisions of ADR weight with no artifact named; §10 says ADR-009 *"becomes wrong"* and names **no writer** | **fixed** | **§10 is now a table with a Writer column.** The ADR-009 amendment and **a new ADR for the read-that-mutates** are both assigned to **architect** |
| A-F6 | LOW | AC-12, AC-13 | *"Exactly two doors"* holds for a reason the spec does not state — ADR-004's 180 s idle close | **fixed** | **AC-12** sub-bullet states the reason and names the dependency: lengthening the idle window, or any door reopening a closed session's undo, falsifies *"without exception"* |
| A-F7 | LOW | AC-4, AC-5 | §1's list is short by at least one — `web/components/TaskDetail.tsx:332` | **fixed** | **§1** rewritten as a **14-row table** including that line; the headline count is dropped |

### design — 2 HIGH · 4 MEDIUM

| ID | Sev | ACs | Finding | Disposition | Where |
|---|---|---|---|---|---|
| D-F1 | HIGH | AC-2, AC-5, AC-15 | A network-backed surface with no failure design; the empty render is what all three unnamed states produce | **fixed** | **AC-2** names **four** states — in flight, failed, offline, loaded — and **forbids by name** rendering the empty state for any of the first three. Cites `tasks-view.ts:66` and IA §6's rule |
| D-F2 | HIGH | AC-9, AC-10 | The post-restore moment is undrawable; AC-10's sentence is either false or requires a surface transition no AC states | **fixed** | **AC-10** withdraws both false sentences *(not deletes — so nobody re-derives them)* and puts the outcome in **`F-005 AC-47`'s notice family**, which renders on every surface. The user stays in the trash and can restore three in a row |
| D-F3 | MED | AC-11 | Count-only confirmation collides with the owner's 2026-08-17 decision: *"a destructive confirmation names the tasks"* | **fixed** | **AC-11 and AC-17** both name what they destroy, via `title_list`'s published overflow rule. Largest live trash is **9 entries**, so naming is affordable |
| D-F4 | MED | AC-6, AC-7, AC-9 | Restoring one entry silently removes another | **fixed** | **AC-9** — the invariant survives, the silence does not (C1 outcome 3) |
| D-F5 | MED | AC-2, AC-3, AC-10 | A task deleted while `done` is indistinguishable; **2 of 57 rows — ships day one** | **fixed** | **AC-3** requires the entry to say whether the task was completed when it was deleted |
| D-F6 | MED | AC-1, AC-3, AC-12 | §9 is accurate and incomplete — **(a)** `§ Buttons` has no word for *stops being recoverable*, so the obvious copy makes the promise AC-12 excludes; **(b)** the row is not an `LM-COLLECTION` member and its id is undecided and unrouted | **fixed** | **(a)** AC-3 states the constraint; **§9** and **§10** route the word to `§ Buttons` before screens are drawn. **(b)** AC-1 requires **its own contract testid** and states the row is not `LM-COLLECTION`; §9 records that the *"four built-in rows"* wording, the `Source` cell, the exemplar rule and every four-row set assertion all change |

*Design's aside on the confirmation-dialog gap is folded into §9's rewrite:* the two
confirmations are **one variant of `§ ListEditorSheet`'s shipped modal anatomy** — whose
*failed state that does not close* is exactly AC-11/AC-17's post-state rule — not two new
components. Third sibling already owed by `F-005 AC-30`.

### tester (api) — 2 HIGH · 3 MEDIUM

| ID | Sev | ACs | Finding | Disposition | Where |
|---|---|---|---|---|---|
| TA-F1 | HIGH | AC-9, AC-12 | No outcome stated for restoring an **expired** row, and the spec contradicts itself; both plausible picks are already spoken for | **fixed** | **AC-9** outcome (c), required to be distinguishable from (b) and from `404`. **`## API Touch Points`** withdraws the *"unchanged"* sentence. Shape is architecture's; the **requirement** is not |
| TA-F2 | HIGH | AC-13 | The stated observable cannot carry what AC-13 asserts — a purged row is reported as *"modified since apply"*, and a purged **step** is contract-forbidden from appearing at all | **fixed** | **AC-13** makes a **distinct reason** for a permanently-deleted row a requirement, and **names the step gap** rather than leaving it to the QA author. Both routed in `## API Touch Points` and §10 |
| TA-F3 | MED | AC-12 | The removal **write** has no observable at any door — the failure the spec itself names ships green | **fixed** | **AC-12** makes the account's **stored row count after the trash read** the assertion and names the **raw-store harness read** as owed (`§ Harness doors` publishes only the write half). **`## Ops`** demotes the retention counter: *"a counter can be incremented by an implementation that removes nothing"* |
| TA-F4 | MED | AC-5, AC-6 | The `api` tag may buy no verification — if architecture takes client-side grouping, the read exposes no key | **fixed** | Closed by A-F3's directive: grouping is **server-side**, so the read returns entries and AC-6 has an api observable. The unbuildable branch is removed rather than left as a choice |
| TA-F5 | MED | AC-14 | A refusal path that cannot be reached — AC-40/AC-36 are field-scoped and no action vocabulary contains restore or permanent-delete | **fixed** | **AC-14** restated: the assistant half is a **structural guarantee** (no interpreted action exists, falsifiable by reading the vocabulary), the caller-scoping half is the testable one, and **the sentence names when the refusal becomes owed** — if a later feature adds such an intent |

### tester (web) — 4 HIGH · 2 MEDIUM · 1 LOW

| ID | Sev | ACs | Finding | Disposition | Where |
|---|---|---|---|---|---|
| TW-F1 | HIGH | AC-7, AC-9, AC-11 | *Delete forever* is defined twice and the two definitions diverge **by a task the user still owns** | **fixed** | **AC-6 + AC-11** (C1 outcomes 1 and 2). AC-11 records that the two definitions differed and why |
| TW-F2 | HIGH | AC-4 | The reader list omits the readers that count **raw row cardinality**; **4 accounts already hold ≥1 deleted row and zero live rows** | **fixed** | **AC-4** gains a sub-bullet naming `TasksSurface.tsx:413-420`. The 4-account measurement is re-derived and added to `## What already exists`. `## Test strategy` counts five readers, not four |
| TW-F3 | HIGH | AC-6, AC-7, AC-9 | One entry's restore mutates another entry's rows; both sentences cannot hold | **fixed** | **AC-9** — restore-only invariant, membership unwidened, outcome told (C1 outcome 3) |
| TW-F4 | HIGH | AC-2, AC-9, AC-12, AC-16 | A required announcement with nothing to announce — **no AC states any refusal this surface can produce** | **fixed** | **AC-16** now **enumerates** the refusals 4.1.3 governs, and each exists: AC-9's two, AC-11/AC-17's failed and offline, AC-2's failed and offline read. The expire-while-on-screen case is stated |
| TW-F5 | MED | AC-10, AC-16 | No carrier named for the restore outcome; *"notice"* appears three times in the spec and never as a mechanism | **fixed** | **AC-10** names `F-005 AC-47`'s notice family and its lifetime group; `## Impact` §4 records that the family gains a producer |
| TW-F6 | MED | AC-11 | Four independently-failing guarantees under one id; the matrix cannot show which was never verified | **fixed** | **AC-17** split out (see *The one added AC* above) |
| TW-F7 | LOW | AC-2, AC-3, AC-6 | The ordering key is unstated — the ordinary source of an order-dependent flake | **fixed** | **AC-2**: order by the **gesture's** `deleted_at`, newest first, well defined because the delete writes one instant per gesture; ties break by the entry's addressing id, so the order is total |

*Drift, recorded not filed by the lens:* §1's *"45 non-test lines"* against a measured 55.
**Closed by dropping the count** — see C7 below.

### tester (mobile) — 2 HIGH · 4 MEDIUM

| ID | Sev | ACs | Finding | Disposition | Where |
|---|---|---|---|---|---|
| TM-F1 | HIGH | AC-2, AC-5 | The phone is the offline client and the spec says *"offline"* **zero** times in 466 lines; a failed read tells the user their trash is empty | **fixed** | **AC-2**'s four states name **offline** explicitly, and the empty render is forbidden for it. The word now appears in the AC text, the flow diagram, `## Out of Scope` and §11 |
| TM-F2 | HIGH | AC-1 | The placement half has no addressable observable on the phone — the only assertion it admits **certifies the defect §2 exists to prevent** | **fixed** | **AC-1** requires **its own contract testid**, distinct from the `menu-collection-row` exemplar, and states the row is not an `LM-COLLECTION` member. §9 routes it; §10 adds **`§ Testid catalogue — app shell`** |
| TM-F3 | MED | AC-3, AC-12 | The constant has readers `## Data` does not name; a client derivation runs against a second clock and a zone | **fixed** | **AC-3**'s server-producer rule; **`## Data`** says one reader tier. `platform/mobile.md`'s *"report, do not compute"* cited |
| TM-F4 | MED | six ACs | Twelve `(mobile)` tags and no mobile tier in `## Test strategy`; both reachable improvisations are known-bad | **fixed** | **`## Test strategy`** states the split by AC: node-testable (AC-4, AC-6, AC-9, AC-10, AC-12, AC-15) versus device-or-rendering-harness (AC-1 placement, AC-2, AC-3, AC-7, AC-11/AC-17, AC-16's 2.5.1 and 4.1.2), routed to F-003's debt list, **not ticked on a node run**, and L-002 named |
| TM-F5 | MED | AC-11 | No failed-write post-state for the only irreversible act; an optimistic removal that silently reappears | **fixed** | **AC-11 and AC-17**: the entry leaves on **success**, a failed destroy leaves it and states the reason, **offline is refused not queued**. `platform/mobile.md`'s post-state obligation quoted |
| TM-F6 | MED | AC-7, AC-9, AC-11 | The orphaned-step branch, unnamed in two ACs, and the one pair of ACs with **zero** live-store instances and no fixture | **fixed** | **AC-7**'s orphan rule + **AC-9**'s refusal (d); **`## Test strategy`** adds the two-gesture step fixture with its **three cases** and says why real data never reaches it |

### dev (api) — 3 HIGH · 3 MEDIUM · 2 LOW

| ID | Sev | ACs | Finding | Disposition | Where |
|---|---|---|---|---|---|
| DA-F1 | HIGH | AC-6, AC-7, AC-9, AC-11 | *Delete forever* inherits rows from other gestures | **fixed** | **AC-6 + AC-11** (C1) |
| DA-F2 | HIGH | AC-7, AC-9, AC-11, AC-12 | A restore that produces a permanently invisible row — *the restore code's own comment already states the hazard* | **fixed** | **AC-7**'s orphan rule + **AC-9**'s refusal (d). AC-7 records the three rejected alternatives, including the one the comment describes |
| DA-F3 | HIGH | AC-9, AC-12, AC-16 | The door changes and no outcome is specified; the implementer must invent a fourth, which ethos §9 forbids | **fixed** | **AC-9**'s five outcomes, stated as requirements with shapes left to architecture — which is the ethos-conformant form, not an invention |
| DA-F4 | MED | AC-5, AC-6, AC-11 | One of the two offered options is unbuildable, and it is the one that looks cheapest; it also blocks *empty trash*'s entry count | **fixed** | **AC-6** closes the option. AC-17's entry count is a gesture count and server-side grouping supplies it |
| DA-F5 | MED | AC-5, AC-12 | The AC settles what the touch point still calls open; `transact` rewrites the whole store on every call | **fixed** | **`## API Touch Points`** now says the decision is **taken** and only the **shape** is open, and carries the measured `transact` cost — a full 839-row snapshot write on every trash open unless the predicate is checked first |
| DA-F6 | MED | AC-3, AC-12 | Two computations of one value, no named authority | **fixed** | **AC-3**'s server-producer rule |
| DA-F7 | LOW | AC-11 | *"No new response shape is owed"* tells the architect not to look — `task:` is *"the row the request addressed"* and permanent deletion destroys it while *empty trash* addresses none | **fixed** | Sentence **withdrawn**; `## API Touch Points` records the envelope problem for **both** doors; §10's `§ The multi-row response rule` row names it; **§11** records the client half |
| DA-F8 | LOW | AC-5, AC-12 | Two counts do not reproduce, and *"exactly two"* is not exact | **fixed** | §1's count **dropped**; **AC-12** scopes the phrase to *"the two doors that read a deleted row **for the user**"* and names `allow_deleted` and AC-11/AC-17 as the paths it deliberately excludes — *"because 'exactly two' is what an implementer greps against"* |

### dev (web) — 1 HIGH · 4 MEDIUM · 1 LOW

| ID | Sev | ACs | Finding | Disposition | Where |
|---|---|---|---|---|---|
| DW-F1 | HIGH | AC-7, AC-9, AC-10, AC-11, AC-12 | This feature makes a step's parent disappear — two ways, both new — and no AC says what then | **fixed** | **AC-7** + **AC-9**; both of the lens's two orderings are named in AC-7 (destroy the parent's entry; or restore-and-re-delete so the clock resets and the parent expires first) |
| DW-F2 | MED | AC-7, AC-10 | The remedy AC-10 offers does not exist for steps | **fixed** | **AC-10** withdraws the remedy; **§11** records the gap as F-005's and F-003's, not this feature's |
| DW-F3 | MED | AC-6, AC-8 | `## Data` forecloses the option `## API Touch Points` keeps open; architecture choosing *"client-side"* silently amends a Data row | **fixed** | **AC-6** — the choice is closed, not offered |
| DW-F4 | MED | AC-3, AC-12 | No AC says where the **client** gets the expiry date; **the e2e harness holds both clocks at one instant, so a divergent implementation passes and drifts only in production** | **fixed** | **AC-3**'s server-producer rule, and the harness point is quoted in the AC so the reason survives |
| DW-F5 | MED | AC-11 | *"No new response shape is owed"* is true of the wire, not the client — `applyWrite`'s `removed` handling is a **no-op** for trash rows | **fixed** | **§11**'s first bullet: the destroyed entries would stay on screen until the trash is re-read; the trash's own state drops the entry |
| DW-F6 | LOW | AC-1 | §2's list is one item short, at the site that matters — `ListsMenu` is typed `active: Collection` | **fixed** | **§2** gains the click-through-contract paragraph, including the phone's `ICON: Record<Collection, …>` typecheck failure; **AC-2** states the destination is a **surface**, not a collection on S2 |

*Drift, recorded not filed against F-006:* `platform/web.md § F-005` says `ShellSurface` is
three members; the code declares four (`web/shell.ts:56` includes `'detail'`).
**recorded** — §10's table, writer **architect**, with the note that it matters here
because AC-2's surface is placed relative to that union.

### dev (mobile) — 3 HIGH · 4 MEDIUM

| ID | Sev | ACs | Finding | Disposition | Where |
|---|---|---|---|---|---|
| DM-F1 | HIGH | AC-1, AC-2 | A new destination with no navigation class, so **Android back exits the app** from a surface reached in two taps; `information-architecture.md` is absent from §10 | **fixed** | **AC-2** states it is a **surface** with its own edge (S3 → trash) and its own return, and that back takes the return. `F-005 AC-45` named as the precedent being followed. **§10 routes IA §2, §3, §4 and §6** with design as writer |
| DM-F2 | HIGH | AC-9, AC-11 | Every offline guard the clients have is unreachable here **by construction**; AC-15 reads at a glance as *"offline"* and is about AI | **fixed** | **AC-11 / AC-17** state the offline refusal directly and forbid queueing; **AC-15** disambiguates itself; **§11**'s third bullet records that `refusesOffline` is out of reach and the implementer gets no default; **`## Out of Scope`** excludes an offline queue with `F-005 OQ6` as precedent |
| DM-F3 | HIGH | AC-10 | False on the phone in **both** halves — *"on screen"* and *"move it by hand"* | **fixed** | **AC-10** withdraws both; the notice family carries the outcome; **§11**'s second bullet records the phone's missing date and filing controls as F-005/F-003's gap |
| DM-F4 | MED | AC-2 | The analogous phone surface has five views and three banners; the trash gets two, and the shortest implementation path renders the forbidden drawing | **fixed** | **AC-2** cites `tasks-view.ts:66` by name and states there is nothing to fall back on because deleted rows are in no local store |
| DM-F5 | MED | AC-3, AC-12 | The constant would get three readers and `## Data` names two; one seam per side is not one seam | **fixed** | **AC-3**'s server-producer rule states exactly that distinction |
| DM-F6 | MED | AC-6, AC-7 | Two values the client needs to draw an entry have no stated source — the group key it cannot see, and a parent title in neither store | **fixed** | **AC-6** (server-side grouping, addressed by member id) and **AC-7** (the step's own title, rendered on this surface; the orphan case stated) |
| DM-F7 | MED | AC-5 | *"Eleven filters across the API and both clients"* undercounts, and the omissions are the tempting ones — **`task-link.ts:76` is the most temptingly widenable site in the codebase** | **fixed** | **§1**'s 14-row table includes it, `web/shell.ts:206` and `TaskDetail.tsx:332`; §1's prose names `task-link.ts:76` as the tempting one and §8 cross-references the table. *"And both clients"* is now true |

---

## C7 — the two findings about how the spec is written

Both were raised against revision 2's own text by lenses with no coordination.

**`## Impact` §1.** Four lenses re-counted the headline and produced **four different
numbers** (55/16, 56/15, 45/16, 44/14) while the reads list was short by three — including
the two sites §8 spends a paragraph arguing must **not** be widened. **The count is dropped
from AC-5 and from §1**, and §1 is now a 14-row table with an explicit criterion. The
sentence that replaces the number: *"the enumeration is the contract, the number is not."*
Independently re-measured for this revision: 57 `deleted_at` lines across 16 non-test
files, which reproduces none of the four lens counts either — **which is the argument for
dropping it.**

**`## Impact` §10.** Now a table with a **Writer** column and **seventeen rows**, up from
eight. Added: `§ Task on the wire` (as a no-change confirmation, because the client-grouping
option would have changed it unrouted), `§ Harness doors`, the turn-undo `skipped` shape,
**a new ADR for the read-that-mutates**, `ADR-013`, `information-architecture.md` §2/§3/§4/§6,
`§ Testid catalogue — app shell`, `§ Buttons`, and `platform/web.md`. The ADR-009 amendment
and the read-that-mutates ADR are both assigned to **architect** by name.

---

## What this revision did **not** do, and why

- **OQ2 / `series_ended_at`** — architect's, **T-181**. Recorded, not answered. `## Impact`
  §6 and OQ2 both say so.
- **The two new API doors' shapes** — architecture's. Every requirement this revision adds
  (AC-9's five outcomes, AC-13's distinct reason, AC-12's raw-store read, the `removed:`
  envelope) is stated as a **requirement with a named writer**, never as a shape. That is
  L-020's rule and no lens objected to the form.
- **Product F2's rule text** — it lives in `F-005 AC-43`. F-006 references it once and
  restates nothing; the F-005 amendment is **T-185**.

## Targeted re-review set

Each lens re-reads only the ACs it raised findings on. From the tables above:

| Lens | ACs to re-read |
|---|---|
| product | AC-2, AC-3, AC-4, AC-6, AC-7, AC-14, AC-15, AC-16, **OQ4** |
| architect | AC-1, AC-3, AC-4, AC-5, AC-6, AC-9, AC-11, AC-12, AC-13, `## API Touch Points`, `## Impact` §1, §10 |
| design | AC-1, AC-2, AC-3, AC-5, AC-6, AC-7, AC-9, AC-10, AC-11, **AC-17**, AC-12, AC-15, `## Impact` §9 |
| tester (api) | AC-5, AC-6, AC-9, AC-12, AC-13, AC-14 |
| tester (web) | AC-2, AC-3, AC-4, AC-6, AC-7, AC-9, AC-10, AC-11, **AC-17**, AC-12, AC-16 |
| tester (mobile) | AC-1, AC-2, AC-3, AC-5, AC-7, AC-9, AC-11, **AC-17**, AC-12, `## Test strategy` |
| dev (api) | AC-3, AC-5, AC-6, AC-7, AC-9, AC-11, **AC-17**, AC-12, `## API Touch Points` |
| dev (web) | AC-1, AC-3, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, **AC-17**, AC-12, `## Impact` §2, §11 |
| dev (mobile) | AC-1, AC-2, AC-3, AC-5, AC-6, AC-7, AC-9, AC-10, AC-11, **AC-17**, `## Impact` §11 |

**AC-17 is new and has never been reviewed by any lens** — it is in six of the nine sets
above for that reason, not because a finding named it.
