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
# kind=unsupported_query → {alternative: "danh sách và bộ lọc trên màn hình"}                 # AC-15
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

## task (existing — unchanged)

F-001 adds **no** task fields (spec, Out of Scope). Prototype serves:
`id (uuid, client-generatable — POST /tasks accepts optional id, 409
TASK_ID_EXISTS on collision), title, due_at, reminder_at, priority,
status(inbox|today|done|archived), updated_at, deleted_at (soft delete),
created_at`. Owned per `user_id`; the assistant marks rows only via
`turn.changed_task_ids`, never by writing marker fields onto tasks (AC-4:
only the turn's own changes are marked).

## Client-side stores (client contracts — not server entities)

| Store | Shape | Durability contract | Notes |
|---|---|---|---|
| `client.pending_input` | `{text: string, updated_at}` | survives process kill (mobile) and tab close/reload (web: durable browser storage) | recognized-so-far text only, never audio; reopens into the composer (AC-26) |
| `client.outgoing_turn` | the full `POST /assistant/turn` request payload + `{sent_at, attempts}` | held until the server acks its `client_turn_id` (2xx/4xx-terminal); survives kill (mobile) and reload (web) | drives retry-with-same-id (AC-16) and queued offline replay, replayed visibly (AC-25, AC-27) |
| `client.permission_state` | `{microphone, speech_recognition?}`, each `granted \| denied \| permanently_denied \| undetermined` | persisted per user alongside the other two stores; re-read on every foreground so an out-of-app grant change is picked up | introduced by F-003 (mobile), where it drives the mic mode and the re-grant CTA (F-003 AC-2/AC-3, F-001 AC-21). `speech_recognition` is present on **iOS only** (Android needs one RECORD_AUDIO grant, web one prompt); `permanently_denied` is reachable on **Android only** — it is the state where the OS never prompts again, so the CTA routes to app settings instead of re-requesting |

Ack rule: a `200` (including `replayed: true`), `409 SESSION_CLOSED`-then-
successful-replay, or terminal `4xx` clears the store; `502 AI_ERROR` and
network failure keep it (retry same id). At most one outgoing turn is held;
the composer is the queue of length one (spec User Flow: send → thinking).
