# ADR-009 — Today is a date; `status: 'today'` is retired

**Status:** accepted · 2026-08-18 · product owner (decision), architect-agent
(write-up)
**Feature:** cross-cutting (`task` entity; the Tasks surface feature is not yet
specced — see § Who owns the ACs)
**Amended:** 2026-08-18 (T-126, architect-agent) — **a fourth bucket,
`upcoming`, joins the collection set, and overdue folds into Today.** All four
collections are now date predicates. This **strengthens** the ADR's core claim —
*Today is a date, not a status* — by extending it to the one collection that was
still not a date filter. It reverses nothing. The Decision is amended in place at
§2, §4 and § Consequences; see **§ Amendment (2026-08-18)** at the end for what
moved, what did not, and the measured cost.
**Amended again:** 2026-08-18 (T-137, architect-agent) — **Inbox is the tasks
filed into no personal list, not the tasks with no date.** This is the correction
the previous amendment's shape could not absorb: Inbox stops being a member of
the date partition and becomes the first cell of a **second, independent axis**.
The collection set is no longer one partition with four cells; it is a *date*
axis and a *filing* axis over the same open tasks. Amendment 1's predicate table
is annotated in place — it describes the date axis correctly and always did — and
the structural statement is in **§ Amendment 2 (2026-08-18)** at the end.
**Source of record:** `docs/reports/owner-decision-2026-08-18-today-is-a-date.md`,
which sharpens `docs/reports/owner-decision-2026-08-18-landing-and-collections.md` §2.
Amendment 1's source of record is
`docs/reports/owner-decision-2026-08-18-four-buckets.md`; Amendment 2's is
`docs/reports/owner-decision-2026-08-18-inbox-is-unfiled.md`.

## Context

The owner asked a question the shipped model does not survive: *if a task has no
date, how would you know it is today?*

`dueToday` in `src/assistant/_shared/model/tasks.ts:86` reads

```ts
return t.status === 'today' || isToday(t.due_at, now)
```

so **Today means two things at once** — a date bucket and a status bucket. The
status leg is the half that cannot answer the owner's question, and it is the
half that made the mid-day landing shape underivable: a dateless task on Today
loses every marker the instant it is ticked, because `toggleTask` overwrites the
only thing that said "today".

The owner's model:

1. Today is exactly the tasks whose `due_at` is today. No status leg.
2. Creating a task while viewing Today sets `due_at` to today.
3. A task with no date is never in Today — open or done.
4. "Done today" is `status: 'done'` **and** `due_at` today.

**The owner decided behaviour. The schema disposition is this ADR's job**, and
the source of record says so in as many words.

## What the decision buys, and it is more than the landing summary

`due_at` survives completion untouched — `toggleTask` writes only `status`, and
`PATCH /tasks/{id}` writes only the fields sent. So once membership is the date:

- **`done_today` becomes derivable with no new field.** `docs/design/_shared/components.md`
  § "The one shape that is blocked" routed this to a new `task.completed_at`
  column and a migration; it is no longer needed. (What the derivation actually
  measures is *not* what that section wanted — see § Consequences.)
- **The un-complete divergence dissolves rather than needing a fix.**
  `uc-coverage-map.md` D6 records that `controller.toggleTask` sends every
  un-ticked task to Today unconditionally, against UC-45 AC-45.2's requirement
  that it return to the list it came from — a divergence that was going to cost a
  `doneFrom` field. Once the collection lives in the date, the date is still
  there after the round trip: un-ticking a task dated today puts it back on
  Today, and un-ticking a dateless task puts it back in Inbox, which is where it
  was. **AC-45.2 is satisfied by construction, by removing something.**

## Options considered

### For the `'today'` member of `TaskStatus`

1. **Remove the member; migrate live rows *and* every historical record.**
   Rejected. `data/assistant.json` holds 4 `undo_snapshot` entries and 4 `diff`
   rows carrying `'today'`. `undo_snapshot` is replayed **verbatim** into the
   store by undo, and `diff` is what the user is shown a turn did. Rewriting
   them to make a type check pass means the app claims a turn changed
   `inbox → done` when it changed `today → done`. Falsifying history to tidy an
   enum is the wrong trade in a product whose ACs are about not bluffing.
2. **Split the type: `TaskStatus` (live) vs `StoredTaskStatus` (live + legacy).**
   Rejected on cost, not on principle — it is the technically correct shape.
   `TaskRow` is used for both live rows and historical snapshots, so the split
   has to be threaded as a parameter through `TaskRow`, `undo_snapshot`,
   `Question.ask_snapshot`, `post_apply` and the wire types. That is a
   type-system change across the whole module to express one legacy member.
   Revisit only if a second legacy value ever appears.
3. **Keep the member; retire it by vocabulary, not by deletion.** *Chosen.*

### For the 4 live rows carrying `status: 'today'` with no date

1. **Migrate them to `due_at = today` to preserve their Today membership.**
   Rejected. It invents a date the user never set, and the next day those 4 rows
   become **overdue** — which `docs/design/_shared/components.md` selection rule 3
   ranks above everything except an empty list. A silent migration would make the
   app open with `LSM-OVERDUE`, its loudest frame, about a date it made up.
2. **Migrate them to `status: 'inbox'`, leaving `due_at` null.** Rejected, but
   narrowly — see § The migration that is deliberately not run.
3. **Leave them.** *Chosen.*

## Decision

### 1. Today is `isToday(due_at, now)`. Full stop.

`dueToday` loses its status leg. `now` is the **device clock**: Today is computed
client-side, and the server never buckets tasks by date — it stores an instant
and serves it. That is already true and is written down here because the new
model makes it load-bearing rather than incidental.

### 2. `TaskStatus` keeps four members; `'today'` becomes a **record-only legacy value**

The union stays `inbox | today | done | archived`. Three vocabularies are now
distinguished, and only the first is a type:

| Vocabulary | Values | Enforced where |
|---|---|---|
| **Write** — what any client, the interpreter or the app may *set* | `inbox \| done \| archived` | `TASK_STATUSES` in `src/assistant/api/app.ts`; `POST /tasks`, `PATCH /tasks/{id}` → `400 INVALID_INPUT` on `today` |
| **Live** — what a non-deleted row may *hold* | the write vocabulary, plus 4 pre-existing rows carrying `today` | not enforced; drains naturally |
| **Record** — what `undo_snapshot`, `ask_snapshot`, `post_apply` and `diff.old/new` may hold | all four | never narrowed; these are past states |

**The reason retention is cheap is the whole point of the change: after the
status leg is gone, a `'today'` value is inert.** Nothing branches on it.
`inCollection(t, 'inbox')` is "not done **and undated**" → the row shows in
Inbox; `inCollection(t, 'today')` is the date → it does not show in Today;
`done` → no. A row that undo resurrects with `status: 'today'` lands in Inbox and
behaves exactly like an `inbox` row. There is no code path left for it to be
wrong on.

*(Amended 2026-08-18: Inbox's predicate narrowed from "not done" to "not done and
undated". The inertness claim survives unchanged because **all four rows carry no
date** — re-measured against `data/assistant.json` at the amendment, § Amendment
§ What did not change. Had any of them been dated, the four-bucket model would
have moved it to Today or Upcoming and this paragraph would have needed a
different answer.)*

**The tension this creates, named rather than hidden.** `docs/specs/_source/todo-ai/02-use-cases.md:911`
argues for dropping `archived` from the client union because "a state nobody
assigns is a dead promise in a type" — and by that reasoning `today` should go
too. The distinction is that `archived` was never written and is nowhere in the
store, while `today` is in 8 historical records that undo can replay. **A type
has to be able to express what the store already contains.** `archived`'s
disposition is untouched by this ADR and is still open.

### 3. Un-completing writes `status: 'inbox'` and does not touch `due_at`

`controller.ts:574` currently reads `task.status === 'done' ? 'today' : 'done'`.
Under this model that line is wrong twice over — it writes a status that means
nothing, **and** it fails to put the task in Today, because a dateless task with
`status: 'today'` is no longer in Today. Both halves are fixed by one change:

```ts
const nextStatus = task.status === 'done' ? 'inbox' : 'done'
```

`due_at` is not written on either leg, which is what makes the round trip
lossless and satisfies UC-45 AC-45.2 without a `doneFrom` field.

### 4. Creating a task in a collection sets the **date**, not the status

Confirming and sharpening `owner-decision-2026-08-18-landing-and-collections.md` §2:

| Created while viewing | `status` | `due_at` |
|---|---|---|
| Today | `inbox` | **the local start of today**, serialized as an ISO instant |
| **Upcoming** | `inbox` | **open — not decided here.** Amended 2026-08-18; see § Amendment § The one cell this amendment refuses to fill |
| Inbox | `inbox` | `null` |
| Done | `inbox` | `null` — same as Inbox; see below |

**`due_at` is a timestamp and "today" is a day, so the instant must be stated or
two clients will pick differently** and the same task will group differently on
web and mobile. It is the **local start of day**, not `now`: "on Today" is a
commitment to a day, and `now` would render as a time-of-day commitment the user
never made. Ordering within the Today group is unaffected — this repo orders by
`created_at` (`uc-coverage-map.md` D5), not by `due_at`.

**Creating while viewing Done** has no sensible reading — a task cannot be
created already finished, and creating it *dated today* would make it appear in a
collection the user is not looking at. It creates an Inbox task, which is the
existing behaviour and the only one that strands nothing (Inbox is a superset of
every open task). Whether the composer should be offered on Done at all is a
design question, not this ADR's.

*(Amended 2026-08-18: the parenthetical is now false — Inbox is the undated
tasks, not a superset. The conclusion is unchanged and its reason is better: a
task created with no date belongs in Inbox because Inbox **is** "no date yet",
rather than because Inbox catches everything. Reachability no longer follows from
Inbox alone; see § Amendment § Nothing is stranded — but the argument is new.)*

### The migration that is deliberately not run

The 4 live rows carrying `status: 'today'` with no date **are left alone.**

Under the new predicate they leave Today and appear in Inbox — a **user-visible
data change**, and the only one this decision causes. That change happens the
moment `dueToday` loses its status leg, whether or not anything is migrated;
rewriting the rows does not prevent it and does not soften it.

What migrating *would* add, on top of a change that has already happened:

- **It breaks undo on 4 turns.** AC-7's modified-since check compares a task's
  current state against that turn's `post_apply` entry. A migration write is a
  write like any other and undo cannot tell it from a user edit, so 4 turns that
  are undoable today would report `modified_since_apply` afterwards. The
  migration converts a no-op into a user-visible regression.
- It is a write against user data for **zero observable difference**, since an
  inert `'today'` renders identically to `inbox` everywhere.

What not migrating costs: `status: "today"` stays on the wire in `GET /tasks` for
4 rows, where a future reader could mistake it for meaningful. That is paid down
by the line in `data-model.md` saying the value is inert and never written, and
it drains by itself — the next edit or completion of each row overwrites it.

**This was the genuinely open call in this ADR**, and it is close. If the store
is ever reset (`data/assistant.json` is prototype-grade, ADR-001) the question
disappears with it.

## Consequences

- **Good.** `done_today` is derivable with no new field and no migration;
  `LSM-PROGRESS` becomes selectable. The un-complete divergence (D6) dissolves.
  Today means one thing, and it is a thing a user can point at.
- **Good.** Nothing is stranded. A task that leaves Today lands in Inbox, which
  is every unfinished task — the property `F-001` AC-24 leans on.
  *(Amended 2026-08-18: the premise is retired. Inbox is no longer every
  unfinished task, so reachability is now a property of the **four buckets being
  total**, not of one superset — and it therefore depends on Upcoming being
  rendered. § Amendment § Nothing is stranded — but the argument is new.)*
  *(Amended again 2026-08-18: that premise is retired too. Reachability is a
  property of the **filing axis being total** — every open task sits in Inbox or
  in a list, and every cell of that axis is openable. It is the first of the
  three reasons that depends on no date predicate at all. § Amendment 2 § 6.)*
- **Bad, accepted.** `done_today` derived as `status: 'done' && isToday(due_at)`
  is **"was due today and is done", not "was completed today"**, and
  `LSM-PROGRESS`'s copy — *"You've finished {count} today"* — claims the second.
  Two real states break it: a task due today and ticked last night is counted;
  a task due yesterday and ticked this morning is not, though it is the day's
  clearest achievement. The owner defined the fact this way deliberately (source
  of record, point 4), so this is not a derivation error — but the **frame
  wording now over-claims**, and under F-001 AC-14/AC-15 that matters. Design
  owns the wording; this ADR owns naming the gap. `task.completed_at` remains
  the only field that makes the frame's current sentence true, and it is now a
  *copy* decision rather than a blocker.
- **Bad, accepted.** Narrowing the write vocabulary means a **stale client**
  — a tab still running the pre-change bundle — un-ticks a task and gets
  `400` from `PATCH /tasks/{id}`. `toggleTask` dispatches optimistically and
  ignores the response, so that client shows the task un-ticked while the server
  does not, until the next `refreshTasks`. The window is one page load wide and
  it fails loudly on the server, which is preferable to silently minting new
  inert rows forever. Rejected alternative: accept `today` on the wire and
  normalise it to `inbox`, which keeps a translation rule alive permanently for a
  value nothing should ever send.
- **Neutral.** `Collection` in `src/assistant/_shared/model/tasks.ts:36` is
  `inbox | today | done` and is **not** `TaskStatus`. It is a view, it keeps all
  three members, and `'today'` there stays fully meaningful. The two sets share
  names and nothing else; **changing one must not touch the other.**
  *(Amended 2026-08-18: `Collection` gains a fourth member, `upcoming`.
  `TaskStatus` is **not** touched — it is still the same four members with the
  same three vocabularies, and it gains nothing named `upcoming`. This bullet's
  rule is what makes that safe, and the amendment is its first exercise: one set
  changed and the other did not.)*
- **Neutral.** `DEFAULT_COLLECTION` in the same file is `'inbox'`, justified in
  its doc comment by "`addTask` creates every task with `status: 'inbox'` and no
  date, so landing on Today would show a brand-new user an empty list". Both
  halves of that justification are now void — the owner chose Today as the
  default, and add-in-context is what stops the list being empty. The constant
  and its comment change together.

## Who owns the ACs

This ADR and the two contract files it accompanies (`data-model.md`,
`api-contracts.md`) are the **architecture** half. The behaviour needs acceptance
criteria, and they do not belong to F-001: `F-001 ## Out of Scope (this
iteration)` states that
the Tasks surface, its collections and its lists menu are **a separate feature
with its own F-id**, not yet written. Three ACs are owed there —

- Today contains exactly the open tasks dated today; a dateless task is never in
  Today, ticked or not.
- Creating a task while viewing a collection puts it in that collection, by date.
- Un-completing returns a task to the collection it came from, with no new field.

— and the third is UC-45 AC-45.2, which is currently carried only by
`uc-coverage-map.md` D6 as a divergence. **spec-agent owns writing them**;
architect-agent does not author acceptance criteria.

## Sequencing

`docs/specs/` first (this ADR + the two contract files — done). Then design's two
cells in `docs/design/_shared/components.md` (`open_today`'s definition and the
`done_today` row), because implementers and tests read that file as the owning
artifact for the frames. Then the code, in one change: the predicate, the
un-complete line, the create path, the wire vocabulary and the shared fixture
move together — splitting them leaves a window where Today is defined twice.
QA expectations last.

## Amendment (2026-08-18) — `upcoming` joins; all four collections are date predicates

**Trigger.** The owner decision of 2026-08-18,
`docs/reports/owner-decision-2026-08-18-four-buckets.md`, taken the same day as this
ADR and on the same subject: *"Tôi tưởng inbox và today chỉ là filter dựa theo
due date thôi, sao lại phức tạp thế nhỉ?"* — I thought Inbox and Today were just
due-date filters, why is this so complicated? **They were right, and the reason
is in this ADR.** Today was made a date here; Inbox was left as *every open
task*. So one collection was a date filter and the other was a status filter,
and the two were of different kinds — which is exactly what "complicated" felt
like. That was not sloppiness: with three buckets and no home for a future-dated
task, a superset Inbox was the only shape in which nothing fell out. **The
complexity was the symptom of a missing bucket**, and `todo-ai ADR-11` had named
that bucket all along (Inbox · Today · Upcoming · Logbook).

### What changed — the predicate set, in full

| Bucket | Membership | Kind |
|---|---|---|
| **Done** | `status === 'done'` | status |
| **Today** | not done **and** `due_at` is on or before today | date |
| **Upcoming** | not done **and** `due_at` is after today | date |
| **Inbox** | not done **and** `due_at` is `null` | date (its absence) |

**Total and disjoint.** Not-done splits on has-a-date; dated splits on
past-or-today versus future. Every task has exactly one home. Done is still the
one status predicate, and it is the one this ADR never disputed.

> **Read this table as the *date* axis (Amendment 2, 2026-08-18).** Its three
> open rows are still exactly right and still total and disjoint — nothing in
> them is retracted. What is retracted is the name on the third one: that cell is
> **`undated`**, and **Inbox is not it.** Inbox moved to a second axis, so the
> sentence *"every task has exactly one home"* is true of this axis and false of
> the model, which now has two. The correction is structural and is **not**
> written here as an exception to a partition — see **§ Amendment 2**.

**Both dated predicates compare local calendar days, not instants, and this has
to be written down or the set is not total.** `due_at` is a timestamp and a
bucket boundary is a day. If Today were read as `due_at <= now`, a task dated
today at 17:00 would be in Today only after 17:00 — and it would not be in
Upcoming before then either, because its *day* is not after today. The set would
leak between midnight and the due time. The comparison is therefore
day-granular against the same device clock §1 already fixes:

```
todayCollection(t, now) = t.status !== 'done' && t.due_at !== null && localDay(t.due_at) <= localDay(now)
upcoming(t, now)        = t.status !== 'done' && t.due_at !== null && localDay(t.due_at) >  localDay(now)
inbox(t)                = t.status !== 'done' && t.due_at === null
done(t)                 = t.status === 'done'
```

`isToday` in `src/assistant/_shared/model/tasks.ts` is already day-granular
(it compares year/month/date), so the new predicates are its `<=` and `>`
siblings and belong beside it — one home per fact (L-004).

### This strengthens §1; it does not reverse it

Read quickly, "Today now includes yesterday's tasks" can look like a retreat from
*Today is a date*. It is the opposite. Before this amendment **three of four
collections were dates and Inbox was a status**; after it, **all four are date
predicates** and `status` participates in exactly one of them — the one that is
genuinely a status. §1's sentence, *Today is `isToday(due_at, now)`, full stop*,
is widened to `<= today` and otherwise stands: no status leg, computed on the
device clock, server has no opinion about which day it is. The claim this ADR was
written to make is now true of the whole collection set instead of one member of
it.

### 1. `Collection` gains `upcoming`. `TaskStatus` does not change at all

`Collection` in `src/assistant/_shared/model/tasks.ts` becomes
`'inbox' | 'today' | 'upcoming' | 'done'`, and `COLLECTIONS` gains a member.

**`TaskStatus` is untouched by this amendment.** It is still
`inbox | today | done | archived`, still governed by the three vocabularies in
§2, and it gains **nothing** named `upcoming` — there is no such status, no
client may send one, and no row will ever hold one. Upcoming is a view computed
from `due_at`, exactly as Today is.

This is said a third time because the two sets sharing member names is the
confusion this whole thread came out of: `status: 'today'` versus the Today
collection is what made the owner's original question unanswerable, and § the
Neutral bullet in Consequences already carries the rule — *changing one must not
touch the other*. This amendment is that rule's first exercise: `Collection`
changed, `TaskStatus` did not.

### 2. Inbox's meaning changes for existing data — measured, not reassured

Inbox goes from **every open task** to **the undated open tasks**. That is a
user-visible change to what a shipped surface shows, so here is the count rather
than a promise that it is small.

Measured against `data/assistant.json` on 2026-08-18 (device clock `+07`), the
same store §The migration that is deliberately not run measures:

| | Rows |
|---|---|
| task rows in the store | 790 |
| live (not soft-deleted) | 737 |
| live and open | 716 |
| live and done | 21 |
| **open and dated** — these leave Inbox's view | **7** |
| open and undated — these stay in Inbox | 709 |

**7 live tasks change their visible bucket.** All 7 leave Inbox for Today, and
all 7 do so *because they are overdue*: every dated open row in the store is due
`2026-08-17` — yesterday. Nothing in the store is dated today, and **nothing in
the store is dated in the future**, so:

- **Inbox: 716 → 709** (−7, −1.0%)
- **Today: 0 → 7** — Today was empty in every account before this amendment and
  is not empty after it
- **Upcoming: 0** — the new bucket has **no members anywhere in the store**
- **Done: 21**, unchanged

The 7 rows are one seeded `Call mom` each in 7 accounts (`a2ff22a6-…`,
`flowA-demo`, `shot-msx2ej4u`, `bug-msx4nu2i`, `v2-msxjcj7d-desktop`,
`v2-msxjdvlv-desktop`, `v2-msxjdvlv-mobile`). **Per account the change is: Inbox
−1, Today 0 → 1, and the `Tasks · N` badge 0 → 1.** No account loses more than
one row from Inbox.

Two things follow that are worth more than the number:

- **Upcoming cannot be observed from live data.** Its first member has to be
  created. QA cannot verify the bucket by reading the store and must seed a
  future-dated task; a suite that only replays this store will report Upcoming
  green while never having rendered a row in it.
- **Every bucket change in the store is an overdue one.** So the overdue fold
  below is not an edge case here — it *is* the whole observable effect of the
  amendment.

### 3. Overdue folds into Today, deliberately — recorded so nobody "fixes" it

A task whose date has passed is in **Today**, not in a separate overdue surface
and not stranded in the past.

**Today therefore means "needs attention now", not literally "dated today".**
That is a deliberate widening of the word, chosen on the argument that a task
which vanishes from view is how it gets forgotten — the alternative shapes
(a fourth surface for overdue, or leaving overdue in a date-ordered Upcoming
tail) both put missed work somewhere the user is not looking. The owner chose
this; it is not a rounding error in the predicate, and narrowing Today back to
`isToday` at some later tidy-up would silently hide missed tasks.

**Rejected here, as it was in § Options considered:** migrating overdue rows'
dates forward to keep "Today" literal. It invents dates the user never set, and
this ADR already rejected that move for the 4 dateless rows for the same reason.

### Nothing is stranded — but the argument is new, and it is now a dependency

> **Superseded by § Amendment 2 § 6 (2026-08-18).** This section's *requirement*
> stands — Upcoming must be reachable, or a future-dated task cannot be opened as
> a dated task — but it is **no longer what carries AC-24**. Inbox is not a date
> cell at all now, it holds every open task again, and reachability is a property
> of the **filing** axis. The reasoning below is kept because it is the record of
> the second of three reasons, and because the requirement it derived survives
> the reason that derived it.

The old reachability argument was *Inbox is a superset of every open task*, and
`F-001` AC-24 leans on it. **That argument is gone**, because Inbox is now a
strict subset. Reachability now rests on a different property: the four buckets
are **total**, so every open task is in exactly one of Today, Upcoming or Inbox.

Totality is only reachability **if all three are reachable**. Concretely:
`docs/design/_shared/components.md` § ListsMenu draws LM-COLLECTION as three rows,
`Inbox · Today · Done` (and still sources them from `task.status`, which §1
already retired). **If a fourth row for Upcoming is not added, a future-dated
task is in no collection the user can open, and AC-24's reachability bound
breaks — silently, because nothing errors.** Under the old model a future-dated
task was in Inbox and the missing row cost nothing; under this one it is the
difference between reachable and invisible.

This is architecture stating a requirement, not design stating a layout: *the
Upcoming collection must be reachable from the Lists menu*. What the row looks
like, what it is called and where it sits are design's.

### What this disturbs downstream — checked, not assumed

**The landing summary, `docs/design/_shared/components.md` § LandingSummary.** Design
owns every call below; this is the fact-set they should decide against, because
three of them are arithmetic rather than taste.

- **`open_today`'s value changes.** It is defined as
  `collectionCount(tasks, 'today', now)` — the same call as the PathSwitch badge
  — and that call now includes overdue. So **`overdue ≥ 1` implies
  `open_today ≥ 1`**, where the two were previously disjoint.
- **Selection rule row 4 becomes unreachable.** Row 4 is
  `overdue ≥ 1 and open_today = 0` → LSM-OVERDUE. Its condition is now
  unsatisfiable, so **LSM-OVERDUE can never be selected** and every overdue state
  routes to row 3, LSM-OVERDUE-TODAY. The rule table stays total; one of its rows
  becomes dead. § "The rule is total, and that is the property to test" asks that
  a change re-prove totality rather than add a row — this is that re-proof, and
  it finds a row to remove rather than one to add.
- **LSM-OVERDUE-TODAY's copy stops being arithmetically true.** Its second count
  is described as *"the unnamed of the two counts"* and rendered as
  `{count_secondary} more due today`. If `count_secondary` is `open_today`, the
  overdue tasks are counted twice and the word *more* claims a disjointness that
  no longer holds. **In the live store today this frame would read "7 tasks are
  past their date: … 7 more due today."** The fix is a definition, not wording:
  `count_secondary = open_today − overdue`.
- **The premise design argued row 3 from has changed, and the conclusion still
  holds.** The argument was that a rule keyed on `open_today` alone would
  congratulate a user with overdue work, because `open_today` did not see them.
  It now does. Ranking overdue first is therefore no longer *necessary* to avoid
  misinforming — but it is still the only way the summary **names** the overdue
  tasks rather than folding them anonymously into a count, which § "The named set
  is always the counted set" requires. Design's call; the safety argument that
  motivated it has been absorbed into the predicate, and what remains is a
  choice about naming.
- **`open_all` breaks, and this one is not a wording question.** It is defined as
  *every unfinished task* with source `collectionCount(tasks, 'inbox', now)` —
  an identity that held only while Inbox was a superset. It no longer is, so
  **that expression now returns the undated tasks only**. Left unchanged, a user
  whose tasks are all future-dated has `open_all = 0`, `open_today = 0`,
  `overdue = 0` → selection rule 1 or 2 fires and the app says **"All done — your
  list is clear."** to someone with a full week ahead. That is the exact class of
  misinforming the overdue rule exists to prevent, arriving through a new door.
  The fact is still the one the rule needs; the **source must become the count of
  Today + Upcoming + Inbox**, not the Inbox count.
- **And fixing `open_all` makes LSM-CLEAR-TODAY's copy over-count** — a knock-on
  worth naming so it is not discovered later as a regression caused by the fix.
  Row 8 renders `open_all` as *"{count} tasks are waiting in Inbox."* At row 8
  both `open_today` and `overdue` are 0, so a corrected `open_all` is
  `upcoming + inbox` — and future-dated tasks are not "waiting in Inbox". The two
  needs are different numbers: **the selection rule needs every open task
  (totality), the copy needs the Inbox count.** They were the same number only
  while Inbox was a superset. This is one fact splitting into two, which is
  L-004's shape read forward: give each a name and one home rather than letting
  one expression serve both.
- **`done_today` is unaffected.** It is `status: 'done'` and `due_at` today, a
  separate predicate from the Today collection, and the over-claim this ADR's
  § Consequences records is neither worsened nor fixed here.

**The `Tasks · N` badge** (`openTodayCount`) counts open-today and therefore now
includes overdue. Measured above: 0 → 1 per affected account. Arguably more
honest — it is the number of tasks needing attention — but it is a change in what
the number means, and § PathSwitch's "one number, never a second definition of
it" identity holds only because badge and header are the same call. They still
are.

**Day grouping inside a list, `groupTasks`.** It buckets rows into
`Today / Tomorrow / Later / Anytime` using the same `dueToday`. An overdue row is
not today and not tomorrow and has a date, so it lands in **`Later`** — a header
that reads as *after tomorrow*. Rendering the Today collection would therefore
put its overdue members under a heading claiming they are in the future. The
decision record does not anticipate this. It needs either a leading `Overdue`
group or an absorption of overdue into the `Today` group; **this is design's
call** (it is a heading and its words), but it cannot be left as-is, because the
current output is not merely unhelpful, it is false.

**`DEFAULT_COLLECTION` stays `'today'`** and its justification survives intact —
it changed with this ADR and does not change again. One note: Today is now
non-empty for reasons other than add-in-context, which makes the constant's
choice easier, not harder.

**`COLLECTIONS` order** is what the Lists menu renders in. Architecture's only
requirement is that Upcoming appear (§ Nothing is stranded); the order —
`today · upcoming · inbox · done` reads as by-urgency and is the natural
extension of the current `today · inbox · done` — is design's to confirm.

### The one cell this amendment refuses to fill

**Creating a task while viewing Upcoming has no derivable date, and none is
invented here.**

§4 fixed *creating in a collection puts it in that collection, by date*, and for
Today the instant was derivable: the collection is one day, so the honest instant
is that day's local start. **Upcoming is not one day.** Its predicate is
`due_at > today`, which names no instant. Two answers exist and both cost
something real:

1. **The local start of tomorrow** — the least-committal instant satisfying the
   predicate. Keeps §4's principle exactly: the task appears in the collection
   you created it in. Costs a date the user did not say, which is the objection
   the owner raised against every earlier date-inventing option in this thread,
   and it would put the task in Today by tomorrow morning.
2. **`null`, with the composer telling the user it landed in Inbox** — invents
   nothing, and breaks §4: the task is not in the collection you created it in,
   and it disappears from the surface at the moment of creation.

There is a third possibility that dissolves the question — Upcoming may simply
carry no composer, which is coherent given that it is the one collection with no
default date. **That is design's call and it should be made explicitly.**

The refusal is deliberate. Note the shape: removing Inbox's superset behaviour
exposed a cell that had no specified answer, and the corollary in L-008 is to
route such a cell rather than fill it. Until it is decided, the code's current
expression (`c === 'today' ? startOfTodayIso(now) : null`) answers it **by
accident** with option 2 — silently, with no notice to the user. That accidental
answer is why this is flagged rather than left open quietly.

### What did **not** change

- **§1's core claim, its mechanism and its reasons.** Today is a date; no status
  leg; `now` is the device clock; the bucket is computed client-side; the server
  stores an instant and has no opinion about which day it is. Widened from
  `isToday` to `<= today`, unchanged in kind.
- **§2 in full.** `TaskStatus` is the same four members with the same three
  vocabularies. `'today'` is still a record-only legacy value, still rejected on
  the wire, still never minted.
- **§3.** Un-completing writes `status: 'inbox'` and does not touch `due_at`.
  This is what makes the round trip lossless, and it is *more* valuable now:
  a task un-ticked returns to Today, Upcoming or Inbox according to a date
  nobody overwrote, so UC-45 AC-45.2 is satisfied across four buckets by the
  same removal.
- **§4's Today, Inbox and Done rows**, and the local-start-of-day instant with
  its reasoning.
- **§ The migration that is deliberately not run.** Re-measured at this
  amendment: the store still holds exactly **4 live rows carrying
  `status: 'today'`, and all 4 have `due_at: null`.** Under the four-bucket
  predicate they are undated open tasks, so they land in **Inbox** — the same
  place the three-bucket predicate put them. The amendment does not move them and
  does not create a new reason to migrate them. Option 1 in § Options considered
  (migrate to `due_at = today`) is **more** wrong now than when it was rejected:
  the next day those rows would be overdue, and overdue is now inside Today
  rather than merely ranked loudly by the summary.
- **§ Options considered**, left as written. It records the reasoning available
  on 2026-08-18 morning, including a rejected option whose stated cost
  ("those 4 rows become overdue") is what this amendment folds into Today. Rewriting
  it would destroy the record of why retention won.

### The ACs this owes, added to § Who owns the ACs

§ Who owns the ACs lists three ACs owed to the not-yet-written Tasks-surface
feature. This amendment changes the first and adds two:

1. *(revised)* Today contains exactly the open tasks dated **on or before**
   today; a dateless task is never in Today, ticked or not.
2. **Upcoming contains exactly the open tasks dated after today, and is
   reachable from the Lists menu** — the reachability half is AC-24's bound and
   is not optional (§ Nothing is stranded).
3. **The four collections are total and disjoint: every open task is in exactly
   one of Today, Upcoming and Inbox.** This is the property the whole model rests
   on and it is testable directly — for any task and any clock, exactly one
   predicate is true. **— Revised by § Amendment 2, which splits this into 3a
   (the date axis) and 3b (the filing axis). Written as one property it is now
   false: the store holds 7 tasks in Today and Inbox at once.**
4. Creating a task while viewing a collection puts it in that collection, by date
   *(Upcoming's cell pending the decision above)*.
5. Un-completing returns a task to the collection it came from, with no new field
   *(UC-45 AC-45.2)*.

**spec-agent owns writing them**; architect-agent does not author acceptance
criteria.

### Sequencing

`docs/specs/` first — this amendment plus `data-model.md` and `api-contracts.md`,
updated in the same task so the three describe one end state (done). Then
design's cells: `components.md` § LandingSummary (`open_all`'s source,
`count_secondary`'s definition, the dead row 4), § ListsMenu (the fourth row),
and the day-group heading for overdue. Then the code, **in one change**: the
`Collection` union, `COLLECTIONS`, `inCollection`, the day-granular comparison,
`dueAtForCollection`'s Upcoming cell and `groupTasks` move together — splitting
them leaves a window in which the buckets are neither total nor disjoint. QA
expectations last, and QA must **seed a future-dated task**: the store has no
Upcoming member to read.

## Amendment 2 (2026-08-18) — Inbox is *unfiled*; the model has two axes

**Trigger.** `docs/reports/owner-decision-2026-08-18-inbox-is-unfiled.md`. The owner
said *"Inbox nên là các task chưa xong, gồm cả task có ngày hay chưa"* — Inbox
should be the unfinished tasks, dated or not — and then asked the question that
actually decided it: *"các app khác giữ inbox như nào?"*, how do other apps keep
Inbox. Todoist, Things 3, TickTick and OmniFocus agree, and they agree on
something stronger than a default: **Inbox is a container you empty by filing,
never a date filter.** In Todoist it is literally the default project. In all
four, a task is in Inbox *and* in Today at once, because Today is a view and
Inbox is a place. The owner recognised the definition on being shown it and chose
it.

**This is not a correction of a mistake and must not be read as one.** Amendment 1
was right on the evidence it had. With Inbox as the third date cell, three of four
collections were dates and the fourth was a status — the exact asymmetry the owner
had just named as *complicated* — and making all four dates removed it. What that
move could not see is that the word *Inbox* was never on the date axis in the
first place: not in this app, and not in any of the four apps the owner opens
daily. So this amendment narrows no predicate and widens none. It moves one
collection off an axis it was never on, which is why every date predicate
survives it untouched.

### 1. The correction is structural: two axes, not a partition with an exception

Amendment 1's load-bearing sentence — *"Not-done splits on has-a-date; dated
splits on past-or-today versus future. Every task has exactly one home."* — is
now false, and the honest repair is not an exception clause. Grafting *"…except
Inbox, which overlaps"* onto a partition claim would leave the model looking like
a partition with a defect, and the next person to tidy it would remove the
defect.

The model is **two independent axes over the open tasks**, plus one status
predicate that empties both:

| | Cells | Kind | Ships today |
|---|---|---|---|
| **Date axis** | Today · Upcoming · `undated` | views, computed from `due_at` | Today and Upcoming have surfaces; `undated` has none |
| **Filing axis** | Inbox · each personal list | containers, a property of the task | Inbox only — `lists` does not exist |
| **The gate** | Done | the one genuine status | its own surface |

Each axis is **separately total and disjoint** over the open tasks. Together they
are a grid: a task has a date cell **and** a filing cell, and every combination is
legal. The four rows in the Lists menu are therefore no longer four of a kind —
two are views, one is a container, one is a status filter — which is precisely
what Todoist's sidebar is, and why its counts overlap the same way ours now do.

**Amendment 1's predicate table survives as the date axis.** Its three open rows
were correct and stay correct; only the name on the third one was wrong. That
cell is `undated`, and it is not a surface — Inbox was serving it by coincidence,
and stops the moment anything can be filed.

**The date axis is where this model has moved twice in one day; the filing axis
is where it has never moved.** That is not a coincidence and § 5 depends on it:
*when* a task is due is a fact that keeps getting re-cut, and *where a task
lives* is not.

### 2. The predicate set, in full

`localDay` compares calendar days on the device clock, exactly as Amendment 1
fixed it; `dueDayOffset` is the one place a `due_at` becomes a day, and a date no
clock can read still counts as no day.

```ts
// ── the gate ──────────────────────────────────────────────────────────────
done(t)            = t.status === 'done'
open(t)            = t.status !== 'done'

// ── axis A — date. Total and disjoint over open(t). UNCHANGED by this amendment.
day(t, now)        = dueDayOffset(t.due_at, now)   // null ⟺ the row names no day
today(t, now)      = open(t) && day(t, now) !== null && day(t, now) <= 0
upcoming(t, now)   = open(t) && day(t, now) !== null && day(t, now) >  0
undated(t, now)    = open(t) && day(t, now) === null       // no surface of its own

// ── axis B — filing. Total and disjoint over open(t). NEW.
isFiled(t)         = listIdOf(t) !== null
inbox(t)           = open(t) && !isFiled(t)
inList(t, L)       = open(t) && listIdOf(t) === L
```

The four properties that replace *"every task has exactly one home"*, each
testable directly:

- **P1 — date axis total and disjoint.** For any open task and any clock, exactly
  one of `today`, `upcoming`, `undated` is true.
- **P2 — filing axis total and disjoint.** For any open task, exactly one of
  `inbox` and `inList(·, L)` over the existing lists is true.
- **P3 — Done is exclusive of both.** A done task is in `done` and in no cell of
  either axis; `open(t)` gates every predicate above.
- **P4 — the axes are independent.** Every (date cell × filing cell) pair is
  reachable, and no operation on one axis moves a task on the other. This is the
  property that makes "two axes" a claim rather than a description, and it is the
  first thing a re-merge breaks.

**What `inbox(t)` is today.** `lists` and `tasks.list_id` do not exist
(`information-architecture.md` §7; `docs/design/_shared/components.md` § ListsMenu
draws LM-LIST and records it as unbuildable). So `listIdOf(t)` is `null` for every
task, `isFiled(t)` is `false` for every task, and **`inbox(t)` reduces to
`open(t)` — every open task.** That is exactly the list the owner asked for. The
definition and the list are the same set right now, and they look different only
because the definition names a door this app has not built.

### 3. The cell where a wrong choice is cheap now and expensive later: `list_id`

Two shapes were available. **The recommendation is neither of the two the
briefing named**, and the difference matters, so all three are stated.

**Rejected — ship a `list_id` concept now, absent everywhere, always `null`.**

1. It is the dead promise this ADR already refused once. § 2 records the tension
   from `docs/specs/_source/todo-ai/02-use-cases.md:911` — *"a state nobody assigns is
   a dead promise in a type"* — and retained `'today'` only because the store
   already contains it. `list_id` has the opposite defence: nothing contains it,
   nothing would ever set it, nothing would ever branch on it.
2. **It cannot stay off the wire.** `task` is served by `GET /tasks` and accepted
   by `POST /tasks` and `PATCH /tasks/{id}`. A field on the entity is a field on
   the wire, and a field on the wire needs a rule for a client that sends one —
   a write-vocabulary rejection, its `400`, its contract entry and its tests, all
   for a field with exactly one legal value.
3. **It pre-commits a decision nobody has taken.** Personal lists are UC-41, the
   owner's headline gap and the largest blast radius on the whole list
   (`uc-coverage-map.md` § 2): a `lists` table, ownership per user, delete
   cascade, a default list, UC-48's export envelope, and interpreter context
   under AC-41.4. Whether the task carries a nullable `list_id` or the relation
   lives elsewhere is not knowable today — and if this ADR ships the column, this
   ADR will be cited as having decided it.
4. It buys nothing observable, which is the test this ADR already applied to the
   4-row migration and answered the same way.

**Rejected — express Inbox as `inbox(t) = open(t)` with the filing definition
recorded in prose.**

- It is **token-identical to `open_all`'s membership test.** Two facts written
  the same way are one fact to every reader, every grep and every reviewer, and
  merging them is § 5's trap arriving through the predicate instead of through
  the summary.
- It records the *list* and loses the *definition*, throwing away the entire
  value of the owner's choice: an Inbox defined by filing narrows by itself when
  lists ship; an Inbox defined as `!done` narrows by nobody, and the rule gets
  re-litigated a fourth time.
- The fact *this task is unfiled* would have no home and would be re-derived at
  every call site the day lists land (L-004).

**Chosen, and what I would defend in review — one named predicate, no field.**

`inbox(t) = open(t) && !isFiled(t)`, where `isFiled` is a named function in
`src/assistant/_shared/model/tasks.ts` whose answer today is `false` for every
task **because the filing axis has exactly one door and this app has not built
it.** No entity field, no schema, no migration, no wire change, no new status.
The predicate on screen reads as the definition; the equality with `open_all` is
visibly a *consequence* of `isFiled` being constant rather than a definition; and
when lists ship, one function body changes and Inbox narrows without anything
else moving.

**One constraint architecture does impose, and it is the half that makes § 5
enforceable: `isFiled` must be answerable `true` in a test today.** A predicate
whose only reachable answer is `false` cannot be exercised, and an invariant with
no failing case is unproven rather than passing (`run-scenarios.sh mutation`'s
rule; L-003's shape). Whether that seam is a parameter, a module boundary or a
structurally-typed key on the argument is the implementer's call. **That it
exists is not**, and a `isFiled` hard-wired to `return false` fails this
requirement even though it satisfies every other line above.

### 4. Measured against `data/assistant.json` — not reassured

Same store and same method as Amendment 1 § 2, re-run at this amendment. Device
clock `+07`; device day **2026-08-18**.

| | Rows |
|---|---|
| task rows in the store | 790 |
| live (not soft-deleted) | 737 |
| live and open | 716 |
| live and done | 21 |
| open and dated | 7 — all due `2026-08-17`, i.e. **all overdue** |
| open and undated | 709 |
| rows carrying a `list_id` | **0 — the key is absent from all 790 rows** |

| Collection | Before (Amendment 1) | After (this amendment) | Δ |
|---|---|---|---|
| **Inbox** | 709 | **716** | **+7** |
| **Today** | 7 | 7 | — |
| **Upcoming** | 0 | 0 | — |
| **Done** | 21 | 21 | — |

**7 rows change bucket, and every one of them changes by *gaining* a
membership.** No row leaves any collection: this amendment is purely additive.
The 7 are the same seeded `Call mom` rows that left Inbox this morning
(`a2ff22a6-…`, `flowA-demo`, `shot-msx2ej4u`, `bug-msx4nu2i`,
`v2-msxjcj7d-desktop`, `v2-msxjdvlv-desktop`, `v2-msxjdvlv-mobile`); they return
to Inbox and **stay in Today**. Per affected account — 7 of the 193 accounts
holding live tasks — the change is: Inbox `+1`, Today unchanged at 1, `Tasks · N`
badge unchanged.

Three things the number says that the number alone does not:

- **The store now shows a non-empty intersection for the first time.**
  `|Inbox ∩ Today| = 7`; `|Inbox ∩ Upcoming| = 0`, and it stays 0 until something
  is dated forward. Under every previous model every intersection was empty. **A
  suite that asserts disjointness across collections now has 7 live
  counterexamples** — see § 6.
- **The collection counts no longer sum to a headcount.** 716 + 7 + 0 + 21 = 744
  against 737 live rows. The Lists menu's column is a set of overlapping
  memberships, not a partition of the account, and 7 rows are counted twice in it
  today.
- **The day's arc closes where it opened.** Inbox 716 → 709 → **716**; Today
  0 → 7 → **7**. The morning's move is reversed and the afternoon's is kept, which
  is the whole shape of the three decisions: Today gained a date, Inbox gained a
  meaning, and only one of the two ever had to move.

**`open_all` and `inbox_count` are exactly equal today** — 716 = 716 globally,
and equal in every one of the 193 accounts, with no account showing a
discrepancy anywhere. That total coincidence is § 5's subject and is why a note
alone would not survive it.

**The 4 legacy `status: 'today'` rows, re-measured a third time:** still 4, still
live, still open, **still all undated**. They are in `undated` on the date axis
and in **Inbox** on the filing axis — the same place the three-bucket predicate
and the four-bucket predicate both put them. § 2's inertness claim survives its
third measurement unchanged, and this amendment creates no new reason to migrate
them.

### 5. INV-INBOX-FILING — the equality that must never become a definition

> **INV-INBOX-FILING.** `open_all` counts every open task. `inbox_count` counts
> the open tasks in the Inbox **container**. Their equality holds while and only
> while no task is filed. It is a **reading of the store, never a definition**,
> and neither number may be sourced from the other.

Its home is `docs/specs/assistant/data-model.md § INV-INBOX-FILING` — this ADR is the
reason, that file is the contract, and one fact does not get two homes (L-004).

The risk is concrete and it has already happened once in reverse.
`docs/design/_shared/components.md` § LandingSummary split these two facts this
morning (T-128) precisely because they had *stopped* being equal. This decision
makes them equal again, exactly, in every account. Someone will notice, and
re-merging them reintroduces the bug the split was made to fix: a user with a
full week ahead told **"All done — your list is clear."**

**Three things carry the invariant, and the note is the weakest of them.** It is
listed last on purpose.

1. **The two expressions are not written the same.** `inbox` is
   `open(t) && !isFiled(t)`; `open_all` is the sum of the three date cells. There
   is no moment at which a reader meets one expression twice and concludes it is
   one fact. This is the only guard that works without anyone remembering the
   rule, and it is the reason § 3 rejected the shorter predicate.
2. **A test that can fail today.** Hand `inCollection` a task the filing seam
   reports as filed, and assert **both** halves: it is *not* in Inbox, and it is
   *still* in its date collection. That test fails against a re-merged
   `inbox(t) = open(t)` — on the first assertion — and it also fails against an
   implementation that "resolves" the new overlap by dropping the row out of
   Today, which is the other way this gets broken. It is the only artifact here a
   re-merge cannot walk past, and it is why § 3 requires `isFiled` to be
   answerable `true`. Without that seam the test cannot be written, and the
   invariant is **unproven rather than passing**.
3. **The note** — in this ADR, in `data-model.md`, and, when design rebinds the
   summary's counts, in `components.md` § LandingSummary, which is the physical
   place a re-merge would land.

**What a reviewer hits.** The invariant has a name, so any change to either count
has to say which of the two it is changing. A diff that makes the two expressions
identical does not need to be caught by eye — it fails (2).

### 6. AC-24's third reason, stated plainly

**AC-24 has two halves, and only one of them has been moving.** Separating them
is overdue, because conflating them is part of how the reason changed twice
unnoticed:

- The **surface** half — rev 4's note: from every conversation failure state, the
  by-hand list is reachable in at most one action. **Untouched by any of this**,
  and untouched by both previous amendments.
- The **set** half — the word *full* in *"the full todo list remains usable by
  hand"*: every open task is reachable by hand once you are there. This is the
  half ADR-009 has now given three reasons for.

**The current reason, and it is the third:** the **filing axis is total, and
every cell of it is openable from the Lists menu.** Today that axis has exactly
one cell — Inbox — it contains every open task, and it is a row in LM-COLLECTION.
The bound therefore holds **with no dependency on any date predicate at all.**

**Why this one should outlast the two that broke, stated as a reason and not as
a hope.** Both previous reasons were properties of the *date* axis:
Inbox-as-superset was a claim about one date cell, four-buckets-total was a claim
about the whole of it. The date axis is the thing that has been re-cut twice in
one day. The filing axis is where *can the user open this* actually lives — a
task is reachable because it sits in a container that has a row, not because of
when it is due. Reachability was tied to the wrong axis, which is why it kept
coming untied. Amendment 1's dependency (**the Upcoming row must exist**) is not
retracted — Upcoming still needs its row or a future-dated task is unreachable
*as a dated task* — but it is no longer what carries AC-24, because such a task
is also in Inbox.

**Is an undated task inside a personal list reachable, post-lists? Yes — through
exactly one door: its list.**

- It is in **no date collection with a surface.** Its date cell is `undated`,
  which has no row of its own and never had one; Inbox was serving that cell by
  coincidence and stops serving it the moment the task is filed.
- It is **not in Inbox.** That is what filing means.
- It is in `inList(·, L)`, and LM-LIST is that row.

**So post-lists the bound converts into a hard requirement on LM-LIST: every list
a task can be filed into must render a row.** A list that exists and is not drawn
strands every undated task in it, silently and with nothing erroring — the same
shape as Amendment 1's Upcoming-row requirement, one axis over. Written down in
advance because the previous two versions of this dependency were both found
after the fact.

**This is normal, not a gap.** An undated task in a project is found in the
project, in Todoist, Things and OmniFocus alike. What is worth stating is the
consequence for this app: it has no *"show me everything undated"* view, and
after lists it will not have one. Today Inbox looks like that view; it will stop
being it, and nobody should read that as a regression.

### 7. What this disturbs downstream — reported, not fixed

Design owns every call below and this amendment briefs them; per its scope it
**reports and does not fix**. Three are arithmetic rather than taste.

- **§ TaskList, "Which collections group at all" — Inbox's row rests on a premise
  that is gone.** It reads *"Inbox **is** 'no date', so `Anytime` is true of
  every row it can ever hold"* and sets grouping to `none — flat`. Inbox can now
  hold overdue, today-dated and future-dated rows, and can produce all five
  groups. In the live store it holds **7 overdue ones today**, and § TaskList's
  own *"One signal, not two"* rule put lateness in the group heading and nowhere
  else — so a flat Inbox does not merely miss a grouping, it renders those 7 late
  tasks with **no lateness signal anywhere on the surface every account opens**.
- **§ ListsMenu, LM-COLLECTION — the `Source` cell is now wrong for one of its
  four rows.** It reads *"the four date predicates of ADR-009 § Amendment"*;
  Inbox is not a date predicate. Two further consequences the row does not carry:
  the four rows are no longer four of a kind (two views, one container, one
  status filter), and **the counts nest** — Inbox's number contains Today's and
  Upcoming's, so the column sums to nothing (measured: 744 against 737 live
  rows). Whether Inbox sits with the views or heads the lists section is a real
  question now; the reference apps separate the two groups visually and
  § ListsMenu's LM-COLLECTION / LM-LIST / LM-ACTION split is already the seam.
- **§ LandingSummary, `inbox_count` — one name, two facts, differing by
  `open_today + upcoming`.** It is defined as *"open tasks with no date at all"*,
  which is now the `undated` cell and **not** the Inbox container. Both numbers
  are wanted: LSM-CLEAR-TODAY's *"{count} tasks are waiting in Inbox"* is a claim
  about a place and wants the container; the selection rule wants whichever it
  actually means. This is L-004's shape and the identical split § LandingSummary
  already performed once today on `open_all`.
- **§ LandingSummary, LSM-CLEAR-AHEAD is now unreachable — arithmetic.** Row 8
  branches on `inbox_count = 0`. If `inbox_count` means the Inbox container, then
  `inbox_count = 0` ⟺ no open task exists ⟺ `open_all = 0` ⟺ rows 1–2 have
  already fired, so the branch is unsatisfiable and the frame **added this
  morning (T-128) is dead by this afternoon.** It survives only if `inbox_count`
  is rebound to the `undated` cell — the same rebinding the bullet above asks
  for, so one decision settles both. Note the shape: Amendment 1 found LSM-OVERDUE
  dead by the same mechanism, and § *"The rule is total, and that is the property
  to test"* asks a change to re-prove totality rather than add a row. **This is
  that re-proof, and it finds a second dead row.**
- **§ LandingSummary, `open_all` — its source expression is still correct**
  (`open_today + upcoming + inbox_count`, once `inbox_count` names the undated
  cell). What returns is the *identity*
  `open_all == collectionCount(tasks, 'inbox', now)`, exactly true again today in
  every account. That identity is INV-INBOX-FILING's subject and must never
  become a source.
- **Code and tests, routed to the implementation pass, not to design.**
  `src/assistant/_shared/model/tasks.ts:224` claims *"for any task and any clock
  exactly one collection returns `true`, by construction"*, and
  `src/assistant/web/__tests__/collections.test.ts:91` asserts that as a suite
  (*"the four buckets are total and disjoint"*). Both are correct about the date
  axis and **false about the model**, and the store now holds 7 live
  counterexamples. The header comment at `tasks.ts:21–27` and the superset
  narration in `web/components/ListsMenu.tsx:25` and
  `mobile/components/ListsMenu.tsx:25` are in the same position.
- **Unaffected, checked rather than assumed:** § PathSwitch's badge
  (`openTodayCount` is a date call and is not on the filing axis); § SaveNotice
  (a task created with no date is still unfiled *and* still undated, so it is in
  Inbox by both axes and the receipt still tells the truth); `dueAtForCollection`
  including its still-open Upcoming cell (T-130); and § TaskList's `Overdue`
  group, which becomes *more* load-bearing rather than less, since Inbox now
  needs it too.

### 8. What did **not** change

- **The date axis, entire.** Today is `<= today`, Upcoming is `> today`, both
  day-granular on the device clock, overdue folded into Today deliberately.
  Amendment 1 §§ 1–3 stand word for word; only the name on the third cell was
  wrong.
- **§ 1's core claim, its mechanism and its reasons.** Today is a date; no status
  leg; `now` is the device clock; the server stores an instant and has no opinion
  about which day it is.
- **§ 2 in full, and `TaskStatus` untouched a third time.** Same four members,
  same three vocabularies, `'today'` still record-only and still rejected on the
  wire. There is no status named `upcoming` and none named after a list — filing
  is not a status, exactly as Upcoming is not. The Neutral bullet's rule
  (*changing one must not touch the other*) gets its second exercise: the
  collection set was restructured and `TaskStatus` did not move.
- **§ 3.** Un-completing writes `status: 'inbox'` and does not touch `due_at`. A
  task returns to the date collection *and* the container it came from, still
  with no new field.
- **§ 4's Today, Inbox and Done rows.** Inbox keeps its value and gains a cleaner
  reason: a container names no date, so nothing is derivable from it, and the
  task is created unfiled and undated — which lands it in Inbox on **both** axes.
- **§ The migration that is deliberately not run.** Re-measured above: 4 live
  rows, all undated, all landing in Inbox as before. No new reason to migrate.
- **The wire.** No `list_id`, no new field, no new status, no endpoint change, no
  collection parameter. `api-contracts.md` records this explicitly, in the same
  place it records that `upcoming` changed nothing on the wire.
- **`Collection`'s four members and `COLLECTIONS`' order.** The union now spans
  two axes and one status, which is what a menu is; the members and their order
  are unchanged, and § 7 leaves the Inbox row's *position* to design.

### The ACs this owes, added to § Who owns the ACs

Amendment 1 left five. This amendment revises one, adds one, and annotates AC-24.

3. *(revised — was "the four collections are total and disjoint: every open task
   is in exactly one of Today, Upcoming and Inbox")* — that is one property no
   longer, and it becomes **two**, both testable directly:
   - **3a.** The **date axis** is total and disjoint: for any open task and any
     clock, exactly one of Today, Upcoming and `undated` is true.
   - **3b.** The **filing axis** is total and disjoint: for any open task,
     exactly one of Inbox and the personal lists is true. With no lists, that is
     Inbox for every open task.
6. **(new) The two axes are independent.** A task's date collection does not
   change when it is filed or unfiled, and its filing does not change when its
   date changes. This is the property that says the model is two axes rather than
   one partition with cases, and it is the first thing a re-merge breaks
   (INV-INBOX-FILING).

**AC-24's set half is now carried by 3b, not by 3a** — reachability is a property
of the filing axis (§ 6). Whichever spec writes these should say so, because the
same bound has now been justified three different ways and twice the reason
expired without the AC changing a word.

**spec-agent owns writing them**; architect-agent does not author acceptance
criteria.

### Sequencing

`docs/specs/` first — this amendment, `data-model.md` (which gains
§ INV-INBOX-FILING) and the `api-contracts.md` note, in one task so the three
describe one end state (**done**). Then **design**, which has more to decide here
than at Amendment 1 and is briefed by § 7: § TaskList's Inbox row, § ListsMenu's
`Source` cell and where the Inbox row sits, and § LandingSummary's `inbox_count`
rebinding — which settles the dead LSM-CLEAR-AHEAD row as a side effect. Then the
code, **in one change**: `inCollection`, the `isFiled` seam, the doc comments at
`tasks.ts:21–27` and `:224`, the two `ListsMenu` narrations, and
`collections.test.ts`'s disjointness suite move together — splitting them leaves
a window in which the code asserts a partition the model does not have. QA last,
and QA must be able to **construct a filed task**: the store holds none, cannot
hold one, and the invariant's test is the one that would otherwise never run.
