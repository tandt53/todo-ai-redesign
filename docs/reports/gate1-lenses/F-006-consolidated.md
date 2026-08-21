# F-006 Gate 1 — consolidation (T-182, 2026-08-21)

**Verdict: REJECT — 21 HIGH · 29 MEDIUM · 6 LOW across nine lenses.** All nine returned
findings **and** a `checked:` list; none violated the anti-theatre rule.

| lens | H | M | L |
|---|---|---|---|
| tester (web) | 4 | 2 | 1 |
| dev (api) | 3 | 3 | 2 |
| dev (mobile) | 3 | 4 | 0 |
| tester (api) | 2 | 3 | 0 |
| tester (mobile) | 2 | 4 | 0 |
| architect | 2 | 3 | 2 |
| design | 2 | 4 | 0 |
| product | 2 | 2 | 0 |
| dev (web) | 1 | 4 | 1 |

**Read the nine individual files, not only this one** (L-009). Clustering drops what one
lens saw alone, and four of the sharpest findings here were seen by exactly one lens.

---

## The seven convergences — found independently by two or more lenses

Ranked by cost of ignoring, not by count.

### C1 — A trash entry's membership is not a closed set · **7 of 9 lenses**
`AC-6, AC-7, AC-9, AC-11, AC-12` — tester-web F1/F3, dev-api F1/F2, dev-mobile F6,
tester-mobile F6, architect F1, design F4, dev-web F1.

AC-11 defines *delete forever* by *"the same membership AC-9's restore would have put
back"*, and the restore **pulls in a still-deleted parent regardless of gesture**
(`app.ts:605-618`) — a row AC-6 makes a separate entry. Reachable because `plan.ts:105`
cascades over **live** steps only, so *"delete step, then delete parent"* is genuinely two
gestures.

**Four undefined outcomes, all reachable:**
1. *Delete forever* on a stale entry **hard-removes a LIVE task** (tester-web F1).
2. Destroying one entry **destroys a row from an entry the user did not select**.
3. Restoring one entry **silently empties another**, and no AC says what the list shows.
4. Restoring an orphaned step produces **a live row that is in no collection, no handle
   list and no trash — permanently invisible** (dev-api F2; the restore code's own comment
   states the hazard).

*0 deleted steps in the store, so nothing on disk exercises it — which is also why no test
written from real data would find it.*

### C2 — The expired-restore outcome is unspecified, and the spec contradicts itself · **4 lenses**
`AC-9, AC-12, AC-16` — tester-api F1, tester-web F4, dev-api F3, architect F2.

`## API Touch Points` says the door is *"unchanged — nothing about it moves"*; AC-12 makes
it refuse; `## Impact` §10 says it *"gains the expiry precondition"*. The door has exactly
three outcomes today and **an expired row is none of them.** Both plausible picks are
spoken for: `404` is indistinguishable from an unknown id, `restored: false` asserts the
row is live.

**AC-16 requires every refusal to be announced, and the client cannot announce a refusal it
cannot distinguish from a double-tap.** *This is the door F-005 AC-33's AA claim rests on.*

### C3 — AC-3's displayed date has no named producer · **5 lenses**
`AC-3, AC-12` — dev-web F4, tester-mobile F3, dev-api F6, dev-mobile F5, architect F4.

`## Data` names two readers of the 30-day constant, both server-side; AC-3 renders it on
two clients. **The cheapest implementation computes `deleted_at + 30d` locally** — two more
copies of the constant and two more clocks, against a predicate that runs on the server's.
AC-3 explicitly promises the date *"is exactly what AC-12's predicate tests"*.

**Worse for the gate:** the e2e harness holds both clocks at one instant, so **a divergent
implementation passes its tests and drifts only in production** (dev-web F4).

### C4 — `delete_gesture_id` is "never serialized", but client-side grouping is offered · **5 lenses**
`AC-5, AC-6, AC-11` — tester-api F4, dev-web F3, dev-api F4, dev-mobile F6, architect F3.

One of the two options architecture is invited to choose **is unbuildable without amending
a `## Data` row** — and it is the one that looks cheapest. It also blocks *empty trash*'s
*"how many entries"*, which is a gesture count. **§10's stale-documents table does not name
the wire field list**, so the change would land unrouted. *Architect's directive is the
cleanest: address an entry by any member task id, the restore's own precedent, and keep the
gesture id internal.*

### C5 — The surface has no loading, failed or offline state · **3 lenses**
`AC-2, AC-5` — design F1, tester-mobile F1, dev-mobile F4.

AC-2 names two states for a **new network read**, and *"nothing has been deleted
recently"* is the render an empty array produces — **which is what all three unnamed states
also produce.** So a failed or offline read tells the user their deleted tasks do not
exist, **on the one surface whose purpose is telling them the opposite** — and that is the
one drawing AC-2's own second sentence forbids, reached by the shortest implementation
path.

*The analogous phone surface has five views and three banners precisely because its read
can be slow, fail, or be offline. The trash gets two.* **F-006 contains the string
"offline" zero times in 466 lines.** *190 of 207 accounts have nothing deleted, so the
empty render is right often enough that a wrong one will not look wrong.*

### C6 — The restore outcome has no named carrier · **4 lenses**
`AC-10, AC-16` — design F2, tester-web F5, dev-mobile F3, dev-web F2.

*"The restored task is on screen and named after the restore, so a user who disagrees can
move it by hand"* — **and by AC-4 the restored task cannot appear on the surface the user
is standing on.** The spec never once references F-005 AC-47's notice family (verified: the
only three mentions of "notice" are a filename and one Impact reference).

**On the phone both halves are false** (dev-mobile F3): one surface at a time, so either
the app leaves the trash — making three restores in a row impossible — or the observable is
not there; and the phone's row has three controls, **no date control and no filing
control**, so a task restored into Today *cannot be moved anywhere by hand on that client.*
AC-10 justifies "no relocation rule" with a remedy the phone does not have.

### C7 — `## Impact` §1's enumeration is short, and the four lenses that counted disagree · **4 lenses**
`AC-4, AC-5` — tester-web (55/16), dev-api (56/15), dev-mobile (45/16 — exact), architect
(44/14).

**The count is not the finding; the omitted sites are.** By §1's own criterion the list
misses `mobile/model/task-link.ts:76`, `web/shell.ts:206` (both named in §8) and
`web/components/TaskDetail.tsx:332`. **§1's stated failure mode is a site being *helpfully
widened* while someone builds the trash, and `task-link.ts:76` is the most temptingly
widenable site in the codebase** — §8 spends a paragraph arguing it must not be. *A test
written to AC-5's number asserts over a set that excludes it.*

---

## Seen by one lens, and worth as much as the convergences

- **`AC-4` omits the readers that count raw rows** (tester-web F2). `TasksSurface.tsx:413`
  is `nothingAnywhere = state.tasks.length === 0`. **Measured: 4 accounts in the live store
  already hold ≥1 deleted row and ZERO live rows.** F-005 AC-35 had to name this exact
  reader class for the identical negative about steps; AC-4 repeated the negative and
  omitted it.
- **The phone gets a destination with no navigation class, so Android back has no answer**
  (dev-mobile F1). `shellBack()` returns `consumed: false` outside overlays — **on S1/S2 the
  back press exits the app.** One of the two available inventions makes back exit the app
  from a surface reached in two taps. **F-005 AC-45 is the precedent and it is not being
  followed;** `information-architecture.md` is absent from §10's stale-documents table.
- **Every offline guard the clients have is unreachable here, by construction**
  (dev-mobile F2). `refusesOffline` is keyed on a row in `state.tasks`, and §3 requires
  trash rows to stay out of it. *A delete-forever queued offline and replayed later
  destroys rows after the user has left the surface.*
- **AC-13's stated observable cannot carry what AC-13 asserts** (tester-api F2). `skipped`
  is `[{task_id, title, reason: "modified_since_apply"}]` and **names top-level tasks
  only**. A purged task is reported to the user as *"modified since apply"* — **the test
  that passes certifies a message that is wrong** — and a purged step is contract-forbidden
  from appearing at all.
- **AC-12's removal write has no observable at any door** (tester-api F3). After the trash
  read an expired row is not listed and not restorable **whether the write happened or never
  happens at all.** So the test asserts the reachability predicate and gets labelled
  *"retention purge verified"* — and the failure the spec itself names, *"no sweep at all
  leaves expired rows on disk indefinitely"*, **ships green.**
- **AC-1's placement half has no addressable observable on the phone** (tester-mobile F2).
  `§ ListsMenu` forbids a per-row testid; `expectedShellIds()` returns a **set**. The only
  assertion AC-1 admits **passes for a row drawn in the filing group AC-1 forbids, and for
  the fifth `Collection` member §2 calls the category error.** *The test certifies the
  defect §2 exists to prevent.*
- **AC-11's confirmation content collides with a standing owner decision** (design F3).
  `§ Spoken frames` records 2026-08-17: **"a destructive confirmation names the tasks.
  Count-only is not a legal fallback for this row."** AC-11 specifies count-only for the
  larger act and nothing for the smaller. *Largest trash on the live store is 9 entries and
  the overflow rule is 3 names plus "and N more" — **naming is affordable, so count-only
  buys nothing.***
- **No AC requires an entry to identify the task it holds** (product F1). *"Title" appears
  once in 466 lines, in AC-7, as a prohibition.* **AC-7 requires the step entry to be named,
  so the narrow case has a naming rule and the common case has none** — and AC-3 proves
  entry content is in AC scope, so this is an omission inside a section that constrains
  content, not a deferral to design.
- **A task deleted while `done` is indistinguishable** (design F5). *2 of 57 rows — it
  ships day one.* AC-10 returns it to Done, the one collection whose empty state is defined
  as having no action, **so the restore whose destination is least discoverable is the one
  whose entry gives the least warning.**
- **Two decisions of ADR weight have no artifact named to carry them** (architect F5): the
  lifecycle-state-not-container rule against ADR-009's table, and the read-that-mutates.
  §10 says ADR-009 *"becomes wrong"* and **names no writer.**
- **AC-11 bundles four independently-failing guarantees under one id** (tester-web F6).
  F-005 AC-31/AC-42 is the precedent for splitting.

---

## What the lenses affirmed

Recorded because a gate that only reports defects cannot be trusted to have looked.

- **Every store measurement in the spec reproduces exactly**, re-derived independently by
  four lenses: 839 rows · 57 deleted across 20 accounts · 4 with a gesture id · 0 deleted
  steps · 0 deleted series rows · oldest 2026-08-16 · 420 turns · 24 naming a soft-deleted
  row, all applied.
- **The no-scheduler premise holds** — 4 timers in `src/`, none server-side, none touching
  the store. AC-12's evaluate-at-the-door design is the only one this app supports.
- **AC-12's *"exactly two doors"* survives the turn-undo path** — architect and dev-api both
  went looking; the session-bounded 180 s idle close is why. *Architect notes the spec does
  not state that reason (F6, LOW).*
- **AC-13's guard exists in code** and §5's warning about a purge that also cleans
  `post_apply` is accurate.
- **`## Impact` §2 and §3 are true and precise** — `inCollection` does not contain the
  identifier `deleted_at` at all; a fifth `Collection` member turns three existing suites
  red immediately, which is what §2 wants.
- **No migration is owed** — every field the feature needs already ships.
- **Every AC obeys the lifecycle-state claim** (architect) — the structural question the
  briefing aimed all nine lenses at came back sound.
- **AC-12's reachability-not-storage promise is un-misreadable** — five lenses tried and
  only design found a leak, in copy (F6a), not in the rule.
- **AC-16's 2.5.1 clause** (no path-based gesture as the only route to restore or
  delete-forever) is, in design's words, *"the sharpest AC in the set"* — it pre-empts the
  one design defect this surface reliably ships.
- **All fixtures needed for phase 5 are constructible today** — the seed door bypasses
  every write rule. **No seeding gap blocks execution.**

## OQ3 answered by the design lens — **no mark on the menu row**

Counts are *"omitted at zero"*, so a bare row already reads *nothing here*; a dot beside it
is a second signal contradicting the first. **And the mark has no colour available:** all
five accents are assigned, `danger` is reserved for confirm-delete contexts, and
`text.muted` at dot size is not a signal. **This is F-005's design finding D14 exactly —
*"pick an accent from unspent tokens" naming an empty set* — which cost that spec three
revisions to notice.** *The honest options are the count or nothing, and AC-1 already chose.*

## No conflicts

No two lenses gave incompatible directives on the same AC. The nearest thing is design's
*no mark* against product's third-ranked option of a presence mark — and product ranked it
third and design answered the mechanism question, so it is a preference ordering, not a
contradiction.

## One decision reaches the owner

**Product F2** — the aggregate discoverability question. See `## Step 5` in the orchestrator's
report.
