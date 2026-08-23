# Data Model — assistant module

Feature: F-001 (spec rev 3 — its Data section is binding; this file refines
it, zero drift). Persistence is prototype-grade (ADR-001): an in-memory store
with a JSON file snapshot behind a `Store` port; "table", "index" and
"transaction" below name the store-port contract the implementation must
honour, not a SQL engine.

## Entities and relationships

```
user (account, existing)  1 ──── 0..1  assistant_session (status=open)   ← ADR-005: one open per account
user                      1 ──── *     assistant_session (closed history)
assistant_session         1 ──── *     assistant_turn (ordered by seq)
assistant_turn            0..1 ─ 1     question       (embedded object)
assistant_turn            0..1 ─ 1     undo_snapshot  (embedded, applying turns only)
assistant_turn            0..1 ─ 1     undo_result    (embedded, undone turns only)
user                      1 ──── *     task
user                      1 ──── *     list (personal lists)            ← F-008: the filing axis containers
task                      * ──── 0..1  list (via list_id)               ← F-008: null = Inbox (unfiled)
account                   1 ──── 1     user (keyed by user_id)          ← F-005/ADR-010: the row ADR-005 has been reasoning about since 2026-08-16
task                      1 ──── *     task (steps, via parent_id)      ← F-005 AC-18: exactly one level
task                      * ──── 1     series (via series_id)           ← F-005 AC-25: a key, not an entity
```

**`task` is no longer "the existing todo-ai model, unchanged".** That sentence
was true for F-001 and for ADR-009, and **F-005 falsifies it** — see
`## task — the F-005 fields` below. It is corrected here rather than left
standing, because this file is where an implementer looks for the field list.

`session.messages` from the spec **is** the ordered list of `assistant_turn`
rows for that session — turns are the messages; no separate message table.

## assistant_session

New entity — does **not** reuse the existing app's `capture_sessions`
(ADR-003; the 30-turn 409 limit does not apply here).

| Field | Type | Required | Constraints | Notes |
|---|---|---|---|---|
| id | uuid | yes | server-generated | |
| user_id | uuid | yes | — | account scope (ADR-005) |
| status | enum(`open`, `closed`) | yes | **closed sessions accept no turns**; at most one `open` per user_id (enforced at open) | spec Data |
| close_reason | enum(`idle`, `user_closed`) \| null | closed only | recorded at close (AC-28) | `idle` = lazy server close (ADR-004) |
| created_at | iso8601 | yes | — | |
| last_activity_at | iso8601 | yes | bumped on every accepted turn/undo/close touching the session | drives idle close: closed lazily when `now − last_activity_at ≥ 180 s` (ADR-004) |
| closed_at | iso8601 \| null | closed only | — | |
| boundary_declined | `{turn_id, kind, task_titles}[]` | closed only | questions declined by this close, by name | serves `GET /assistant/session` boundary (AC-28) |
| boundary_late | `{turn_id, status, outcome}[] \| null` | closed only | turns resolved between last-foreground and close | serves `GET /assistant/session` boundary as `Boundary.late_outcomes` (AC-28) |
| last_foreground_at | iso8601 | yes | internal — never serialized to the wire | approximation basis for "last foreground" used to compute `boundary_late` (backend-agent tradeoff note) |

Index: `(user_id, status)` — open-session lookup; `(user_id, closed_at desc)`
— latest closed session for the boundary.

## assistant_turn

| Field | Type | Required | Constraints | Notes |
|---|---|---|---|---|
| id | uuid | yes | server-generated | the `turn_id` in the undo URL |
| session_id | uuid | yes | FK assistant_session | |
| user_id | uuid | yes | denormalized for the dedupe index | |
| seq | int | yes | strictly increasing per session, assigned at receipt | receipt order = processing order (AC-10) |
| client_turn_id | uuid | yes | client-generated; **unique per `(user_id, client_turn_id)`** | dedupe key, account scope (AC-16, ADR-005) |
| status | enum(`pending`, `applied`, `asked`, `failed`, `undone`) | yes | transitions exactly: `pending → applied \| asked \| failed`; `applied → undone`; `failed → pending` (same-id retry) | verbatim from spec; dedupe is per-status |
| transcript_raw | text | yes | persisted **before** interpretation is attempted | AC-23; failed turns stay in session history |
| source | enum(`voice`, `typed`, `tap`) | yes | — | |
| answer_to_turn_id | uuid \| null | no | tap answers: explicit question binding | AC-10 |
| outcome | TurnOutcome \| null | resolved turns | see below | message anatomy for rendering |
| changed_task_ids | uuid[] | yes | may be empty | drives AC-4 marking + AC-5 undo scope |
| diff | `{task_id, field, old\|null, new\|null}[]` | yes | `old=null` for create, `new=null` for delete. **Shape unchanged by F-005** — a recurrence change is reported as **per-member rows** whose values are scalars, because ADR-011 stores the two set-valued members as canonical strings | AC-4 (task_id added so multi-task diffs attribute per row); F-005 AC-21 |
| undo_snapshot | task[] | mutating applying turns only (`changed_task_ids` non-empty) | captured **after the plan phase and before apply**, inside the apply transaction (F-005 AC-46, ADR-013 — before F-005 this read *"immediately before apply"*, which was falsified by rows the server creates or changes as a consequence of the turn); create → records the created task ids (nothing pre-existing to snapshot). **A cascade-ticked step (F-005 AC-19) is here, like any other changed row.** Non-mutating applied outcomes (no_match, unsupported_query, unclassifiable, **refused**, declined resolutions) capture none and never enter the undo window | AC-6 revert shapes + AC-7/AC-12 snapshot comparison |
| question | Question \| null | asked turns | see below | a message, never app state (D2) |
| undo_result | UndoResult \| null | undone turns | see below | renders the reverted-outcome message at its own position |
| post_apply | `Record<task_id, task> \| null` | mutating applying turns only | internal — never serialized to the wire; captured **after** apply, keyed by **every row written — targets and caused rows alike** (F-005 AC-46, ADR-013) | **this is the AC-7 comparison baseline** (C9.3): undo's modified-since check compares a task's current state against its `post_apply` entry, not against `undo_snapshot` — comparing against the pre-apply snapshot would flag the turn's own change as a modification |
| created_ids | uuid[] | yes | may be empty; internal — never serialized to the wire | ids this turn created; undo removes exactly these (mirrors `undo_snapshot`'s create-derivation rule). **A generated successor (F-005 AC-26) is here** — its id is allocated in the plan phase, and it is removed only if it would still be removable under F-005 AC-28's five conditions (ADR-013) |
| pending_op | `{op:"delete"} \| {op:"edit", changes}` \| null | clarify turns only | internal — never serialized to the wire | the operation a `clarify` question runs on the selected candidate once answered (AC-13) |
| caused_resolutions | `{question_turn_id, result}[]` | yes | may be empty; internal — never serialized to the wire | resolutions this turn caused; replayed verbatim on a dedupe hit so a replayed turn re-serves the same resolution outcomes without re-resolving (AC-16) |
| created_at / resolved_at | iso8601 | yes / resolved | — | |

Indexes: unique `(user_id, client_turn_id)`; `(session_id, seq)`;
newest-applied lookup = max `seq` where `session_id = ? and status = 'applied'
and changed_task_ids is non-empty` (the undo window rule, AC-8 — mechanical,
no timer; a non-mutating turn never occupies or advances the window).

**Dedupe retention (ADR-005):** the dedupe key lives on the turn row; rows
are retained for the life of the store, and never less than **7 days** — at
least as long as the offline replay window (AC-16, AC-25). A replay arriving
after session close targets the new session; the id is still recognized.
Voice-undo guard outcomes (ADR-006) create no turn row, so they get a small
dedupe record instead: `(user_id, client_turn_id) → {recorded response,
transcript, source, answer_to_turn_id}` — same uniqueness, same retention;
the stored request fields serve the divergent-body comparison
(`409 CLIENT_TURN_ID_REUSED`, TC-24/TC-25).

### TurnOutcome (embedded)

```yaml
kind: "applied" | "question" | "resolution" | "unclassifiable" | "no_match" | "unsupported_query" | "refused"
# kind=refused      → {reason, field|null, task_id|null}   # F-005 AC-36/AC-40 — a turn that
#                     attempted a value or a field a rule forbids. The task is UNCHANGED, the
#                     write is refused WHOLE (one legal + one illegal field writes nothing),
#                     changed_task_ids is empty, no diff row is emitted, and no undo_snapshot
#                     is captured — so a refused turn never occupies or advances the undo
#                     window, exactly like no_match. The turn's STATUS stays `applied`: the
#                     status machine is unchanged. Reasons are enumerated in
#                     api-contracts.md § The refused turn; the WORDING is F-002's.
# kind=applied      → {changed_task_ids, diff, created_titles: [..], deleted_titles: [..]}   # deletes named by title — no row remains (AC-4)
# kind=question     → the Question object below renders as the message (AC-1 carve-out)
# kind=resolution   → {result: executed|declined|declined_superseded|already_resolved,
#                      question_turn_id, executed?: <full applied anatomy incl. Undo> }      # AC-11
# kind=unclassifiable → {question_turn_id}    # nothing executed; question stays pending (AC-10)
# kind=no_match     → {heard_transcript}      # quotes what was heard (AC-14)
# kind=unsupported_query → {alternative: "the on-screen list and its filters"}                # AC-15
```

### Question (embedded, `turn.question`)

| Field | Type | Notes |
|---|---|---|
| kind | enum(`bulk_delete`, `clarify`) | AC-9, AC-13 |
| task_ids | uuid[] | targets at ask time |
| task_titles | string[] | named in the message (AC-9) |
| options | string[] | literal texts; a tap sends one verbatim as a normal turn |
| ask_snapshot | task[] | state at ask time — AC-12 re-validation uses AC-7's snapshot-comparison rule against this |
| resolution | `{result, resolved_by_turn_id, resolved_at}` \| null | one-shot; results as in TurnOutcome.resolution. Session close writes `declined` (D2) |

### UndoResult (embedded, `turn.undo_result`)

`{reverted: [{task_id,title}], skipped: [{task_id,title,reason}], nothing_reverted: bool, via: tap|voice, transcript?: string, undone_at}` —
mirror of the undo endpoint's 200 body; `transcript` recorded on voice undo
(ADR-006). Renders as the reverted / nothing-reverted message. An all-skipped
undo (`nothing_reverted: true`) still transitions the turn `applied → undone`
— the undo is consumed and a retry is the AC-6 idempotent replay (TC-22).

## task — the F-001 baseline

F-001 adds **no** task fields (spec, Out of Scope), and **ADR-009 adds none
either** — that is the point of it. **F-005 does** (`## task — the F-005
fields`). Prototype serves, as the F-001 baseline:
`id (uuid, client-generatable — POST /tasks accepts optional id, 409
TASK_ID_EXISTS on collision), title, due_at, reminder_at, priority,
status(inbox|today|done|archived), updated_at, deleted_at (soft delete),
created_at`. Owned per `user_id`; the assistant marks rows only via
`turn.changed_task_ids`, never by writing marker fields onto tasks (AC-4:
only the turn's own changes are marked).

### `status` — three vocabularies, one union (ADR-009)

The union is unchanged at four members. What changed is that **only three of
them may ever be written**: `'today'` is retired as a live value and survives
only inside historical records.

| Vocabulary | Values | Who enforces it |
|---|---|---|
| **Write** — what a client, the interpreter or the app may set | `inbox`, `done`, `archived` | `POST /tasks` and `PATCH /tasks/{id}` reject `today` with `400 INVALID_INPUT` (api-contracts.md § Prototype task CRUD) |
| **Live** — what a non-deleted row may hold | the write vocabulary, plus a small number of pre-existing rows still carrying `today` | nothing; the value is inert and drains as those rows are next written |
| **Record** — what `turn.undo_snapshot`, `question.ask_snapshot`, `turn.post_apply` and `turn.diff.old/new` may hold | all four | never narrowed. These are **past states**; rewriting them so an enum reads tidily would make the app report a diff the user never saw |

**`blocked` / `in-progress` / `waiting` were considered and rejected by the
owner (2026-08-22).** A workflow status exists to hand work between people, and a
single-user app has no counterparty: `in-progress` nobody ever sets back only
rots, and `waiting` — the one candidate with real value — has nobody to change it.
The write vocabulary is closed at three members and no new member is added
without a product decision recorded in `F-001 ## Out of Scope`.

**A stored `'today'` is inert, and that is why the member is retained rather
than deleted.** After ADR-009 nothing branches on it: a row carrying it is not
done, so it is unfiled and therefore appears in Inbox, and it carries no date, so
Today — which is read from the date — does not show it. (All live rows carrying
the value are dateless — re-measured 2026-08-18 at both amendments, three
measurements with the same answer, ADR-009 § Amendment 2 § 4. Inbox has meant
three different things this day and all three put these rows in the same place.)
Undo replaying a pre-ADR-009 `undo_snapshot` therefore restores a
value that is harmless rather than one that is invalid. `archived` is a separate
question (never assigned, never stored) and ADR-009 does not touch it.

### The four collections — two axes, not one partition (ADR-009 + its two 2026-08-18 amendments)

**The open tasks are partitioned twice, independently.** A *date* axis says when
a task is due; a *filing* axis says where it lives. `status` participates in
neither — it is the gate that removes a task from both.

| | Cells | Kind | Surfaces today |
|---|---|---|---|
| **Date axis** | Today · Upcoming · `undated` | views computed from `due_at` | Today and Upcoming have rows; `undated` has none |
| **Filing axis** | Inbox · each personal list | containers — a property of the task | Inbox + user-created lists (F-008) |
| **The gate** | Done | the one genuine status | its own row |

| Collection | Membership | Axis |
|---|---|---|
| **Done** | `status === 'done'` | gate |
| **Today** | not done, `due_at` **on or before** today — **overdue included** | date |
| **Upcoming** | not done, `due_at` **after** today | date |
| **Inbox** | not done, **filed into no personal list** | filing |

**Each axis is separately total and disjoint; the two together are a grid.** A
task has a date cell **and** a filing cell, and every combination is legal.
Consequences that are contract, not detail:

- **The collections overlap.** A task is routinely in Today *and* in Inbox — that
  is what Todoist, Things 3, TickTick and OmniFocus all do, and it is what the
  owner chose (ADR-009 § Amendment 2). Measured in `data/assistant.json` on
  2026-08-18: `|Inbox ∩ Today| = 7`.
- **The counts nest and do not sum to a headcount.** Inbox's number contains
  Today's and Upcoming's. 716 + 7 + 0 + 21 = 744 against 737 live rows.
- **Reachability rests on the filing axis, not the date axis.** F-001 AC-24's
  set half — *the **full** todo list remains usable by hand* — holds because the
  filing axis is total and every cell of it is openable from the Lists menu. It
  no longer rests on Inbox being a superset (retired 2026-08-18 morning), nor on
  the four buckets being total (retired the same afternoon). Upcoming must still
  be reachable or a future-dated task is unreachable *as a dated task*; that is
  now a date-axis requirement rather than AC-24's carrier.
- **`undated` has no surface, and will not have one.** Inbox serves that cell by
  coincidence today, because nothing can be filed. Post-lists, an undated task
  inside a personal list is in no date collection and not in Inbox — it is
  reachable through its list and only through its list, which is how every
  reference app behaves. **Every list a task can be filed into must therefore
  render a row**, or its undated tasks are stranded silently.

**The two dated predicates compare local calendar days, not instants.** `due_at`
is a timestamp and a bucket boundary is a day; reading Today as `due_at <= now`
would leave a task dated today at 17:00 in no bucket until 17:00. Both compare
`localDay(due_at)` against `localDay(now)` on the same device clock.

**Today means "needs attention now", not literally "dated today."** Folding
overdue in is a deliberate widening of the word, taken on the argument that a
task which vanishes from view is how it gets forgotten
(`docs/reports/owner-decision-2026-08-18-four-buckets.md`). It is not a defect to
narrow later.

**Inbox means "filed nowhere."** Not *"no date"* — that was its meaning for part
of 2026-08-18 only, and it is not what the word means in any app the audience
uses. **`lists` and `tasks.list_id` now exist (F-008).** A task can be filed
into one personal list or remain in Inbox. Inbox narrows as tasks are filed:
no rule change, no re-litigation — the predicate was written for this moment.
Measured before it was taken — 7 of 737 live rows change bucket, all of them
*into* Inbox, none out of anything (ADR-009 § Amendment 2 § 4).

A task with no date is never in Today — open or ticked. It is in Inbox until it
is filed, and after that it is in its list.

### `isFiled` — the predicate, and `list_id` (F-008)

**`list_id` ships with F-008.** Before F-008, no `list_id` existed — verified
absent from all 790 rows in the store. The predicate was written in advance
of this moment and its answer was `false` for every task. Now that `list`
and `task.list_id` exist, it answers `true` for filed tasks:

```ts
isFiled(t)  = listIdOf(t) !== null      // → true for filed tasks (F-008)
inbox(t)    = t.status !== 'done' && !isFiled(t)
```

Written this way rather than as the shorter `inbox(t) = t.status !== 'done'` for
two reasons that are not style. The predicate on screen then **reads as the
definition**, so Inbox narrowed by itself when lists landed; and it is **not
token-identical to `open_all`'s membership test**, which is the guard
INV-INBOX-FILING below depends on.

**`isFiled` is now answerable `true` in production** (F-008). The seam in
`tasks.ts` that was built for this moment reads `task.list_id` through
`listIdOf`. No code change to the predicate is needed — the field's presence
activates it.

### INV-INBOX-FILING — the equality that must never become a definition

> **INV-INBOX-FILING.** `open_all` counts every open task. `inbox_count` counts
> the open tasks in the Inbox **container**. Their equality holds while and only
> while no task is filed. It is a **reading of the store, never a definition**,
> and neither number may be sourced from the other.

**F-005 narrows the subject of both expressions, together and separately**
(F-005 AC-35, `## Impact` §5; ADR-009 § Amendment 2 § 5 carries the same
amendment). A step is in no collection and in no count, so `open_all` comes to
mean *every open **non-step** task* and `inbox_count` comes to mean *the open
**non-step** tasks in the Inbox container*. **They stay two different facts.**
They are exactly equal today — 716, across all 190 accounts holding open rows —
and equal numbers are precisely how someone later concludes they are one fact
and merges them, which is the bug the 2026-08-18 split fixed. Two subjects
narrowing at once, silently, is that re-merge risk arriving through a side
door, so the narrowing is written **into both expressions separately** and the
step gate lives in `inCollection` **beside the done gate, never in `isFiled`**
— calling a step *filed* would hand the filing axis a cell that is not a
container.

They are exactly equal today — 716 = 716 globally and in every one of the 193
accounts holding live tasks — and they diverge the moment the first task is
filed. `docs/design/_shared/components.md` § LandingSummary split these two facts on
2026-08-18 (T-128) precisely because they had stopped being equal; this
definition makes them equal again. **Re-merging them reintroduces the bug the
split fixed:** a user with a full week ahead told *"All done — your list is
clear."*

Three things carry it, and the note you are reading is the weakest:

1. **The two expressions are not written the same** — see `isFiled` above. This
   is the only guard that works without anyone remembering the rule.
2. **A test that can fail today.** Hand `inCollection` a task the filing seam
   reports as filed and assert **both** halves: it is *not* in Inbox, and it is
   *still* in its date collection. That fails against a re-merged
   `inbox(t) = !done`, and it also fails against an implementation that
   "resolves" the overlap by dropping the row out of Today. It is the only
   artifact a re-merge cannot walk past.
3. **This note**, plus ADR-009 § Amendment 2 § 5, plus `components.md`
   § LandingSummary when design rebinds its counts — the physical place a
   re-merge would land.

Three consequences are contract, not implementation detail:

- **`now` is the device clock, and the bucket is computed client-side.** The
  server stores an instant and serves it; it never buckets tasks by date and has
  no opinion about which day "today" is.
- **`due_at` survives completion.** Completing a task writes `status` only;
  un-completing writes `status: 'inbox'` and likewise leaves `due_at` alone. A
  task therefore returns to **both** the date collection and the container it
  came from, still with no `doneFrom` field — the requirement
  `uc-coverage-map.md` D6 records as unmet (UC-45 AC-45.2). Filing is not a
  status either, so completion cannot disturb it any more than it disturbs
  `due_at`.
- **`done_today` is derivable** as `status: 'done'` **and** `due_at` today. It
  needs no `completed_at` column. Read what it measures before using it: it is
  *"was due today and is done"*, not *"was completed today"* — the two differ
  for a task due today and ticked last night (counted) and for a task due
  yesterday and ticked this morning (not counted). ADR-009 § Consequences
  carries the copy consequence.

**`Collection` is not `TaskStatus`.** `src/assistant/_shared/model/tasks.ts`
defines `Collection = 'inbox' | 'today' | 'upcoming' | 'done'` — a **view** over
tasks, in which `'today'` stays fully meaningful. The two sets share three names
and nothing else. Changing one must not change the other, and the two 2026-08-18
amendments are that rule's first two exercises: **`Collection` gained `upcoming`,
then Inbox moved to a different axis, and `TaskStatus` did not change either
time.** There is no `upcoming` status and no status named after a list — no
client may send one and no row will ever hold one. Upcoming is computed from
`due_at`; Inbox is computed from filing; neither is a status.

**The union spans two axes and one gate, and that is what a menu is.** Its four
members are not four of a kind — `today` and `upcoming` are date views, `inbox`
is a container, `done` is the status gate. The union exists because the Lists
menu renders one list of rows, not because the four are the same sort of thing,
and `inCollection` must therefore **not** be written as a single classification
that returns exactly one answer. That shape was correct while the model was one
partition and it is false now: the store holds 7 live tasks that are in Today and
in Inbox simultaneously.

## list (new entity — F-008)

A personal list is a named container on the filing axis. A user creates lists
to organise tasks beyond the single Inbox. The entity is specced in
`F-008-lists.md`; this section is the representation.

| Field | Type | Required | Constraints | Notes |
|---|---|---|---|---|
| id | uuid | yes | server-generated | |
| user_id | uuid | yes | FK, account scope | |
| name | string | yes | 1–100 chars, trimmed, whitespace-only rejected; unique per `(user_id, lower(name))` | F-008 AC-1, AC-3 |
| color | int | yes | 0–6, index into `tokens.json listColor.palette`; default 0 (Grey) | F-008 AC-2 |
| position | int | yes | sparse, gaps of 1024; assigned on create, rewritten on manual reorder | F-008 AC-10 |
| created_at | iso8601 | yes | | |
| updated_at | iso8601 | yes | | |

Index: `(user_id, position)` — menu render order; unique `(user_id,
lower(name))` — duplicate-name guard.

**Limit: 50 lists per user** (F-008 AC-23). High enough for normal use, low
enough to bound the menu scan. Enforced at create time.

**No soft delete.** Deleting a list is permanent and immediate (F-008 AC-9).
The list entity has no `deleted_at` field and does not participate in F-006's
trash. Deleting a non-empty list unfiles its tasks (sets `list_id = null`) —
see F-008 AC-7.

### task.list_id (new field — F-008)

| Field | Type | Required | Constraints | Notes |
|---|---|---|---|---|
| list_id | uuid \| null | no | FK `list.id`; null = Inbox (unfiled). A step (`parent_id` non-null) may not carry a `list_id` — refused with `400 INVALID_INPUT` (F-008 AC-13). When a list is deleted, every task with that `list_id` is set to `null` in the same transaction | F-008 AC-10, AC-11, AC-12 |

**Existing rows.** 0 of the current rows carry a `list_id`. No migration;
`null` means Inbox, which is what every task is today. The `isFiled` seam in
`tasks.ts` activates without a code change.

Index: `(user_id, list_id)` — count and membership queries.

---

## Client-side stores (client contracts — not server entities)

| Store | Shape | Durability contract | Notes |
|---|---|---|---|
| `client.pending_input` | `{text: string, updated_at}` | survives process kill (mobile) and tab close/reload (web: durable browser storage) | recognized-so-far text only, never audio; reopens into the composer (AC-26) |
| `client.outgoing_turn` | the full `POST /assistant/turn` request payload + `{sent_at, attempts}` | held until the server acks its `client_turn_id` (2xx/4xx-terminal); survives kill (mobile) and reload (web) | drives retry-with-same-id (AC-16) and queued offline replay, replayed visibly (AC-25, AC-27) |
| `client.permission_state` | `{microphone, speech_recognition?}`, each `granted \| denied \| permanently_denied \| undetermined` | persisted per user alongside the other two stores; re-read on every foreground so an out-of-app grant change is picked up | introduced by F-003 (mobile), where it drives the mic mode and the re-grant CTA (F-003 AC-2/AC-3, F-001 AC-21). `speech_recognition` is present on **iOS only** (Android needs one RECORD_AUDIO grant, web one prompt); `permanently_denied` is reachable on **Android only** — it is the state where the OS never prompts again, so the CTA routes to app settings instead of re-requesting |
| `client.speech_prefs` | `{enabled: bool, updated_at}` | **device-local, never account-scoped** — account scope would ship web speaking without the consent F-002 AC-16 requires. Survives reload and backgrounding on both clients, and **process kill on mobile**; web has no observable for process kill distinct from reload, so the contract is stated per platform rather than claimed for both | introduced by F-002 (AC-6). Default `false` on web (AC-16's opt-in), `true` on mobile |
| `client.interface_language` | BCP-47 string | **build-time constant this phase** (`en-US`, the language of the shipped copy in `docs/design/_shared/components.md` — ADR-008, *owner decision 2026-08-17*; was `vi-VN`) — not user-editable, because no settings surface is a deliverable | introduced by F-002 (AC-23) as the **single declared source** read by both the synthesiser and the recognizer. It exists to end a live three-way drift, **which ADR-008 does not resolve**: web recognition uses `navigator.language \|\| 'en-US'` (`src/assistant/web/ports/web-speech-source.ts:50`) — the wrong mechanism whatever it resolves to — and mobile hardcodes `'vi-VN'` (`src/assistant/mobile/ports/native/rn-transcript-source.ts:71`), now a per-port constant **and** the wrong language. **Aligning the two recognizer ports is follow-up drift, not F-002's build** — F-002 declares the value; F-001/F-003 surface consumes it |

**Not client stores, and deliberately not listed above:** F-002's `speech.utterance` and `speech.decision_log` are **transient in-memory** state, never persisted and never sent to the server — a slot of size one and an in-process log respectively. Their shapes are declared in `docs/specs/assistant/F-002-talk-back.md ## Data`, which is the single home for them; they are named here only so a reader looking for "where does talk-back keep its state" is not left to conclude the list is incomplete.

Ack rule: a `200` (including `replayed: true`), `409 SESSION_CLOSED`-then-
successful-replay, or terminal `4xx` clears the store; `502 AI_ERROR` and
network failure keep it (retry same id). At most one outgoing turn is held;
the composer is the queue of length one (spec User Flow: send → thinking).

---

# Feature F-005 — task detail

**Added**: 2026-08-19 by architect-agent (T-160). Requirement names and their
ACs are `docs/specs/assistant/F-005-task-detail.md ## Data`; this section is the
representation, which that section explicitly leaves to architecture. Wire
behaviour is `api-contracts.md § Feature F-005`.

## account (new entity — ADR-010)

**ADR-005 decided on 2026-08-16 that *the account* is the scope for sessions
and dedupe. There has never been a row.** Measured 2026-08-19: the store's
top-level keys are `sessions`, `turns`, `tasks`, `undo_records`, and auth is an
`X-User-Id` header stub. F-005 AC-44 needs an account-stored zone, so the
premise finally gets its entity.

| Field | Type | Required | Constraints | Notes |
|---|---|---|---|---|
| user_id | uuid | yes | PK | the `X-User-Id` value; the row is created lazily on the first authenticated request |
| timezone | IANA zone \| null | no | **set from the first client report and never overwritten by a later one**; changed only by `PATCH /account` | the ONE source every date computation reads (AC-44) |
| timezone_source | enum(`first-report`, `user`) \| null | with a timezone | — | `user` = set explicitly |
| timezone_set_at | iso8601 \| null | with a timezone | — | |
| timezone_last_report | IANA zone \| null | no | the most recent client report, **applied or not** | exists so a client can *offer* a change when the user has travelled, rather than take one |
| timezone_last_report_at | iso8601 \| null | no | — | |
| created_at | iso8601 | yes | — | |

Index: PK on `user_id`. No other account-scoped fact lives here yet; when a
settings surface exists, this is its row.

**Why a later report does not overwrite.** If each request upserted the zone
before serving its own read, device A would resolve rows in UTC and device B in
UTC+7 in the same second — the *one row, three answers* defect AC-44 was
rewritten against, arriving through the writer instead of the reader. The cost
is stated in ADR-010: a user who first opens the app while travelling is pinned
until `PATCH /account`, and this phase ships no surface that calls it.

**One installer, two reporting channels.** `recordClientZone(state, userId,
reported)` is called from the auth step of **every** request, and it is the only
writer of the `first-report` path. The channels are the `X-Timezone` header and
`POST /assistant/turn`'s pre-existing `timezone` body field. This is L-005's
remedy applied in advance: a grep for the installer's name returns every door.

## task — the F-005 fields

Added to the F-001 baseline above. Every one is nullable-or-defaulted on
existing rows, and **no migration is run** — the read rules below cover the 790
existing rows, following ADR-009's precedent that past states are not rewritten
so an enum reads tidily.

| Field | Type | Required | Constraints | Notes / AC |
|---|---|---|---|---|
| note | text \| null | no | whitespace-only and newline-only store `null`, never `""` — observable on read-back; line breaks preserved; **max 20 000 chars, refused not truncated** | AC-6, AC-37 |
| due_all_day | boolean \| null | **yes on any write that sets `due_at`** — `null` is reachable only on a row that predates the field (`## Data` says `Required: yes` and also describes an absent value on a stored row; this cell is that distinction made explicit) | **`null` = not determined.** A stored value is authoritative on every tier; absent, the server resolves it in `account.timezone` — all-day iff the instant is the local start of its own day — and emits the answer without rewriting the row; absent **and** no zone → `null` on the wire, and a client renders such a due as a date with no clock time | AC-13, AC-22, AC-44, ADR-010. Measured: **0 of 790 rows carry it** |
| reminder_shown_at | iso8601 \| null | no | written by `POST /tasks/{id}/reminder-ack` **and by no other door** — not in the PATCH or CREATE allowlists, and not settable by a turn (AC-36 permits four value fields and this is not one); cleared when `reminder_at` is written or cleared; never inherited by a successor; never set while offline | AC-10, AC-27, AC-38 |
| priority | `null` \| `"low"` \| `"medium"` \| `"high"` | no | **`none` is the absence of a stored value, not a stored string** — the row stores `null` and the wire emits `"none"`. Write path narrows to the set; **reads stay tolerant** (an out-of-set stored value reads as `none`) | AC-8. Measured 2026-08-19: 783 `null`, 7 `"high"` — migration-free |
| parent_id | uuid \| null | no | names a live, non-step row of the same account; **one level** — a step of a step is refused, and a step may carry no repeat | AC-18, AC-19, AC-35, AC-36 |
| step_order | integer \| null | yes for steps | **sparse**, gaps of 1024, per parent; assigned by the server when the create supplies none and **preserved when the create supplies one** (AC-14's offline replay); never derived from a date; a move writes one row | AC-14, AC-15, ADR-015 |
| completed_by_parent | boolean | yes (default `false`) | set by the AC-19 cascade; **cleared by any hand tick or untick of that step** | AC-19, AC-27, AC-46 |
| ever_completed | boolean | yes (default `false`) | set on the row's first transition to `status: 'done'`; **never cleared** — not by un-completing, not by an undo, not by a soft delete. **Internal**, never serialized | AC-25, ADR-014 |
| repeat_frequency | enum(`day`,`week`,`month`,`year`) \| null | no | no hourly (AC-21) | AC-20, AC-21, ADR-011 |
| repeat_interval | integer \| null | with a repeat | 1–999 | AC-21 |
| repeat_weekdays | string \| null | no | **canonical**: a subset of `mo,tu,we,th,fr,sa,su` in that fixed order, comma-joined. Weekly rules only. Never `""` | `## Data`'s *day-of-week set*; AC-21, AC-23, ADR-011 |
| repeat_month_days | string \| null | no | **canonical**: ascending ints 1–31, comma-joined. Monthly rules only. 31 clamps to month end and **candidates are de-duplicated after clamping** | `## Data`'s *int set 1–31*; AC-21, AC-24, ADR-011 |
| repeat_until | iso8601 date \| null | no | inclusive; **exclusive with `repeat_count`**; earlier than the due date is reported, not corrected | AC-25 |
| repeat_count | integer \| null | no | ≥ 1; exclusive with `repeat_until`; **runs are counted, never stored** — see `ever_completed` | AC-25, ADR-014 |
| series_id | uuid \| null | assigned when a repeat is first set | **never cleared** — it survives clearing the repeat, because AC-30 and the run count have no other key to the history. **Therefore it is never the liveness predicate** | AC-25, AC-26, AC-28, AC-30 |
| series_ended_at | iso8601 \| null | no | written on **every** row of a series by AC-30's series delete, including the surviving completed occurrences. **Internal.** It is the only one of AC-25's four endings that needs a marker — the other three are derivable | AC-25, AC-30, AC-39 |
| delete_gesture_id | uuid \| null | with a soft delete | one id per delete gesture, written on every row that gesture trashed, in the same transaction as `deleted_at`. **Internal.** `null` on the **53 of 790** rows that predate the field | `## Data`'s `delete_membership`; AC-30, AC-41, AC-43, ADR-012 |

**`series_live` is derived and is not a stored field** (AC-25, ADR-011's
neighbour). Its formula is in `api-contracts.md § Task on the wire`; it is
`true` while the repeat is set and none of AC-25's four endings has fired, and
it is **never derived from `series_id`** — an implementation keyed off that
passes the positive case and marks every task that ever repeated as repeating
for good.

### Recurrence: the requirement name and the field name

`F-005 ## Data` names the members `recurrence.frequency`, `.interval`,
`.weekdays`, `.month_days`, `.until`, `.count`. The fields are
`repeat_frequency`, `repeat_interval`, `repeat_weekdays`, `repeat_month_days`,
`repeat_until`, `repeat_count`. **This mapping is stated here and nowhere else.**

The representation is flat scalars, sets included, and the reason is ADR-011:
`cloneTask` is a shallow spread, `taskEquals` compares `===` per field,
`applyEdit`/`applyDelete` write whole values into `DiffRow.old/new`, and the row
constructors build flat literals. An object would make **the undo snapshot and
the live row share one `recurrence`**, so editing the rule edits the snapshot —
invisibly, because the identity comparison passes for the same reason the bug
exists. Flat scalars make that unreachable rather than fixing it.

### `task-equals`'s `FIELDS`, and the two opposite rules AC-34 states

The comparison list gains every field above (except the derived `series_live`).
Widening it is what makes AC-34's two rules necessary, and they pull in
**opposite** directions:

- **On replay** (undo, and F-001 AC-12's bulk-delete re-validation): a field the
  stored record does not mention is **left exactly as it is**. "No value" is
  never written over a value the user set. Stored records are not rewritten to
  the new shape — they are past states (`§ status`, ADR-009).
- **On comparison** (the modified-since gate in front of the replay): an
  **absent key in a stored record means *not recorded* and compares equal to
  whatever is live.** Without this, every pre-F-005 `post_apply` record compares
  unequal to its live row — `undefined` stored versus `null` live — for every
  new field at once, so an undo across the change reverts nothing and reports
  **every** task as modified. That is louder and more wrong than the unset-field
  case, and the replay rule does not fix it, because the gate compares rather
  than replays.

**The record this is proven against cannot be produced by today's code** — a
snapshot captured by the current build is already the new shape, so a test that
captures its own snapshot cannot fail the AC. The seed path that constructs an
old-shape record is `POST /__qa__/seed` (`api-contracts.md § Harness doors`).

### Steps, collections and the handle list

- A step is a `task` row with `parent_id != null`. There is no `step` entity:
  one table, one id space, so a step can be restored, snapshotted and diffed by
  every mechanism that already exists.
- **`inCollection` gates on `parent_id != null` beside the done gate** — never
  through `isFiled` (AC-35, and see the INV-INBOX-FILING amendment above).
- **Five other live readers decide behaviour from raw row cardinality and never
  consult `inCollection`** (`F-005 ## Impact` §5, AC-35). They are client code
  and are enumerated in `docs/specs/_shared/platform/web.md` and `mobile.md § F-005`,
  because no server-side check can see them.
- **The interpreter's handle list excludes steps** (`turns.ts`, AC-35, AC-36):
  a task with eight steps contributes **one** handle. A step is therefore never
  named in a message, which also closes the door-to-nowhere case F-001 AC-31 is
  about.

---

# Features F-008 and F-009 — lists, list actions

**Added**: 2026-08-23 by architect-agent (T-286). Specs:
`F-008-lists.md` (personal lists) and `F-009-list-actions.md` (search, sort,
hide completed, multi-select). Wire behaviour: `api-contracts.md § Feature
F-008 / F-009`.

## task — the F-008 / F-009 fields

Added to the F-005 field table above. Both are nullable-or-defaulted on
existing rows.

### task.sort_order (new field — F-009)

| Field | Type | Required | Constraints | Notes |
|---|---|---|---|---|
| sort_order | integer | yes | sparse, gaps of 1024; assigned by the server on create; rewritten on drag-reorder within a filing cell | F-009 AC-5, AC-6 |

**Existing rows.** 839 rows have no `sort_order`. On store open, the
initialisation pass assigns values from `created_at` order within each
filing cell (keyed by `list_id` — `null` groups the Inbox rows), spacing by
1024. The field is inert until manual sort is selected. Uses the same
sparse-integer scheme as `list.position` (F-008): gaps absorb inserts without
cascading writes.

**This field is NOT in `DIFF_FIELDS` and NOT in `ContextTask`** (F-009
Impact §2). Reorder is cosmetic — it changes display order, not task data or
membership — and is not assistant-visible. It is in `TASK_CREATE_FIELDS` and
`TASK_PATCH_FIELDS`.

### task.list_id — field-list amendments (F-008)

The field and its constraints are defined in `§ task.list_id (new field —
F-008)` above. What F-008 adds to the seven closed field lists:

| List | Change | AC |
|---|---|---|
| `TASK_PATCH_FIELDS` | gains `list_id` | F-008 AC-11, AC-12 |
| `TURN_WRITE_FIELDS` | gains `list_id` | F-008 AC-18, AC-19; F-005 AC-36 allowlist widens |
| `DIFF_FIELDS` | gains `list_id` | F-008 AC-25 (undo of a voice filing records list_id) |
| `ContextTask` | gains `list_id` | F-008 AC-18 (the interpreter must see where a task is filed to resolve "move this to Work") |
| `TaskWire` / `serializeTask` | gains `list_id` | F-008 AC-10 (client needs filing state) |
| `TASK_CREATE_FIELDS` | gains `sort_order` | F-009 AC-5 |
| `TASK_PATCH_FIELDS` | gains `sort_order` | F-009 AC-6 (drag-reorder writes sort_order) |

`list_id` is **not** in `TASK_CREATE_FIELDS` — a created task lands in Inbox
(`null`). Filing is a separate action after creation.

## `Collection` type — widened to `string` (F-008 OQ-3, closed)

`Collection = 'inbox' | 'today' | 'upcoming' | 'done'` widens to `string`.
The four static members become named constants (`COLLECTION_INBOX`,
`COLLECTION_TODAY`, `COLLECTION_UPCOMING`, `COLLECTION_DONE`). A personal
list's collection id is its uuid — the same `list.id` stored on `task.list_id`.

**Why `string`, not a branded type or a tagged union like `list:${uuid}`.**
The runtime value of a list collection is already a uuid (it is the `list.id`
the client holds). Adding a prefix means every site that reads `task.list_id`
must add the prefix before comparing, and every site that writes a collection
into a preference key must strip it. The brand exists at compile time but the
runtime value is still a string, so the type noise has no safety payoff. A
`string` with constants for the known four is simpler and makes the force run
in the right direction: every `switch` on `Collection` must have a `default`
branch, and that branch is the list-id handler — the absence of exhaustiveness
checking is the forcing function that ensures new call sites handle lists.

**`COLLECTION_GROUPS` gains a third group** below Inbox. The static grouping
(`date: [today, upcoming]`, `filing: [inbox]`, `gate: [done]`) becomes
`date: [today, upcoming]`, `filing: [inbox, ...listIds]`, `gate: [done]`.

**`inCollection` must not be a single classification returning exactly one
answer** (F-008 AC-16). A task is in a date cell and a filing cell
simultaneously. `inCollection(task, collectionId)` returns `boolean` — the
caller iterates, and a task may return `true` for two collections.

`inCollection` for a personal list: `task.list_id === listId && status !==
'done' && parent_id === null`. The step gate (`parent_id`) matches the done
gate — steps are in no collection.

## account — the F-009 preference fields

Added to the account field table at `§ account (new entity — ADR-010)`.

| Field | Type | Required | Constraints | Notes |
|---|---|---|---|---|
| hide_completed | boolean | yes | default `false` | F-009 AC-7; global toggle — when true, done tasks are excluded from every collection except Done |
| sort_preferences | `Record<string, SortOrder>` | no | default `{}`; key is a collection id (a `Collection` string — static name or list uuid); absent key = `'due_date'`; `SortOrder = 'due_date' \| 'priority' \| 'manual'`; `'manual'` valid only when the key is a filing-axis collection (Inbox or a list uuid) | F-009 AC-4, AC-5 |

**Why on `account`, not a new entity.** The account row already holds
user-scoped configuration (timezone). These are two more fields of the same
kind — a per-user preference that every client reads at boot and caches. A
separate entity would need the same lazily-created lifecycle and the same
`PATCH` door, for zero structural benefit. The trade-off: the account row
grows wider, and a future settings surface will also use it. That is a feature,
not a cost.

**`sort_preferences` enforcement.** A PATCH that sets `'manual'` on a date-axis
collection (`today`, `upcoming`, `done`) is refused with `400 VALIDATION`.
The client disables Manual for those collections (F-009 AC-5), so the refusal
is a server guard against a client bug, not a user-facing error.

## Store initialisation pass — `sort_order` migration

On store open, before the first read, the initialisation pass assigns
`sort_order` to every row that lacks it:

1. Group tasks by filing cell: `list_id` (null for Inbox).
2. Within each group, sort by `created_at` ascending.
3. Assign `sort_order = index * 1024` (0, 1024, 2048, ...).

The pass is idempotent — rows that already carry `sort_order` are skipped. It
runs once; after it, every create assigns a value and no row is missing one.
