# ADR-009 — Today is a date; `status: 'today'` is retired

**Status:** accepted · 2026-08-18 · product owner (decision), architect-agent
(write-up)
**Feature:** cross-cutting (`task` entity; the Tasks surface feature is not yet
specced — see § Who owns the ACs)
**Source of record:** `reports/owner-decision-2026-08-18-today-is-a-date.md`,
which sharpens `reports/owner-decision-2026-08-18-landing-and-collections.md` §2.

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
`inCollection(t, 'inbox')` is "not done" → the row shows in Inbox;
`inCollection(t, 'today')` is the date → it does not show in Today; `done` → no.
A row that undo resurrects with `status: 'today'` lands in Inbox and behaves
exactly like an `inbox` row. There is no code path left for it to be wrong on.

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
