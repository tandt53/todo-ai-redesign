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
user                      1 ──── *     task (existing todo-ai model — unchanged, no new fields)
```

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
| diff | `{task_id, field, old\|null, new\|null}[]` | yes | `old=null` for create, `new=null` for delete | AC-4 (task_id added so multi-task diffs attribute per row) |
| undo_snapshot | task[] | mutating applying turns only (`changed_task_ids` non-empty) | captured immediately **before** apply, inside the apply transaction; create → records the created task ids (nothing pre-existing to snapshot). Non-mutating applied outcomes (no_match, unsupported_query, unclassifiable, declined resolutions) capture none and never enter the undo window | AC-6 revert shapes + AC-7/AC-12 snapshot comparison |
| question | Question \| null | asked turns | see below | a message, never app state (D2) |
| undo_result | UndoResult \| null | undone turns | see below | renders the reverted-outcome message at its own position |
| post_apply | `Record<task_id, task> \| null` | mutating applying turns only | internal — never serialized to the wire; captured **after** apply, keyed by touched `task_id` | **this is the AC-7 comparison baseline** (C9.3): undo's modified-since check compares a task's current state against its `post_apply` entry, not against `undo_snapshot` — comparing against the pre-apply snapshot would flag the turn's own change as a modification |
| created_ids | uuid[] | yes | may be empty; internal — never serialized to the wire | ids this turn created; undo removes exactly these (mirrors `undo_snapshot`'s create-derivation rule) |
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
kind: "applied" | "question" | "resolution" | "unclassifiable" | "no_match" | "unsupported_query"
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

## task (existing — no fields added)

F-001 adds **no** task fields (spec, Out of Scope), and **ADR-009 adds none
either** — that is the point of it. Prototype serves:
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
| **Filing axis** | Inbox · each personal list | containers — a property of the task | Inbox only; `lists` does not exist |
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
(`reports/owner-decision-2026-08-18-four-buckets.md`). It is not a defect to
narrow later.

**Inbox means "filed nowhere."** Not *"no date"* — that was its meaning for part
of 2026-08-18 only, and it is not what the word means in any app the audience
uses. `lists` and `tasks.list_id` do not exist
(`design/_shared/information-architecture.md` §7), so no task can be filed, so
**every open task is unfiled and Inbox is every open task today.** When personal
lists ship, Inbox narrows by itself: no second rule change, no re-litigation.
Measured before it was taken — 7 of 737 live rows change bucket, all of them
*into* Inbox, none out of anything (ADR-009 § Amendment 2 § 4).

A task with no date is never in Today — open or ticked. It is in Inbox until it
is filed, and after that it is in its list.

### `isFiled` — the predicate, and why there is no `list_id` field

**No `list_id` ships.** No entity field, no schema, no wire change, no migration
— verified absent from all 790 rows in the store. What ships is one named
predicate, whose answer today is `false` for every task **because the filing axis
has exactly one door and this app has not built it**:

```ts
isFiled(t)  = listIdOf(t) !== null      // → false for every task, today
inbox(t)    = t.status !== 'done' && !isFiled(t)
```

Written this way rather than as the shorter `inbox(t) = t.status !== 'done'` for
two reasons that are not style. The predicate on screen then **reads as the
definition**, so Inbox narrows by itself when lists land; and it is **not
token-identical to `open_all`'s membership test**, which is the guard
INV-INBOX-FILING below depends on. A `list_id` column that is always null was
rejected as the dead promise ADR-009 § 2 already refused once — it cannot stay
off the wire, it pre-commits UC-41's shape, and it changes nothing observable
(ADR-009 § Amendment 2 § 3).

**`isFiled` must be answerable `true` in a test today.** A predicate whose only
reachable answer is `false` cannot be exercised, and the invariant below would be
*unproven* rather than passing. The seam's mechanism is the implementer's call;
its existence is not.

### INV-INBOX-FILING — the equality that must never become a definition

> **INV-INBOX-FILING.** `open_all` counts every open task. `inbox_count` counts
> the open tasks in the Inbox **container**. Their equality holds while and only
> while no task is filed. It is a **reading of the store, never a definition**,
> and neither number may be sourced from the other.

They are exactly equal today — 716 = 716 globally and in every one of the 193
accounts holding live tasks — and they diverge the moment the first task is
filed. `design/_shared/components.md` § LandingSummary split these two facts on
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

## Client-side stores (client contracts — not server entities)

| Store | Shape | Durability contract | Notes |
|---|---|---|---|
| `client.pending_input` | `{text: string, updated_at}` | survives process kill (mobile) and tab close/reload (web: durable browser storage) | recognized-so-far text only, never audio; reopens into the composer (AC-26) |
| `client.outgoing_turn` | the full `POST /assistant/turn` request payload + `{sent_at, attempts}` | held until the server acks its `client_turn_id` (2xx/4xx-terminal); survives kill (mobile) and reload (web) | drives retry-with-same-id (AC-16) and queued offline replay, replayed visibly (AC-25, AC-27) |
| `client.permission_state` | `{microphone, speech_recognition?}`, each `granted \| denied \| permanently_denied \| undetermined` | persisted per user alongside the other two stores; re-read on every foreground so an out-of-app grant change is picked up | introduced by F-003 (mobile), where it drives the mic mode and the re-grant CTA (F-003 AC-2/AC-3, F-001 AC-21). `speech_recognition` is present on **iOS only** (Android needs one RECORD_AUDIO grant, web one prompt); `permanently_denied` is reachable on **Android only** — it is the state where the OS never prompts again, so the CTA routes to app settings instead of re-requesting |
| `client.speech_prefs` | `{enabled: bool, updated_at}` | **device-local, never account-scoped** — account scope would ship web speaking without the consent F-002 AC-16 requires. Survives reload and backgrounding on both clients, and **process kill on mobile**; web has no observable for process kill distinct from reload, so the contract is stated per platform rather than claimed for both | introduced by F-002 (AC-6). Default `false` on web (AC-16's opt-in), `true` on mobile |
| `client.interface_language` | BCP-47 string | **build-time constant this phase** (`en-US`, the language of the shipped copy in `design/_shared/components.md` — ADR-008, *owner decision 2026-08-17*; was `vi-VN`) — not user-editable, because no settings surface is a deliverable | introduced by F-002 (AC-23) as the **single declared source** read by both the synthesiser and the recognizer. It exists to end a live three-way drift, **which ADR-008 does not resolve**: web recognition uses `navigator.language \|\| 'en-US'` (`src/assistant/web/ports/web-speech-source.ts:50`) — the wrong mechanism whatever it resolves to — and mobile hardcodes `'vi-VN'` (`src/assistant/mobile/ports/native/rn-transcript-source.ts:71`), now a per-port constant **and** the wrong language. **Aligning the two recognizer ports is follow-up drift, not F-002's build** — F-002 declares the value; F-001/F-003 surface consumes it |

**Not client stores, and deliberately not listed above:** F-002's `speech.utterance` and `speech.decision_log` are **transient in-memory** state, never persisted and never sent to the server — a slot of size one and an in-process log respectively. Their shapes are declared in `specs/assistant/F-002-talk-back.md ## Data`, which is the single home for them; they are named here only so a reader looking for "where does talk-back keep its state" is not left to conclude the list is incomplete.

Ack rule: a `200` (including `replayed: true`), `409 SESSION_CLOSED`-then-
successful-replay, or terminal `4xx` clears the store; `502 AI_ERROR` and
network failure keep it (retry same id). At most one outgoing turn is held;
the composer is the queue of length one (spec User Flow: send → thinking).
