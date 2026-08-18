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
**Source of record:** `reports/owner-decision-2026-08-18-today-is-a-date.md`,
which sharpens `reports/owner-decision-2026-08-18-landing-and-collections.md` §2.
The amendment's source of record is
`reports/owner-decision-2026-08-18-four-buckets.md`.

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

- **`done_today` becomes derivable with no new field.** `design/_shared/components.md`
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
   become **overdue** — which `design/_shared/components.md` selection rule 3
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

**The tension this creates, named rather than hidden.** `specs/_source/todo-ai/02-use-cases.md:911`
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

`specs/` first (this ADR + the two contract files — done). Then design's two
cells in `design/_shared/components.md` (`open_today`'s definition and the
`done_today` row), because implementers and tests read that file as the owning
artifact for the frames. Then the code, in one change: the predicate, the
un-complete line, the create path, the wire vocabulary and the shared fixture
move together — splitting them leaves a window where Today is defined twice.
QA expectations last.

## Amendment (2026-08-18) — `upcoming` joins; all four collections are date predicates

**Trigger.** The owner decision of 2026-08-18,
`reports/owner-decision-2026-08-18-four-buckets.md`, taken the same day as this
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

The old reachability argument was *Inbox is a superset of every open task*, and
`F-001` AC-24 leans on it. **That argument is gone**, because Inbox is now a
strict subset. Reachability now rests on a different property: the four buckets
are **total**, so every open task is in exactly one of Today, Upcoming or Inbox.

Totality is only reachability **if all three are reachable**. Concretely:
`design/_shared/components.md` § ListsMenu draws LM-COLLECTION as three rows,
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

**The landing summary, `design/_shared/components.md` § LandingSummary.** Design
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
   predicate is true.
4. Creating a task while viewing a collection puts it in that collection, by date
   *(Upcoming's cell pending the decision above)*.
5. Un-completing returns a task to the collection it came from, with no new field
   *(UC-45 AC-45.2)*.

**spec-agent owns writing them**; architect-agent does not author acceptance
criteria.

### Sequencing

`specs/` first — this amendment plus `data-model.md` and `api-contracts.md`,
updated in the same task so the three describe one end state (done). Then
design's cells: `components.md` § LandingSummary (`open_all`'s source,
`count_secondary`'s definition, the dead row 4), § ListsMenu (the fourth row),
and the day-group heading for overdue. Then the code, **in one change**: the
`Collection` union, `COLLECTIONS`, `inCollection`, the day-granular comparison,
`dueAtForCollection`'s Upcoming cell and `groupTasks` move together — splitting
them leaves a window in which the buckets are neither total nor disjoint. QA
expectations last, and QA must **seed a future-dated task**: the store has no
Upcoming member to read.
