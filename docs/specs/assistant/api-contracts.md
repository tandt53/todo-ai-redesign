# API Contracts — assistant module

**Single source of truth for all API shapes** (MANIFEST `## Ownership`).
Implementers and QA read this and do not deviate. Feature: F-001 (spec rev 3 —
its contract sentences are binding; this file implements them, never weakens
them). Server: prototype-grade per ADR-001, but every rule below is enforced
for real — QA's API suite runs against it.

## Conventions

- Base URL: prototype server, default `http://localhost:4460`.
- Auth (prototype): every request carries `X-User-Id: <uuid>` identifying the
  account. Missing/empty → `401 UNAUTHENTICATED`. No cross-account access:
  ids owned by another user behave as `404 NOT_FOUND`.
- **`X-Timezone: <IANA zone>` on every request** (F-005, ADR-010). It is a
  *report*, never a computation input: the auth step passes it to the single
  installer `recordClientZone(...)`, which creates the account row if absent and
  sets `account.timezone` **only when it is currently unset**. Every date
  computation reads `account.timezone` and never this header. A malformed zone
  is ignored (recorded as a report, never stored); the header is not a body
  field, so `rejectUnknownFields` is unaffected. See § The account and the zone.
- Bodies are JSON (`content-type: application/json`). Validation failures →
  `400 VALIDATION` with `{error: {code, message, field?}}`.
- **Unknown request fields are rejected**: any field not named in the
  endpoint's request shape → `400 VALIDATION` naming the field, zero side
  effects. One policy for every endpoint (pinned by TC-34).
- Error envelope (all non-2xx): `{ "error": { "code": string, "message": string, "detail"?: object } }`.
- Any unhandled server fault → `500 INTERNAL`, no detail, stack traces never leaked.
- Entity shapes (`Turn`, `Session`, `UndoOutcome`, `Task`) are defined in
  [data-model.md](data-model.md); this file defines wire behaviour.
- Internal refs never render: responses may carry task uuids as identifiers,
  but no draft-ref tokens (`#d1` style) exist anywhere in this API, and
  clients render titles/fields, never raw uuids (spec AC-4).

---

## POST /assistant/turn

One conversation turn: interpret server-side + apply atomically. **A new
contract, not an extension of the existing app's `chat-intent`** (ADR-002
supersedes ADR-9 for this surface). Confirmation and clarification **answers
are normal turns on this endpoint** — a tap sends the option's literal text;
there is no separate confirm protocol (spec, API Touch Points). The server
processes a session's turns **serially in receipt order** (AC-10).

**AI endpoint parameters** (server → model, via the `Interpreter` port):

- `model:` resolved from server config `interpreter.model`; prototype default
  `claude-opus-5`. Never chosen by the client.
- `max_tokens:` 1024
- `temperature:` not sent — the parameter is removed on current Claude models
  (request would 400). Determinism in tests comes from the fixture-stub
  interpreter, not sampling.

The stub Interpreter replaces **model interpretation only, including answer
classification** (affirmative / negative / unclassifiable from fixture rows);
orchestration, gating, resolution, persistence, dedupe and undo always run
real (spec, Test strategy).

### Request

```yaml
session_id:        uuid | null   # null = resume the account's open session, or open a new one
client_turn_id:    uuid          # required; client-generated; dedupe key (AC-16)
transcript:        string        # required, non-empty; recognized TEXT only — never audio (AC-20)
source:            "voice" | "typed" | "tap"
answer_to_turn_id: uuid | null   # tap answers only: explicit binding to the question's turn (AC-10);
                                 # voice/typed answers bind to the newest unresolved question
timezone:          string | null # IANA tz, optional interpretation context.
                                 # F-005/ADR-010: this is a SECOND reporting
                                 # channel into the same installer as
                                 # `X-Timezone`, kept so existing clients do not
                                 # break. It is redundant with the header and it
                                 # is NEVER the source a date computation reads.
open_task_id:      uuid | null   # F-005 AC-51: optional; the task whose detail
                                 # the client currently has open. Per-turn
                                 # interpretation context — a reference-resolution
                                 # hint, NOT a scope filter (AC-50). Untrusted:
                                 # the server verifies ownership under the account
                                 # scope of ADR-005; a deleted or unowned id is
                                 # treated as absent (no error, no side effect).
                                 # Unlike `timezone`, this is the ONLY channel for
                                 # this signal — not a second reporting path. It
                                 # belongs here alongside `answer_to_turn_id`
                                 # (per-turn context that directly affects
                                 # processing), not in a header.
```

### Processing rules (contract-level)

1. **Session resolution.** Lazy idle close runs first (ADR-004). Then:
   `session_id: null` → the account's open session, or a new open session if
   none. An explicit `session_id` naming a closed session → `409
   SESSION_CLOSED` (closed sessions accept no turns); the client re-syncs via
   `GET /assistant/session` and re-sends the **same** `client_turn_id` — the
   replay targets the new session and the id is still recognized (AC-16).
2. **Dedupe — per status, account scope** (AC-16, ADR-005). If
   `(user_id, client_turn_id)` exists: status `applied | asked | undone` →
   re-serve the recorded outcome, `replayed: true`, nothing re-executes;
   status `failed` → re-attempt (failed → pending under the same id);
   status `pending` (still in the queue) → `409 IN_FLIGHT`.
   A same-id request whose `transcript`, `source`, or `answer_to_turn_id`
   differs from the recorded one is not a replay but an id reuse →
   `409 CLIENT_TURN_ID_REUSED`, nothing executes. `session_id`, `timezone`
   and `open_task_id` are excluded from the comparison — a post-close replay
   legitimately carries a different session, and a replay with a different
   detail open must re-serve the recorded outcome without re-resolving
   (F-005 AC-51; pinned by TC-25).
3. **Voice-undo guard** (ADR-006). If the normalized transcript is exactly an
   undo phrase (`"undo"` — the whole closed list since ADR-006's amendment
   of 2026-08-17), the turn is **not** interpreted and **no turn row is
   created**: the server executes the undo path against the newest applied
   turn of the open session (identical semantics to
   `POST /assistant/turn/{turn_id}/undo` with `via: "voice"`), records the
   outcome under this `client_turn_id` for dedupe, and returns
   `kind: "undo"`. The utterance can never become a task (AC-5).
   A guard **refusal** (e.g. no applied turn exists → `not_undoable`) also
   creates no turn row but still consumes the `client_turn_id`: the `409
   UNDO_REFUSED` outcome is recorded under it, and a same-id retry re-serves
   the recorded refusal without re-evaluating — it never undoes a turn
   applied in between (pinned by TC-24).
4. **Persist before interpreting.** `transcript_raw` and `open_task_id`
   (F-005 AC-51) are stored (turn row, status `pending`, appended to session
   history) before the Interpreter is called — a failed turn never loses the
   user's words (AC-23), and the binding is recorded for audit and dedupe.
5. **Snapshot freshness (OQ 7).** The interpretation context (the user's
   current tasks) is read **fresh inside this turn's serial-queue slot**, in
   the same transaction scope as the apply. No client-supplied task or draft
   state is accepted or trusted, so a turn issued right after a manual edit
   sees the edited state (UC-09 AC-09.2).
6. **Plan, capture, apply — in that order** (**amended by F-005 AC-46,
   ADR-013**; before F-005 this rule read *"`undo_snapshot` is captured
   immediately before apply"* and that sentence was falsified by rows the
   server creates or changes *as a consequence of* a turn). Inside the apply
   transaction the turn (a) **plans** every row it will write — targets, the
   steps a completion cascades to (F-005 AC-19), the successor a repeating
   completion generates with its id allocated now (F-005 AC-26), the successor
   an un-complete removes (F-005 AC-28) — performing no writes; (b) **captures**
   `undo_snapshot` over every planned row that already exists and `created_ids`
   over every planned row that does not; (c) **applies**; (d) captures
   `post_apply` over every row written. The plan is the only producer of the
   caused set — apply consumes it and never re-derives it. An applying turn's
   changes land all-or-nothing (AC-1, AC-6). A turn that produces a question
   applies nothing
   (AC-1 carve-out). If the apply transaction itself fails mid-way it aborts
   atomically — zero partial writes — the turn resolves `status: "failed"`
   with its transcript preserved (AC-23), and the endpoint returns
   `500 APPLY_FAILED`; a same-id retry re-attempts, failed → pending
   (AC-16; pinned by TC-02).
7. **Bulk-delete gate.** A delete touching > 1 task is refused-to-apply and
   returns a `confirm` question naming count and titles; single-task delete
   applies immediately (AC-9). On an affirmative answer the named tasks are
   re-validated by snapshot comparison against ask-time state; changed or
   deleted tasks are dropped and the outcome states actual count and names
   (AC-12).
8. **Question resolution (D2, AC-10/AC-11/AC-13).** One-shot: a question
   resolves exactly once. Clearly affirmative → execute; negative → decline;
   any unrelated interpretable command → the question is declined
   (`declined_superseded`) and the command proceeds normally; unclassifiable
   utterance → nothing executes, question stays pending, the turn's outcome
   is `unclassifiable`. An answer arriving after resolution applies nothing —
   never executes the questioned delete — and yields `already_resolved`.
   Resolutions caused by this turn are reported in `resolutions[]` and
   recorded on the asked turn's `question.resolution`.
9. **No-match honesty.** A command matching no task applies zero task
   mutations and returns `no_match` quoting the heard transcript (AC-14).
   A question **about** the list returns `unsupported_query` naming the
   working alternative — `alternative: "the on-screen list and its filters"` —
   zero mutations (AC-15).

### Response — 200

```yaml
session_id: uuid
kind:       "turn" | "undo"     # "undo" only from the voice-undo guard
replayed:   boolean             # true when served from dedupe
turn:       Turn | null         # kind=turn; turn.status ∈ applied | asked
undo:       UndoOutcome | null  # kind=undo; same shape as the undo endpoint's 200
resolutions:                    # question resolutions caused by this turn (0..1)
  - question_turn_id: uuid
    result: "executed" | "declined" | "declined_superseded" | "already_resolved"
```

`turn.outcome.kind` (message anatomy — see data-model.md):
`applied` · `question` · `resolution` · `unclassifiable` · `no_match` ·
`unsupported_query` · **`refused`** (F-005 AC-36/AC-40 — a seventh member; see
§ The refused turn). Cancel is client-local: there is **no cancel endpoint**;
a sent turn always runs to completion and its late outcome renders from this
response or from `GET /assistant/session` (AC-3).

### Errors

| Status | code | Reason |
|---|---|---|
| 400 | VALIDATION | missing/empty `transcript` or `client_turn_id`, bad uuid, bad `source` |
| 401 | UNAUTHENTICATED | missing `X-User-Id` |
| 404 | NOT_FOUND | `session_id` / `answer_to_turn_id` unknown to this account |
| 409 | SESSION_CLOSED | explicit `session_id` is closed — re-sync via GET, replay same id |
| 409 | IN_FLIGHT | same `client_turn_id` is still being processed |
| 409 | CLIENT_TURN_ID_REUSED | same `client_turn_id`, divergent `transcript`/`source`/`answer_to_turn_id` — nothing executes (TC-25) |
| 409 | UNDO_REFUSED | voice-undo guard refusal (`detail.reason` as in the undo endpoint, incl. `not_undoable` when no applied turn exists); no turn row; recorded under the `client_turn_id` for dedupe (TC-24) |
| 500 | APPLY_FAILED | apply transaction aborted atomically, zero partial writes; turn persisted `status: failed` with transcript (AC-23); body carries `{error, turn}`; retry same id re-attempts (TC-02) |
| 502 | AI_ERROR | interpretation failed; turn persisted `status: failed` with transcript (AC-23); body carries `{error, turn}`; retry with the **same** `client_turn_id` re-attempts (AC-16) |

---

## GET /assistant/session

Read the open session (resume) **and**, on a clean start, the closed
session's boundary outcomes (AC-28). Lazy idle close runs before answering
(ADR-004): a session idle ≥ 180 s is closed here with reason `idle`, so a
stale session is never returned as open.

### Response — 200

```yaml
session:  Session | null   # the open session incl. messages: Turn[] in seq order; null = clean start
boundary: Boundary | null  # present iff session is null and a closed session exists
```

`Boundary` (renders as exactly **one** boundary message — AC-28):

```yaml
session_id:   uuid
closed_at:    iso8601
close_reason: "idle" | "user_closed"
declined_questions:            # every question declined by close, by name
  - { turn_id: uuid, kind: "bulk_delete" | "clarify", task_titles: [string] }
late_outcomes:                 # turns resolved between last foreground and close
  - { turn_id: uuid, status: "applied" | "failed", outcome: TurnOutcome }
```

### Errors

| Status | code | Reason |
|---|---|---|
| 401 | UNAUTHENTICATED | missing `X-User-Id` |

---

## POST /assistant/session/close

Close the session, record the reason. Closing resolves every unanswered
question as **declined** (D2; visible on next open via the boundary) and ends
the undo window (AC-8).

### Request

```yaml
session_id: uuid
reason:     "user_closed"     # server-initiated idle close uses "idle" (ADR-004), never via this endpoint
```

### Response — 200

```yaml
session: { id: uuid, status: "closed", close_reason: string, closed_at: iso8601 }
declined_question_turn_ids: [uuid]
already_closed: boolean       # true = idempotent no-op on an already-closed session
```

### Errors

| Status | code | Reason |
|---|---|---|
| 400 | VALIDATION | bad/missing fields |
| 401 | UNAUTHENTICATED | missing `X-User-Id` |
| 404 | NOT_FOUND | unknown `session_id` for this account |

---

## POST /assistant/turn/{turn_id}/undo

Revert an applied turn from its `undo_snapshot` (AC-5..8). The **window check
and the revert run in one transaction** (AC-6). Revert shapes: edit → prior
field values restored; create → created tasks removed (and staying removed on
a fresh task-list read); delete → tasks restored with all fields intact.

**Two more shapes after F-005 (AC-46, ADR-013), and their revert conditions
differ by class:**

- **A row the turn *created* as a consequence — the generated successor
  (F-005 AC-26).** It is in `created_ids` like any create, and it is removed
  **only if it would still be removable under F-005 AC-28's five conditions**
  (same `series_id`, created no earlier than the completion, never edited, not
  itself done, **no step of it ticked or changed**); otherwise it stays and is
  named in `skipped`. The whole-row `taskEquals` comparison is **not**
  sufficient here — condition five touches the *step's* row, not the
  successor's.
- **A row the turn *changed* as a consequence — a step ticked by F-005 AC-19's
  cascade.** It is in `undo_snapshot` and `post_apply` like any edit, and it is
  reverted **on its own snapshot comparison under AC-19's `completed_by_parent`
  guard** — never as a side effect of the parent's row being replaced, because
  the replacement bypasses the guard.

**`skipped` names top-level tasks only.** A step that could not be reverted is
reported through its parent (the parent is named, and the message states that
its steps were not fully reversed) — step titles are never rendered, because a
step is neither drawn (F-005 AC-35) nor addressable (F-005 AC-36).

Modified-since detection is **snapshot comparison**: a task is skipped iff its
current state differs from the task's **post-apply state** — the state the
turn itself left the task in immediately after applying (for an edit/create,
the new values; for a delete, "deleted"). Comparing against the pre-apply
`undo_snapshot` entry instead would make undo revert nothing, since every
task the turn itself changed would already read as "modified". Zero silent
overwrites, every skipped task named (AC-7).

### Request

```yaml
via: "tap" | "voice"   # optional, default "tap"; recorded in undo_result
```

### Response — 200 (`UndoOutcome`)

```yaml
turn_id:          uuid
undone:           true
already_undone:   boolean   # true = idempotent replay: same success outcome, no second revert (AC-6)
reverted:         [{ task_id: uuid, title: string }]
skipped:          [{ task_id: uuid, title: string, reason: "modified_since_apply" }]
nothing_reverted: boolean   # true when every task was skipped — renders as "nothing was reverted", never as success (AC-7)
via:              "tap" | "voice"
```

The undone turn stays visible with `turn.status: "undone"`; the read-back
observable is a subsequent task-list `GET /tasks` returning reverted values.
An **all-skipped** undo still transitions the turn `applied → undone` — the
undo is consumed; a retry is AC-6's idempotent replay of the same
nothing-reverted outcome, which never renders as a successful revert
(AC-7; pinned by TC-22).

### Errors — refusals are visible outcomes, never silence (AC-6, AC-8)

| Status | code | Reason |
|---|---|---|
| 401 | UNAUTHENTICATED | missing `X-User-Id` |
| 404 | NOT_FOUND | unknown `turn_id` for this account |
| 409 | UNDO_REFUSED / `reason: "not_newest"` | turn is not the newest applied turn of the open session |
| 409 | UNDO_REFUSED / `reason: "session_closed"` | the turn's session is closed |
| 409 | UNDO_REFUSED / `reason: "not_undoable"` | turn status is `pending`/`asked`/`failed`, the turn applied no mutation (`changed_task_ids` empty — never in the window), or (voice-guard path) no mutating applied turn exists |

409 body: `{error: {code: "UNDO_REFUSED", message, detail: {reason, turn_id}}}`.
The client renders the refusal as the AC-6 outcome message stating why.
After an undo, the previous mutating applied turn (if any) becomes the newest
again — the refusal rule is mechanical: undo succeeds iff
`status == "applied"` and the turn has the max `seq` among applied turns
**with non-empty `changed_task_ids`** of the open session. Only turns that
actually mutated tasks occupy or advance the undo window: a non-mutating
applied turn (`no_match`, `unsupported_query`, `unclassifiable`, a
declined/superseded/already-resolved resolution) captures no `undo_snapshot`,
is itself refused `not_undoable`, and leaves the previous turn's undo window
untouched — a misheard utterance never spends the undo (AC-8's
session-bounded window has no hidden expiry).

---

## Prototype task CRUD (supporting endpoints)

The manual path (AC-18, zero AI calls — proven by the harness AI-call
counter) and read-back observables (AC-6, AC-14) run against these. **F-005
widens all four and adds four routes — the shapes below are the F-001 baseline
and § Feature F-005 is authoritative where the two differ.** (The sentence
*"task shape is the existing todo-ai model, unchanged"* was true for F-001 and
is false after F-005; the field list is `data-model.md § task`.)

| Method + path | Purpose | Success | Errors |
|---|---|---|---|
| `GET /tasks` | list the account's tasks (read-back observable) | 200 `{tasks: [Task]}` | 401 |
| `POST /tasks` | create `{id?, title, due_at?, priority?, status?}` — **widened by F-005** | 201 `{task}` | 400, 401, 409 |
| `PATCH /tasks/{id}` | edit any mutable field — **widened by F-005** | 200 `{task}` | 400, 401, 404 |
| `DELETE /tasks/{id}` | delete (soft: `deleted_at`) — **gains `scope` in F-005** | 200 `{task}` | 401, 404 |

None of these touch the Interpreter — the AI-call counter must read zero for
any pure-CRUD scenario (AC-18, AC-25 offline local path).

`status?` on both write endpoints is narrower than `TaskStatus` — see
§ `status` on the wire below. Un-completing a task sends `status: "inbox"` and
**does not send `due_at`**: leaving the date untouched is what returns the task
to the date collection it came from. Since the second 2026-08-18 amendment it
returns to its **container** too, for the same reason — filing is not a status
either, so completion never disturbed it (ADR-009).

`id` on `POST /tasks` is optional and **client-generated** (uuid): the
offline local path (AC-25) creates the task locally under a real id and
replays the create on reconnect — no temporary-id mapping exists. A colliding
id → `409 TASK_ID_EXISTS`; a client replaying its own create treats that 409
as already-synced (its ack). Omitted `id` → server generates one.

### `status` on the wire (ADR-009)

**Accepted values on `POST /tasks` and `PATCH /tasks/{id}` are `inbox`, `done`
and `archived`.** `today` is **rejected** — `400 INVALID_INPUT`, `field:
"status"` — and it is the one member of `TaskStatus` that this is true of. It is
retired as a live value: membership in Today is `due_at`, not `status`
(data-model.md § The four collections). **The 2026-08-18 amendment adding the
Upcoming collection changes nothing on the wire**: `upcoming` is a client-side
view over `due_at`, never a status, so it is neither an accepted nor a returnable
`status` value. **The second 2026-08-18 amendment — Inbox is the tasks filed into
no personal list — likewise changes nothing on the wire, and specifically adds no
`list_id`.** `task` gains no field, the write vocabulary is untouched, no status
is named after a list, and no endpoint learns about filing. Inbox is a
client-side predicate over a filing state this app cannot yet express, so its
answer today is *unfiled* for every task; ADR-009 § Amendment 2 § 3 records why
shipping an always-null column was rejected rather than deferred. The union keeps
the `today` member because historical
records hold it; the wire is the write path, and the write path is where it is
stopped from being minted again.

`GET /tasks` may still **return** `status: "today"` for rows created before
ADR-009. Clients treat it as equivalent to `inbox` — not done, not in Today —
and never send it back.

**No offline replay is affected.** The offline local path creates tasks with
`status: "inbox"`, so a queued create can never carry `today` (AC-25). The one
break is a **stale client** whose bundle predates ADR-009: un-ticking a task
sends `status: "today"`, gets a 400, and — because `toggleTask` dispatches
optimistically and ignores the response — shows the task un-ticked until its next
`GET /tasks`. The window is one page load wide; ADR-009 takes it deliberately
over silently normalising `today` to `inbox`, which would keep a translation rule
alive forever for a value nothing should send.

### Creating a task in a collection

`POST /tasks` sets **the date, not the status**, when the client creates from a
collection (`owner-decision-2026-08-18-landing-and-collections.md` §2, sharpened
by `owner-decision-2026-08-18-today-is-a-date.md`):

| Created while viewing | Body sends |
|---|---|
| Today | `status: "inbox"`, `due_at:` **the local start of today**, as an ISO instant |
| **Upcoming** | **open — no contract value yet.** Upcoming's predicate is `due_at` *after today*, which names no single instant the way Today's day does, so no date is derivable and none is invented. The candidates (local start of tomorrow · `null` with the task announced as landing in Inbox · no composer on Upcoming at all) and their costs are in ADR-009 § The one cell this amendment refuses to fill; the call is design's / the owner's. **Until it is made, the client sends `due_at: null`** — the accidental answer today's code gives, recorded here so it is visible rather than silent |
| Inbox | `status: "inbox"`, `due_at: null` — **value unchanged by the 2026-08-18 filing amendment, and its reason is now cleaner**: Inbox is a container and a container names no date, so nothing is derivable from it. The task is created unfiled *and* undated, which lands it in Inbox on both axes |
| Done | `status: "inbox"`, `due_at: null` — a task cannot be created finished |

**The start of the local day, not the moment of creation.** `due_at` is a
timestamp and "today" is a day, so the instant is fixed here or web and mobile
pick differently and group the same task differently. Ordering inside the Today
group is unaffected — this repo orders by `created_at` (`uc-coverage-map.md` D5).

The collection is a **client** concept. The server receives a `due_at` and has no
opinion about which day it belongs to; no endpoint takes a collection parameter.
This is what makes the four-bucket amendment a **zero-endpoint change**: adding
Upcoming adds no field, no parameter and no status value, because the buckets are
read from a date the server already stores and serves.

---

# Feature F-005 — task detail

**Added**: 2026-08-19 by architect-agent (T-160). Spec:
`docs/specs/assistant/F-005-task-detail.md` (revision 4, Gate 1 closed).
Entities and field semantics: `data-model.md § task` and `§ account`.
Decisions with alternatives: **ADR-010** (account + zone), **ADR-011**
(recurrence), **ADR-012** (delete membership + restore), **ADR-013** (turn
causality), **ADR-014** (run count), **ADR-015** (step order).

F-005 changes the four CRUD endpoints, adds four routes, adds a seventh
`TurnOutcome` member, and amends `POST /assistant/turn` rule 6 and the undo
endpoint's revert shapes (both in place, above). It adds **no** new assistant
conversation endpoint.

## The seven closed field lists — which of them this file governs

`F-005 ## Impact §1` counts sixteen enumerations of the task's fields in
`src/**`, of which **seven gate behaviour**. This file is authoritative for
four of them and names the other three so nobody treats the list as complete:

| Site | Governed by |
|---|---|
| `api/app.ts` `TASK_PATCH_FIELDS` + the `taskChangesFrom` switch | § `PATCH /tasks/{id}` below |
| `api/app.ts` `TASK_CREATE_FIELDS` | § `POST /tasks` below |
| `engine/serialize.ts` `TaskWire` / `serializeTask` | § `Task` on the wire below |
| `engine/apply.ts` `DIFF_FIELDS` | § The turn path below — **it splits into two constants** |
| `engine/apply.ts` `NewTaskFields` (turn-path create allowlist) | § The turn path below |
| `engine/task-equals.ts` `FIELDS` | `data-model.md § task` — the field list plus AC-34's two comparison rules |
| `_shared/controller.ts` `pushLocalTasks`'s replay literal | `docs/specs/_shared/platform/web.md` / `mobile.md` § F-005 — a **client** projection; no endpoint check can see it |

## The multi-row response rule

**Any write that changes more than one row returns every row it changed**
(AC-26, AC-2). The rule, not a list of the writes it applies to:

```yaml
# every 2xx from POST /tasks, PATCH /tasks/{id}, DELETE /tasks/{id},
# POST /tasks/{id}/restore and POST /tasks/{id}/reminder-ack
task:    Task          # the row the request addressed
changed: [Task]        # every OTHER row this write changed; may be []
                       # the addressed row is never repeated here
```

Writes that populate `changed` today: completing a repeating task (the
successor), completing or un-completing a parent (the cascade), un-completing a
repeating task (the removed successor — reported by id in `removed`, below),
deleting a parent (its steps), deleting a series (every unfinished occurrence
and its steps), restoring a cluster or a series, and a step move that exhausts
its gap (ADR-015). The list illustrates the rule; it does not bound it.

```yaml
removed: [uuid]        # rows HARD-removed by this write. Three producers:
                       # (1) AC-28's successor removal on un-complete —
                       # deliberately not a soft delete because a soft-removed
                       # successor would be restorable and would produce the
                       # second open occurrence the recurrence section rests
                       # on not having;
                       # (2) F-006 AC-11's delete-forever (one entry);
                       # (3) F-006 AC-17's empty-trash (all entries).
                       # Producers (2) and (3) return { removed } only,
                       # without task or changed — see § F-006 note above.
                       # Omitted when empty.
```

**The client applies what a write returns** — `task`, every member of
`changed`, and it drops every id in `removed`, on **both** clients. A blind
`GET /tasks` after a write is not the mechanism: the rows are already in hand.
(The blind refresh is not *forbidden* — `controller.ts:442` performs exactly
one after every mutating turn, and AC-3's "no manual refresh" means no user
gesture.)

## `Task` on the wire

`serializeTask` emits exactly this. Fields marked **internal** exist on the row
and are never serialized.

```yaml
id:                 uuid
title:              string
note:               string | null          # AC-6; never "" — whitespace-only stores null
due_at:             iso8601 | null
due_all_day:        boolean | null         # AC-13. null = NOT DETERMINED (see below)
reminder_at:        iso8601 | null
reminder_shown_at:  iso8601 | null         # AC-38; carried so a client can tell an
                                           # acknowledged reminder from an unacknowledged one
priority:           "none" | "low" | "medium" | "high"   # AC-8; never null on the wire
status:             "inbox" | "today" | "done" | "archived"
parent_id:          uuid | null            # AC-18; a step has exactly one parent
step_order:         integer | null         # AC-15, ADR-015; null for a top-level task
completed_by_parent: boolean               # AC-19; false for a top-level task
repeat_frequency:   "day" | "week" | "month" | "year" | null   # ADR-011
repeat_interval:    integer | null         # >= 1
repeat_weekdays:    string | null          # canonical: subset of "mo,tu,we,th,fr,sa,su" in that order
repeat_month_days:  string | null          # canonical: ascending ints 1-31, comma-joined
repeat_until:       iso8601-date | null    # inclusive; exclusive-with repeat_count
repeat_count:       integer | null         # >= 1; exclusive-with repeat_until
series_id:          uuid | null            # AC-25; assigned when a repeat is first set, never cleared
series_live:        boolean                # AC-25 — DERIVED server-side, see below
list_id:            uuid | null            # F-008 AC-10; null = Inbox (unfiled)
sort_order:         integer                # F-009 AC-5; sparse, gaps of 1024
created_at:         iso8601
updated_at:         iso8601
deleted_at:         iso8601 | null
# internal, never serialized: user_id, ever_completed (ADR-014),
# delete_gesture_id (ADR-012), series_ended_at
```

**`priority` is never `null` on the wire.** `none` is the absence of a stored
value (AC-8): the row stores `null`, the serializer emits `"none"`. This is
what keeps `## Data`'s `Required: yes` and the measured migration-free claim
true at once — the 783 `null` rows already *are* `none`. Reads stay tolerant:
a stored value outside the set is emitted as `"none"`, never as itself and
never as an error (ADR-009's precedent for `status: 'today'`).

**`due_all_day: null` means *not determined*, and a client renders such a due
as a date with no clock time.** It is not a third state of the flag and not a
fallback; it is the read-side outcome when the row carries no stored flag and
the account has no zone to resolve it in (ADR-010). Resolution rules, in order:

1. A **stored** `due_all_day` is authoritative wherever present, on every tier.
2. Absent, and `account.timezone` is set: the server resolves it — **all-day
   iff the stored instant is the local start of its own day in that zone**,
   timed otherwise (AC-13) — and emits `true`/`false`. The row is not rewritten
   by the read; the next write that touches `due_at` stores the resolved value.
3. Absent, and `account.timezone` is unset: `null`.

**A read never refuses.** AC-18's *"a refused write writes nothing"* governs
writes; a read withholds a **derived value**, never a row. Refusing the read
would make `GET /tasks` unrenderable for an account with no zone — measured, on
day one that is every row of every account, since 0 of 790 rows carry the flag.

**`series_live` is derived, never stored and never keyed off `series_id`**
(AC-25, AC-39). It is `true` iff the row's repeat is still set **and** none of
AC-25's four endings has fired:

```
series_live = repeat_frequency != null
           && series_ended_at == null            # AC-30's series delete
           && !(repeat_until  != null && repeat_until  < today_in_account_zone)
           && !(repeat_count  != null && run_count(series_id) >= repeat_count)

run_count(S) = count(rows where series_id = S and ever_completed)   # ADR-014
```

Clearing the repeat is the fourth ending and needs no marker: it clears
`repeat_frequency`, so the first conjunct is false. `series_id` survives
clearing (AC-25), which is exactly why it must not be the predicate.

## `GET /tasks`

Unchanged in shape: `200 {tasks: [Task]}`, deleted rows filtered out, scoped to
`X-User-Id`. What changes:

- **Steps are returned as ordinary rows** carrying `parent_id` and
  `step_order`. There is no nested representation on the wire; the client
  nests. A step is excluded from every collection and every count by the
  client's `inCollection` gate — **beside the done gate, never through
  `isFiled`** (AC-35), because a step is not a container and calling it filed
  breaks the reading `INV-INBOX-FILING` depends on.
- Every field in § `Task` on the wire is present on every row.
- **The server still has no opinion about collections** (ADR-009): it serves an
  instant and a flag; Today / Upcoming / Inbox / Done stay client-side
  predicates over `due_at` and filing. F-005 does not move that boundary.

## `POST /tasks`

**`TASK_CREATE_FIELDS`, in full** — enumerated here rather than grown ad hoc,
because a create that cannot carry a step's parent becomes POST-then-PATCH with
a window in which the step exists at an undefined position and AC-3 renders it
to every other client (AC-14):

```yaml
id:                uuid            # optional, client-generated (F-001 AC-25 offline path)
title:             string          # required, non-empty after trim
note:              string | null
due_at:            iso8601 | null
due_all_day:       boolean | null  # supplied by the offline replay; see below
reminder_at:       iso8601 | null  # NEW - POST refused this field before F-005
priority:          "none"|"low"|"medium"|"high" | null
status:            "inbox" | "done" | "archived"     # `today` still rejected (ADR-009)
parent_id:         uuid | null     # NEW - this is what makes a step creatable in one call
step_order:        integer | null  # NEW - see below
repeat_frequency:  ... | null      # the six ADR-011 members, same names as the wire
repeat_interval:   integer | null
repeat_weekdays:   string | null
repeat_month_days: string | null
repeat_until:      date | null
repeat_count:      integer | null
```

- **A create supplying `step_order` keeps it; a create supplying none is
  appended last, positioned by the server** (ADR-015, `## Data`). The
  unconditional reading — *server always assigns* — silently voids AC-14's
  offline replay while every AC still reads as satisfied, which is why it is
  stated in both directions.
- **A create supplying `due_all_day` keeps it.** This is the offline mobile
  create's answer (ADR-010): a task created offline while viewing Today is
  written locally as all-day and the replay carries the flag, so the row never
  needs re-deriving and the *one row, three answers* case cannot arise for it.
- **`parent_id` must name a live, non-step row of the caller's** — else `400
  VALIDATION` (`field: "parent_id"`). A step of a step is refused (AC-18); a
  step may carry no repeat (AC-18).
- A create carrying a repeat gets a `series_id` and is aligned under AC-22 /
  AC-23 before it is written; if that computation needs a zone and there is
  none, the create is refused (`409 TIMEZONE_UNKNOWN`).
- **`reminder_shown_at`, `series_live`, `series_id`, `completed_by_parent`,
  `deleted_at` are not creatable.** Sending one is `400 VALIDATION` naming the
  field, per the one unknown-field policy.
- Response `201 {task, changed}`.

*(Contract inversion, deliberate and named so nobody weakens the assertion
instead: `api/__tests__/tasks.test.ts:74` asserts that `POST /tasks` with
`reminder_at` returns 400 naming the field. That assertion must now be
inverted — it pins the gap F-005 closes.)*

## `PATCH /tasks/{id}`

**`TASK_PATCH_FIELDS`, in full:** `title`, `note`, `due_at`, `due_all_day`,
`reminder_at`, `priority`, `status`, `step_order`, **`list_id`** (F-008),
**`sort_order`** (F-009), and the six ADR-011 repeat members. That is the
create list **minus `id` and `parent_id`, plus `step_order`** — which is
patchable, and is how a move is made (ADR-015). **`list_id` and `sort_order`
added by F-008/F-009** — see § `PATCH /tasks/{id}` — F-008 / F-009 amendments.

`parent_id` is deliberately **not** patchable: a step does not change parents
this phase, and re-parenting is a gesture no AC describes and no control
offers. `reminder_shown_at`, `series_live`, `series_id`, `completed_by_parent`,
`ever_completed`, `series_ended_at`, `delete_gesture_id` and `deleted_at` are
not patchable either — each has exactly one writer, named where it is defined.

- **The write is field-level** (AC-2): the request body carries exactly the
  fields the user changed. A whole-object write that happens to look correct
  fails the AC — the falsifiable form is the request body, and a value changed
  by an assistant turn between load and save must survive.
- `updated_at` advances on every accepted change.
- **Every `200` carries `prior`** (ADR-015):

```yaml
task:    Task
changed: [Task]
prior:   { <field>: <previous value> }   # ONLY the fields this write actually
                                         # changed; {} when the write was a no-op
```

  `prior` is the **single** source for the reorder undo's prior position
  (AC-15's *"carried by the move's own response"* and *"a value the client
  already holds"* are one source, not two). No new record is owed. A drop where
  the step already was returns `200` with `prior: {}` and writes nothing —
  which is the observable AC-43's *no undo entry* and AC-16's *announces
  nothing* are asserted against.
- **Writing or clearing `reminder_at` clears `reminder_shown_at`** (AC-10),
  server-side, in the same write. A reminder moved to a new moment is a new
  reminder and surfaces again.
- **Clearing `due_at` while a repeat is set is refused** — `400 VALIDATION`,
  `field: "due_at"`, message naming the action that ends the repeat (AC-22).
- **Setting or changing a repeat aligns the due forward** (AC-23), creating one
  first if absent (AC-22, today, all-day) — **create, then align**, one order.
  The response's `task` carries the resulting `due_at` and `due_all_day`; the
  surface must have disclosed them first via § `POST /tasks/{id}/repeat-preview`.
- **`recurrence.until` and `recurrence.count` are mutually exclusive**, and an
  `until` earlier than the due date is **reported, not corrected** — both
  `400 VALIDATION` (AC-25).
- `PATCH` still **404s on a deleted row**, and `deleted_at` is still not
  patchable. That is why restore is a route (ADR-012).

## `DELETE /tasks/{id}`

```yaml
# query parameter
scope: "occurrence" | "series"    # optional, default "occurrence" (AC-30)
```

- `occurrence` — soft-deletes this row **and its steps** (AC-19).
- `series` — soft-deletes **every unfinished occurrence of the row's series and
  their steps**, and **leaves every completed occurrence** (AC-30). It also
  writes `series_ended_at` on every row of the series, including the surviving
  completed ones, which is what makes `series_live` false for them (AC-25's
  fourth ending, AC-39's third negative case). Setting an end marker is not
  trashing the row.
- `scope: "series"` on a row with no `series_id` → `400 VALIDATION`.
- **Every delete mints one `delete_gesture_id` and writes it on every row it
  trashes** (ADR-012). Response `200 {task, changed}`.

## `POST /tasks/{id}/restore` — new (AC-41)

**Request:** empty body.

**Response 200:** `{task, changed}` — every row restored.

- Clears `deleted_at` on the addressed row and on **every other row carrying
  the same `delete_gesture_id`**. Ids, `step_order`, `series_id` and
  `created_at` are kept; only `deleted_at` clears and `updated_at` advances
  (AC-41). Restoring is not creating.
- **A row whose `delete_gesture_id` is `null` restores alone** (ADR-012). This
  is the 53-row case, measured: 53 of 790 rows are already soft-deleted with no
  membership record, across 18 accounts, all predating the field. Neither
  `parent_id` nor matching `deleted_at` is used as a key — AC-41 rejects both
  by name, and a singleton restore is the only answer that is true rather than
  plausible. **No migration is run**; ADR-009's precedent holds.
- **Restoring a step whose parent is still deleted restores the parent too**
  (AC-41) — evaluated *after* the membership set is assembled, as an invariant
  rather than as a key, and applying to legacy rows as well. A step with no
  parent is in no collection and therefore unreachable.
- **Restoring a row that is not deleted is a stated no-op** — `200` with
  `restored: false`, never `404` and never `409` (AC-41). A double-tap is
  ordinary on an undo that is one action away wherever the user is.
- **Scoped to the caller's rows.** Another account's id behaves as `404`, per
  the standing convention — stated because a brand-new write path is exactly
  where that gets missed and no AC would otherwise turn red.

| Status | code | Reason |
|---|---|---|
| 401 | UNAUTHENTICATED | missing `X-User-Id` |
| 404 | NOT_FOUND | unknown id, or an id owned by another account |

## `POST /tasks/{id}/reminder-ack` — new (AC-38)

The **server** writes `reminder_shown_at`, on an acknowledgement the client
sends — not on render, and not by the client. This is the AC's only
server-persistence observable and the whole reason it carries `(api)`.

**Request:**

```yaml
reminder_at: iso8601        # required — the instant being acknowledged
```

**Response 200:** `{task, changed, acknowledged: boolean}`.

- Sets `reminder_shown_at = now` **iff** the row's current `reminder_at` equals
  the body's. If it does not, `409 REMINDER_MOVED` and nothing is written — the
  reminder was changed underneath and acknowledging the old instant must not
  retire the new one.
- **`reminder_shown_at` is writable through this door and no other.** It is not
  in `TASK_PATCH_FIELDS` and it is not in `TASK_CREATE_FIELDS`.
- **A turn may not set it.** AC-36 permits the assistant `note`, `priority`,
  `due_at` and `reminder_at` — and nothing else; `reminder_shown_at` is not on
  that list, so a turn attempting it is refused under AC-40 like any other
  unpermitted field. This is the recorded question answered in the direction it
  has to be: a turn that could set it would silently retire a reminder the user
  never saw.
- **Caller scoping is explicit**: only the caller's own rows; another account's
  id behaves as `404`. (AC-41's restore got this clause; this door is the other
  brand-new write path and gets the same care.)
- **Offline, nothing is recorded** (AC-38): the client sends no ack while
  offline, nothing is queued, and the reminder is surfaced again at the next
  open. There is no replay on reconnection — that is the queue-and-replay the
  owner declined at OQ6, arriving through a side door.
- Acknowledging a reminder on a done or deleted row is a no-op returning
  `acknowledged: false`.

## `POST /tasks/{id}/repeat-preview` — new (AC-22, AC-23, AC-25)

AC-22 and AC-23 require the created-or-moved date to be **shown before the
repeat is committed**, and the picker is the one control with preview-then-
commit (AC-2). A client-side preview would be a second implementation of the
alignment, the month-day clamp and the exclusivity rules — L-004's shape on
arithmetic the spec spends four ACs on. So the preview is a **dry run of the
same server code**, and the disclosed date is by construction the date that
will be written.

**Request:** the proposed repeat, in exactly the `PATCH` shape (the six ADR-011
members, plus `due_at` / `due_all_day` if the user is changing them too).

**Response 200:**

```yaml
due_at:      iso8601 | null    # the resulting due, after create-then-align
due_all_day: boolean
created:     boolean           # AC-22 created a due where there was none
moved:       boolean           # AC-23 moved the due forward onto the rule
refusals:    [{ code, field, message }]   # what a commit would refuse; [] if it would succeed
```

- **Zero AI calls** (AC-20, AC-32) — it never touches the Interpreter.
- It writes nothing. `refusals` carries what the commit would refuse
  (`UNTIL_AND_COUNT`, `UNTIL_BEFORE_DUE`, `TIMEZONE_UNKNOWN`, …) so the surface
  can state the outcome without attempting it.
- The **collection** the resulting date lands in is *not* returned. The client
  derives it from `due_at`, because the server has no opinion about collections
  (ADR-009) and adding one here would make it a second definition of a number
  four artifacts already agree on.

## The account and the zone (ADR-010)

### `GET /account`

```yaml
user_id:                 uuid
timezone:                string | null    # IANA; the ONE source every date computation reads
timezone_source:         "first-report" | "user" | null
timezone_set_at:         iso8601 | null
timezone_last_report:    string | null    # the most recent client report, applied or not
timezone_last_report_at: iso8601 | null
```

The account row is created lazily on the first authenticated request. Clients
read this at boot and on foreground and **cache `timezone` durably**, because
it is the zone every client-side date computation uses — never
`Intl.DateTimeFormat().resolvedOptions().timeZone`, which is what
`ControllerDeps.timezone` resolves to today and is the *one row, three answers*
source AC-44 was rewritten against. `ControllerDeps.timezone` keeps its meaning
as **what this client reports**; what it **computes with** is this value.

`timezone_last_report` exists so a client can *offer* a change when the user has
travelled, rather than take one — see the ADR's stated cost.

### `PATCH /account`

```yaml
timezone: string     # IANA
```

Sets the zone explicitly (`timezone_source: "user"`). **This is the only way to
change an already-set zone**; a differing client report never overwrites one,
because a same-request upsert makes each device resolve rows in its own zone —
the three-answers defect returning through the writer. `400 VALIDATION` on an
unknown IANA zone.

### When the zone is absent

- **Writes that need a date computation refuse** — `409 TIMEZONE_UNKNOWN`,
  `detail: {header: "X-Timezone"}`. Because `recordClientZone` runs in the auth
  step before routing, this is reachable **only for a client that has never sent
  the header on any request**: it is a client contract violation addressed to
  the client, not a state a user can be in and cannot act on.
- **Reads never refuse** — see `due_all_day: null` above.
- **The by-hand user is safe** (AC-32): the zone is established by an ordinary
  request such as `GET /tasks`, so a user who never sends a turn, and an
  assistant that is erroring, change nothing about whether dates compute.

## The turn path

### The refused turn (AC-36, AC-40)

`TurnOutcome` gains a seventh member. **The turn's `status` stays `applied`**
and the existing status machine is untouched:

```yaml
kind: "refused"
reason: "empty_title" | "priority_not_in_set" | "note_not_text"
      | "structural_field_not_settable" | "step_not_addressable"
      | "nesting_too_deep" | "repeat_on_step" | "until_and_count"
      | "end_before_due" | "clear_due_while_repeating" | "timezone_unknown"
      | "length_exceeded"
field:   string | null      # the field the rule is about
task_id: uuid | null        # the task the turn was about; unchanged
```

- **The task is unchanged and the refusal is whole-write** (AC-18): a turn
  carrying one legal and one illegal field writes **nothing at all**. The task
  does **not** enter `changed_task_ids`, no diff row is emitted, and no message
  can name a task and then fail to say what happened to it.
- `changed_task_ids` is empty and no `undo_snapshot` is captured, so — by the
  existing mechanical window rule — **a refused turn never occupies or advances
  the undo window**, exactly like `no_match` and `unsupported_query`. This is
  why no new turn status is needed.
- The three improvisations are all worse and are excluded by name: `no_match`
  is a lie (the task *was* matched), the `500` failure envelope reports a server
  fault for a healthy turn, and *write nothing and say nothing* passes AC-40's
  own fixture row.
- **The wording is F-002's.** `F-002 ## What speaks, and from what` is declared
  exhaustive and closed and has no refusal frame; this contract owes the
  **shape** and F-002 owes the row. Routed to the orchestrator by
  `F-005 ## Impact §3`.

### The write allowlist, and `DIFF_FIELDS` splitting in two

**`DIFF_FIELDS` becomes two constants** (AC-36) — one constant cannot be both,
and narrowing it silently would make a repeating task's deletion emit a diff
with no recurrence in it:

```
TURN_WRITE_FIELDS = [title, note, due_at, reminder_at, priority, status, list_id]
  # what a turn may set. `note`, `priority`, `due_at`, `reminder_at` are AC-36's
  # four value fields; `title` and `status` are F-001's; `list_id` is F-008's
  # (AC-18, AC-19 — the assistant's filing verb). It excludes
  # parent_id, step_order, sort_order, every repeat_* member, due_all_day,
  # reminder_shown_at, series_id, deleted_at.

DIFF_FIELDS = [title, note, due_at, due_all_day, reminder_at, priority, status,
               parent_id, step_order, list_id,
               repeat_frequency, repeat_interval, repeat_weekdays,
               repeat_month_days, repeat_until, repeat_count]
  # what a create or a delete must describe COMPLETELY (F-001 AC-2, AC-4).
  # applyCreate/applyDelete enumerate every non-null member; a recurrence change
  # is reported as PER-MEMBER rows (ADR-011), so the declared
  # {task_id, field, old|null, new|null} shape does not change.
```

**The AI-facing change shape must be able to carry the structural fields**
(AC-36): a refusal that cannot be attempted is untestable, so `TaskChanges`
widens to carry `parent_id`, `step_order` and the repeat members **and the
write path refuses them at runtime**. This is a deliberate choice of a runtime
refusal over a type-level impossibility.

**`NewTaskFields`** (the turn-path create allowlist) widens to
`TURN_WRITE_FIELDS` minus `status`-only semantics — a created task may carry
`title`, `note`, `due_at`, `reminder_at`, `priority`, `status`. `applyCreate`
must stop hard-coding `reminder_at: null`: *"add a task to call the dentist and
remind me at nine"* is the most natural sentence for the field the owner's
decision exists to make reachable.

**`ContextTask`** (what the interpreter can read) gains `note`,
`reminder_at`, and **`list_id`** (F-008). The assistant must be able to read
what it may write — *"push the reminder an hour later"* has nothing to read
today, and *"move this to Work"* needs to see where the task currently is.

**The handle list excludes steps.** `turns.ts`'s context builder filters
`parent_id == null` (AC-35, AC-36): a task with eight steps contributes **one**
handle, not nine. A step is therefore never named in a message, which is also
what stops F-001 AC-31's door leading to a row no list holds.

### Field rules bind the write, not the door (AC-40)

`taskChangesFrom` holds *title must be non-empty*, the null/empty rules and the
priority set, and it is called **only from the HTTP handlers** — `applyEdit`
assigns straight onto the row. That is L-005's shape on the door AC-36
deliberately widens.

**The rule set is extracted into one validator that both doors call.** Same
rule, same rejected value, **outcome stated per path**: the HTTP path answers
`400 VALIDATION` with a field name to a client that sent a bad body; the turn
path answers with the `refused` outcome above to a person who spoke a
well-formed sentence. A grep for the validator's name must return both doors.

### Validation bounds

Stated here because AC-6 and AC-37 require that any maximum is **refused with
the value left in the field, never silently truncated**, and that the number is
recorded. Refusals are `400 VALIDATION` on the HTTP path and
`reason: "length_exceeded"` on the turn path.

| Field | Bound | Why this number |
|---|---|---|
| `title` | 500 characters after trim | a title is a line; well above any real one |
| `note` | 20 000 characters | UC-44's *"very long"* case with room; the field is assistant-settable (AC-36), so unbounded is not an option |
| steps per parent | 200 | AC-14's *"any bound is stated and refused"* |
| `repeat_interval` | 1–999 | an interval above this is a date arithmetic hazard, not a cadence |
| `repeat_month_days` | 1–31 per member, ≤ 31 members | AC-21; **candidates are de-duplicated after clamping** (AC-24) — `{30,31}` in April both resolve to the 30th |

## New and changed error codes

| Status | code | Reason |
|---|---|---|
| 400 | VALIDATION | as today, plus: unknown/illegal field value, `parent_id` not a live non-step row of the caller's, a step given a repeat or a parent, `until` **and** `count`, `until` before the due date, clearing `due_at` while a repeat is set, a bound exceeded, `scope: "series"` on a row with no series |
| 409 | TIMEZONE_UNKNOWN | a date computation was required and `account.timezone` is unset; `detail: {header: "X-Timezone"}` |
| 409 | REMINDER_MOVED | `reminder-ack`'s `reminder_at` does not match the row's current value; nothing written |

## Harness doors

Both are **test-only** and neither is served by the production app.

### Server side — the seed path (AC-8, AC-15, AC-34)

Three ACs have no reachable fixture without one, and a `## Test strategy`
sentence with no mechanism and no owner discharges nothing. The existing
`__qa__` namespace (`tests/harness/qa-test-server.ts`, which
already serves `GET /__qa__/ai-calls` and `POST /__qa__/advance-clock`) is the
home; it wraps `createApp` and writes through the `Store` port.

```yaml
POST /__qa__/seed
  tasks:  [ <raw task row> ]      # written verbatim, BYPASSING every write rule.
                                  # This is the only producer of:
                                  #  - an out-of-set stored `priority` (AC-8's
                                  #    tolerant read, whose own write path
                                  #    refuses exactly the value it must tolerate)
                                  #  - a non-canonical repeat_weekdays (ADR-011)
                                  #  - a soft-deleted row with delete_gesture_id: null
  turns:  [ <raw turn row> ]      # incl. an undo_snapshot / post_apply record in the
                                  # PRE-F-005 shape (AC-34) — a test that captures its
                                  # own snapshot cannot fail that AC
  accounts: [ <raw account row> ] # incl. one with timezone: null

POST /__qa__/set-clock  { at: iso8601, zone: iana }   # replaces advance-clock's
                                                      # ms-only interface; advance-clock stays
POST /__qa__/reopen-store                             # AC-15's "survives a restart":
                                                      # close and re-open the durable snapshot
                                                      # in-process. The harness composes a fresh
                                                      # MemoryStore per process today, so a
                                                      # restart has nothing to survive.
```

### Client side — the clock-and-zone seam (AC-44, recorded question R3)

AC-44 requires that *"the test harness can set every seam and hold them at one
instant and one zone for the length of a run"*. The object it names,
`ControllerDeps.now`, is an **in-process constructor parameter**:
`web/main.tsx` constructs the controller with `{api, speech, stores}` and passes
no `now`, and `window.__assistantSeams` exposes four methods and **no clock**.
So the requirement is satisfied today only by the unit harness, while the web
e2e tier AC-44 names as broken has no door at all — the AC's own failure mode
surviving its own remedy.

**The door is `window.__assistantSeams`**, this project's existing named,
already-guarded client seam (`?testMode=1` / `?qaUser=` / `localStorage
assistant.testMode`). It gains one method:

```ts
setClock(opts: { at: string; zone: string }): Promise<void>
// sets the controller's `now` and its computation zone for the rest of the run,
// then re-renders. Held — it does not advance on its own.
```

Paired with `POST /__qa__/set-clock`, an e2e run holds **both** sides at one
instant and one zone, which is the half that does not exist today. A second
client seam is not introduced: `ControllerDeps.now` is the existing injection
point and this method drives it.

## Where each recorded question is answered

`F-005 ## API Touch Points` recorded twelve findings across eight bullets,
deliberately unanswered. Index:

| Recorded question | Answered in |
|---|---|
| The zone's write path — where it lives, which door writes it, what refreshes it (T34, dev-backend F1) | **ADR-010**; § The account and the zone |
| The read-side outcome — the refusal is write-shaped, AC-13's use is a read (T36, dev-backend F2) | **ADR-010**; § `Task` on the wire → `due_all_day: null` |
| The offline mobile create's zone (tester-mobile M14) | **ADR-010**; § `POST /tasks` → a create supplying `due_all_day` keeps it |
| A refusal the user cannot act on (product P17) | **ADR-010**; § When the zone is absent — it is addressed to the client |
| The client-side clock-and-zone harness door (tester-web R3) | § Harness doors → the client seam |
| Rows predating `delete_membership` — 53 of 790 (dev-backend F4) | **ADR-012**; § `POST /tasks/{id}/restore` |
| Where a reordered step's prior position comes from (architect F5) | **ADR-015**; § `PATCH /tasks/{id}` → `prior` |
| How a set-valued recurrence member appears in a diff row (architect F3) | **ADR-011**; § The turn path → `DIFF_FIELDS` |
| How the run count is derived (T35) | **ADR-014**; § `Task` on the wire → `series_live` |
| Who may write `reminder_shown_at` — caller scoping, may a turn set it (T37) | § `POST /tasks/{id}/reminder-ack` |
| AC-46's capture-before-apply ordering and the record-to-row mapping | **ADR-013**; `POST /assistant/turn` rule 6 and the undo endpoint's revert shapes, both amended in place above |

---

# Feature F-006 — recently deleted (the trash)

**Added**: 2026-08-23 by architect-agent (T-191). Spec:
`F-006-recently-deleted.md`. Nine architecture-owed shapes from Gate 1's
revision 5 log, each recorded in the spec's own words in `## API Touch Points`
or `## Impact` §10.

## `GET /tasks/deleted` — new (AC-5, AC-12, AC-14)

**Feature**: F-006 recently-deleted
**Added**: 2026-08-23 by architect-agent
**Auth required**: yes (`X-User-Id`)

The account's deleted rows, grouped into entries by `delete_gesture_id`,
server-side. **Two callers, one shape, one code path, one difference**: the
surface (the HTTP call) and the turn path (processing rule 5's inline read).
The expiry predicate runs for both — an expired row is never listed and never
spoken. **The removal write runs on the surface's call only** — a question
purges nothing (AC-5, AC-12, ADR-017).

### Response 200

```yaml
entries:                           # ordered by deleted_at desc, then addressing_id asc
  - deleted_at:    iso8601         # shared deleted_at of the gesture
    expires_at:    iso8601         # server-produced: deleted_at + 30 days
    tasks:                         # the member tasks of this entry
      - id:        uuid
        title:     string
        status:    string          # the task's status at time of deletion
        parent_id: uuid | null
    parent:                        # PRESENT iff any member has parent_id != null
      id:          uuid            #   the parent row's id
      title:       string          #   the parent's title — server-produced (AC-7)
      state:       "live" | "deleted" | "gone"
                                   # live   = parent is in state.tasks
                                   # deleted = parent is in the trash
                                   # gone   = parent's row has left the store (AC-7)
```

**Entry identity.** Each entry corresponds to one `delete_gesture_id` (or one
singleton row where that field is `null`). The client addresses an entry by
passing **any** member task id to `POST /tasks/{id}/restore` or
`DELETE /tasks/deleted/{id}` — the server resolves the membership. No gesture
id appears on the wire; `delete_gesture_id` remains internal (AC-6,
`§ Task on the wire`, ADR-012).

**Expired-row removal (AC-12).** When this endpoint is called via HTTP (the
surface's caller), rows whose `deleted_at + 30 days` is past are **excluded
from the response and hard-removed from the store** in the same transaction.
This is the only purge mechanism; there is no scheduler. An account nobody
opens the trash on keeps its rows on disk past 30 days — accepted, not
overlooked (AC-12).

**`parent` resolution for steps (AC-7).** A lone deleted step's entry carries
its parent's title and state. Without these, the three parent states (live,
deleted, gone) are indistinguishable on the client, because the client has only
`parent_id` on the wire. The parent's state:
- `"live"` — the parent is not deleted (`deleted_at === null`).
- `"deleted"` — the parent is soft-deleted (another trash entry holds it).
- `"gone"` — the parent's row does not exist in the store (hard-removed).

**Turn-path read (AC-14, processing rule 5).** The turn path reads the same
data inline during interpretation, not via an HTTP call. It receives only
**top-level deleted tasks** (steps excluded — the handle list excludes steps,
and the trash read mirrors it for AC-14's boundary). See § Processing rule 5
amendment below.

### Errors

| Status | Code | Reason |
|--------|------|--------|
| 401 | UNAUTHENTICATED | missing `X-User-Id` |

### Notes

No pagination. The largest trash on the live store today is 9 entries. The
endpoint returns all entries in one call.

---

## `POST /tasks/{id}/restore` — F-006 amendments (AC-9)

**Gains two new outcomes.** The three today (`200 restored`, `200 restored:false`,
`404`) become five. AC-9 requires refused-because-expired and
refused-because-parent-gone, and neither may collapse into an existing outcome:
`404` is indistinguishable from an unknown id, and `restored: false` asserts
the row is live, which is false in both refusal cases. **The five must be
distinguishable at the door**, because AC-16's 4.1.3 requires both refusals
announced, and a client cannot announce a refusal it cannot tell apart from a
double-tap.

| # | Outcome | Status | Body | How the client tells |
|---|---------|--------|------|---------------------|
| (a) | Restored | 200 | `{ task, changed, restored: true }` | `restored === true` |
| (b) | Already live | 200 | `{ task, changed: [], restored: false }` | `restored === false` |
| (c) | Refused — expired | 409 | `{ error: { code: "RESTORE_EXPIRED" } }` | status 409, code |
| (d) | Refused — parent gone | 409 | `{ error: { code: "RESTORE_PARENT_GONE" } }` | status 409, code |
| (e) | Unknown / other account | 404 | `{ error: { code: "NOT_FOUND" } }` | status 404 |

**(c) fires when:** the row's `deleted_at + 30 days` is past, **or** the
restore must bring back a parent (the invariant from ADR-012) and that
parent's own `deleted_at + 30 days` is past. AC-12's reachability limit applies
without exception.

```yaml
# 409 RESTORE_EXPIRED
error:
  code:    "RESTORE_EXPIRED"
  message: "this entry has expired and can no longer be restored"
  detail:
    task_id:    uuid          # the addressed row
    expired_at: iso8601       # the expiry instant
```

**(d) fires when:** the addressed row is a step (`parent_id != null`) whose
parent's row has been hard-removed from the store. The step cannot return
without its parent.

```yaml
# 409 RESTORE_PARENT_GONE
error:
  code:    "RESTORE_PARENT_GONE"
  message: "this step's parent has been permanently deleted"
  detail:
    task_id:   uuid           # the addressed step
    parent_id: uuid           # the gone parent's id
```

**Order of evaluation:** (e) ownership check → (c) expiry check on the
addressed row → membership assembly → parent invariant → (c) expiry check on
the required parent → (d) parent-gone check → (a)/(b) restore. A client
calling restore on a stale entry gets (c) before it can trigger (d).

**Series restore and `series_ended_at` (T-181, ADR-012 amendment).** When a
restore brings back rows that carry a `series_id`, the restore also clears
`series_ended_at` on every row of that series whose `series_ended_at` matches
the `deleted_at` of the gesture being restored. This ensures `F-005 AC-43`'s
*"it reverses exactly the action it was offered for and nothing else"* is true
for the series class. See ADR-012 § Amendment.

---

## `DELETE /tasks/deleted/{id}` — new (AC-11)

**Feature**: F-006 recently-deleted
**Added**: 2026-08-23 by architect-agent
**Auth required**: yes (`X-User-Id`)

Permanently destroys one trash entry. `{id}` is any member task id of the entry
(AC-6's addressing rule). Hard-removes the entry's membership set (AC-6),
**restricted to rows still deleted at the moment of the act** — a member
restored in between is live and never hard-removed.

### Request

Empty body.

### Response 200

```yaml
removed: [uuid]          # the ids of the hard-removed rows
```

**No `task` field.** The multi-row response rule's envelope is
`{ task, changed, removed }` where `task` is *"the row the request addressed"*.
AC-11 destroys the addressed row, so there is nothing for `task` to carry.
This endpoint returns `{ removed }` only — the `removed` channel from the
multi-row response rule without the rest of the envelope (see § The multi-row
response rule, F-006 note).

### Errors

| Status | Code | Reason |
|--------|------|--------|
| 401 | UNAUTHENTICATED | missing `X-User-Id` |
| 404 | NOT_FOUND | unknown id, or id owned by another account, or the row is not deleted |

### Notes

Not optimistic; offline refused, never queued (AC-11). The confirmation is
client-side (AC-11's naming requirement is the client's to enforce before
calling).

---

## `DELETE /tasks/deleted` — new (AC-17)

**Feature**: F-006 recently-deleted
**Added**: 2026-08-23 by architect-agent
**Auth required**: yes (`X-User-Id`)

Empties the entire trash. Hard-removes **every deleted row of the account**,
expired or not. Addresses no entry — it is keyed on `deleted_at`, not on a
gesture id (AC-17).

### Request

```yaml
task_ids: [uuid]          # the set pinned to the confirmation (AC-17)
                          # the act destroys ONLY the rows in this set
                          # that are still deleted at the moment of the act.
                          # A row restored in between is live and excluded.
                          # A row deleted AFTER the confirmation was shown
                          # is not in this set and is excluded.
```

### Response 200

```yaml
removed: [uuid]          # the ids of the hard-removed rows
```

**No `task` field** — same reasoning as `DELETE /tasks/deleted/{id}`.

### Errors

| Status | Code | Reason |
|--------|------|--------|
| 401 | UNAUTHENTICATED | missing `X-User-Id` |

### Notes

Not optimistic; offline refused, never queued (AC-17). If `task_ids` is empty,
nothing is removed and `removed` is `[]`.

---

## `POST /assistant/turn` — F-006 amendments

### Processing rule 5 amendment — reading and addressing are separated (AC-4, AC-14)

Rule 5 reads *"the interpretation context (the user's current tasks)"* — one
set doing both jobs. AC-14 grants the assistant a read of the trash while AC-4
keeps deleted rows out of the handle list. Those two requirements cannot both be
true of one set, so the context gains a second, read-only set.

The interpretation context is now:

```yaml
tasks:         ContextTask[]             # the user's live tasks (UNCHANGED)
                                         # the handle list — a turn may target
                                         # only rows in this set

deleted_tasks: DeletedContextTask[]      # top-level deleted tasks, unexpired (NEW)
                                         # read-only: the interpreter may
                                         # recognise a task as "in the trash"
                                         # and produce a trash_read outcome,
                                         # but may NEVER target a row in this
                                         # set for any mutation. Steps excluded
                                         # (mirroring the handle list).
```

```yaml
DeletedContextTask:
  id:         uuid
  title:      string
  deleted_at: iso8601
```

The expiry predicate is evaluated before building this set — an expired row
never appears in `deleted_tasks`.

### `turn.outcome` gains an eighth member: `trash_read` (AC-14)

A turn that reads the trash and produces an informational answer. The turn's
`status` is `applied` (same as every answered query). No mutation.

```yaml
kind: "trash_read"
query: "task_in_trash" | "trash_contents"

# query = "task_in_trash":
#   the user asked about a specific task that is in the trash
task_id:       uuid              # the deleted task's id
task_title:    string            # the deleted task's title

# query = "trash_contents":
#   the user asked what is in the trash
entry_count:   integer           # number of entries
entry_titles:  string[]          # up to 3 task titles, then overflow
                                 # follows title_list's published rule
```

**Frame selection.** The two queries map to the two frames owed to
`components.md § Spoken frames`:
- `"task_in_trash"` → frame taking `title` (the task-is-in-the-trash answer)
- `"trash_contents"` → frame taking `count` and `title_list`

Both fit the existing closed five-slot vocabulary. No sixth slot type is added.

**`trash_read` does NOT change anything in the existing `turn.outcome.kind`
set.** The seven existing members — `applied`, `question`, `resolution`,
`unclassifiable`, `no_match`, `unsupported_query`, `refused` — retain their
shapes and semantics. F-008's `refused` outcome (AC-20) is unaffected.

**The `no_match` exclusion (AC-14).** A turn asking for an act on a row the
assistant has just named as being in the trash **never** produces `no_match`.
The interpreter recognises the task in `deleted_tasks`, sees it is not
actionable, and returns `trash_read` with `query: "task_in_trash"` — the reply
names the trash and the way to reach it.

### `changed_task_ids` for `trash_read`

Empty. No mutation, no diff, no snapshot. A `trash_read` turn never occupies
or advances the undo window (same mechanical rule as `no_match` and
`unsupported_query`).

---

## `POST /assistant/turn/{turn_id}/undo` — F-006 amendments (AC-13)

### `skipped` gains a second reason

```yaml
skipped:
  - task_id: uuid
    title:   string
    reason:  "modified_since_apply" | "permanently_deleted"
```

`"permanently_deleted"`: the row was hard-removed from the store (by AC-11,
AC-17, or AC-12's retention purge) after the turn applied. The undo cannot
replay what no longer exists, and reporting the row as *"modified since apply"*
would be a false statement about a row that is gone.

**Step reporting.** `skipped` names top-level tasks only (unchanged). A purged
step whose parent is also purged is reported through the parent: the parent
appears in `skipped` with reason `permanently_deleted`, and the message states
that its steps were not fully reversed (the existing step-through-parent
reporting convention). A purged step whose parent is **live** is reported by
adding the parent to `skipped` with reason `permanently_deleted` — the parent
itself was not modified, but the undo cannot restore its step, and the parent
is the only permissible container for that information given the top-level-only
rule.

---

## `§ The multi-row response rule` — F-006 note

The `removed: [uuid]` channel gains two new producers:
- `DELETE /tasks/deleted/{id}` (AC-11) — one entry's membership
- `DELETE /tasks/deleted` (AC-17) — every deleted row of the account

Both return `{ removed: [uuid] }` **without the `task` and `changed` fields**.
The existing envelope `{ task, changed, removed }` requires `task` to be *"the
row the request addressed"*, and AC-11 destroys the addressed row while AC-17
addresses none. Rather than make `task` nullable across every existing
consumer, the two permanent-deletion endpoints return only the `removed`
channel.

**The existing comment** *"Today exactly one producer: AC-28's successor
removal on un-complete"* is now three producers. The comment is updated.

---

## Harness doors — F-006 additions (AC-12, AC-17)

### `GET /__qa__/raw-tasks` — the raw-store read

The read half of the harness. `POST /__qa__/seed` writes raw rows bypassing
every write rule; this endpoint **reads raw rows bypassing every filter**,
including the deletion filter and the expiry predicate. Its purpose is
specific: after a trash read, the assertion that expired rows were removed is
**the account's stored row count** (AC-12), and after an empty-trash without
an intervening trash read, the assertion that expired rows were also removed is
the same count (AC-17).

```yaml
GET /__qa__/raw-tasks?user_id={uuid}

Response 200:
  tasks:  [RawTaskRow]     # every row for this account, deleted or not,
                           # expired or not, hard-removed excluded
                           # (they are gone from the store)
  count:  integer          # length of tasks array
```

`RawTaskRow` is the internal row representation, including `deleted_at`,
`delete_gesture_id`, `series_ended_at`, and every other internal field. It is
**not** `serializeTask`'s output — it includes what `serializeTask` excludes.

**Test-only.** Not served by the production app. Served by the QA harness
(`tests/harness/qa-test-server.ts`) alongside `POST /__qa__/seed`,
`POST /__qa__/set-clock` and `POST /__qa__/reopen-store`.

---

## New and changed error codes (F-006)

| Status | Code | Reason |
|--------|------|--------|
| 409 | RESTORE_EXPIRED | the entry is past its 30 days, or a required parent is (AC-9 outcome c) |
| 409 | RESTORE_PARENT_GONE | the step's parent has been permanently deleted (AC-9 outcome d) |

---

# Feature F-008 / F-009 — lists, list actions

**Added**: 2026-08-23 by architect-agent (T-286). Specs:
`F-008-lists.md` (personal lists) and `F-009-list-actions.md` (search, sort,
hide completed, multi-select). Entities and field semantics:
`data-model.md § Features F-008 and F-009`.

F-008 adds five endpoints (list CRUD) and amends two (task PATCH, assistant
turn). F-009 adds one endpoint (bulk operations), amends two (account
GET/PATCH for preferences, task POST/PATCH for sort_order), and specifies the
sort_order migration.

## `PATCH /tasks/{id}` — F-008 / F-009 amendments

**`TASK_PATCH_FIELDS` gains `list_id` and `sort_order`.** The full list is
now: `title`, `note`, `due_at`, `due_all_day`, `reminder_at`, `priority`,
`status`, `step_order`, `list_id`, `sort_order`, and the six ADR-011 repeat
members.

- **`list_id`** (F-008 AC-11, AC-12): `uuid | null`. Setting a uuid files the
  task into that list. Setting `null` returns it to Inbox. Validation:
  - The list must exist and belong to the caller → `404 NOT_FOUND` otherwise.
  - The task must not be a step (`parent_id` non-null) → `400 VALIDATION`,
    `field: "list_id"`, message: *"A step's filing follows its parent"*
    (F-008 AC-13).
  - A deleted list id → `404 NOT_FOUND`.
- **`sort_order`** (F-009 AC-6): `integer`. Written by drag-reorder. Uses
  the same sparse-integer scheme as `list.position`. The response `prior`
  field carries the previous `sort_order` (same pattern as F-005 ADR-015).

## `POST /tasks` — F-009 amendment

**`TASK_CREATE_FIELDS` gains `sort_order`.** A create supplying `sort_order`
keeps it (the offline replay case). A create supplying none is appended last:
the server assigns `max(sort_order in filing cell) + 1024`, or `0` if the cell
is empty.

`list_id` is **not** in `TASK_CREATE_FIELDS`. A created task lands in Inbox.

## `Task` on the wire — F-008 / F-009 additions

`serializeTask` gains two fields:

```yaml
list_id:    uuid | null            # F-008 AC-10; null = Inbox
sort_order: integer                # F-009 AC-5; assigned on every row
```

Both are present on every row in `GET /tasks` responses.

---

## `POST /lists`

**Feature**: F-008 lists
**Added**: 2026-08-23 by architect-agent
**Auth required**: yes (`X-User-Id`)

Creates a personal list.

### Request

```json
{
  "name":  "string — required, 1–100 chars after trim; whitespace-only rejected",
  "color": "integer — optional, 0–6, default 0 (Grey)"
}
```

### Response 201

```json
{
  "list": {
    "id":         "uuid — server-generated",
    "user_id":    "uuid",
    "name":       "string — trimmed",
    "color":      0,
    "position":   1024,
    "task_count": 0,
    "created_at": "iso8601",
    "updated_at": "iso8601"
  }
}
```

`position` is assigned as `max(position of user's lists) + 1024`, or `1024` if
the user has no lists.

`task_count` is a computed field on every list response — the count of non-deleted,
non-step tasks with `list_id = this list's id`. It is not stored; it is computed
at read time.

### Errors

| Status | Code | Reason |
|---|---|---|
| 400 | VALIDATION | name empty/whitespace-only, name > 100 chars, color outside 0–6, unknown fields |
| 401 | UNAUTHENTICATED | missing `X-User-Id` |
| 409 | DUPLICATE_NAME | a list with this name (case-insensitive, trimmed) already exists for this user (F-008 AC-3) |
| 409 | LIST_LIMIT_REACHED | user already has 50 lists (F-008 AC-23) |

---

## `GET /lists`

**Feature**: F-008 lists
**Added**: 2026-08-23 by architect-agent
**Auth required**: yes (`X-User-Id`)

Returns all personal lists for the authenticated user, ordered by `position`.

### Response 200

```json
{
  "lists": [
    {
      "id":         "uuid",
      "user_id":    "uuid",
      "name":       "string",
      "color":      0,
      "position":   1024,
      "task_count": 3,
      "created_at": "iso8601",
      "updated_at": "iso8601"
    }
  ]
}
```

`task_count` is computed: the count of tasks where `list_id = list.id` and
`deleted_at` is null and `parent_id` is null.

### Errors

| Status | Code | Reason |
|---|---|---|
| 401 | UNAUTHENTICATED | missing `X-User-Id` |

---

## `PATCH /lists/{id}`

**Feature**: F-008 lists
**Added**: 2026-08-23 by architect-agent
**Auth required**: yes (`X-User-Id`)

Rename, recolour, or reposition a list. Field-level: the body carries only the
fields being changed.

### Request

```json
{
  "name":     "string — optional, 1–100 chars after trim",
  "color":    "integer — optional, 0–6",
  "position": "integer — optional, sparse"
}
```

### Response 200

```json
{
  "list": { "...full list object..." }
}
```

`updated_at` advances on every accepted change.

### Errors

| Status | Code | Reason |
|---|---|---|
| 400 | VALIDATION | name empty/whitespace-only, name > 100 chars, color outside 0–6, unknown fields |
| 401 | UNAUTHENTICATED | missing `X-User-Id` |
| 404 | NOT_FOUND | unknown list id, or belongs to another user |
| 409 | DUPLICATE_NAME | new name collides (case-insensitive) with another list of the same user (F-008 AC-3, AC-4) |

---

## `DELETE /lists/{id}`

**Feature**: F-008 lists
**Added**: 2026-08-23 by architect-agent
**Auth required**: yes (`X-User-Id`)

Deletes a personal list. Deletion is permanent (no soft delete, no trash —
F-008 AC-9).

### Request

```json
{
  "confirm": "boolean — required when the list has tasks; true = proceed"
}
```

The body may be empty or absent when the list is empty.

### Response 200

```json
{
  "deleted":    true,
  "tasks_moved": 3
}
```

`tasks_moved` is the number of tasks whose `list_id` was set to `null` (moved
to Inbox) by this delete.

### Processing

1. Count tasks in the list: non-deleted, non-step rows with
   `list_id = list.id`.
2. If count > 0 and `confirm` is not `true`:
   return `409 LIST_NOT_EMPTY` with `{task_count, list_name}`.
3. If count > 0 and `confirm` is `true`:
   set `list_id = null` on every task in the list, then delete the list row.
   Both writes in one transaction.
4. If count === 0: delete the list row immediately. `confirm` is ignored.

**The count is computed at delete time, not cached.** A client shows the
confirmation dialog using its own local task data (it already holds all tasks
and can count `tasks.filter(t => t.list_id === listId)`). The server recomputes
at execution, so the actual move covers whatever is in the list at that moment.
A discrepancy between the client's displayed count and the server's actual
count is acceptable: the operation is "move all tasks to Inbox", not "move
exactly N tasks".

### Errors

| Status | Code | Reason |
|---|---|---|
| 401 | UNAUTHENTICATED | missing `X-User-Id` |
| 404 | NOT_FOUND | unknown list id, or belongs to another user |
| 409 | LIST_NOT_EMPTY | list has tasks and `confirm` is missing or false; body: `{task_count: N, list_name: "string"}` |

### Notes

A deleted list is **not** sent to F-006's trash. The list entity has no
soft-delete lifecycle; deletion is permanent and immediate (F-008 AC-9). The
tasks it held survive in Inbox.

---

## `PATCH /tasks/bulk`

**Feature**: F-009 list-actions
**Added**: 2026-08-23 by architect-agent
**Auth required**: yes (`X-User-Id`)

Bulk operations from multi-select mode. **All-or-nothing**: the entire batch
succeeds or the entire batch is refused. No partial results.

### Request

```json
{
  "action":   "complete | delete | move",
  "task_ids": ["uuid — 1 to 200, non-empty"],
  "list_id":  "uuid | null — required for action 'move'; null = Inbox",
  "confirm":  "boolean — required for action 'delete' when task_ids.length > 1"
}
```

### Response 200

```json
{
  "tasks":   ["Task — every addressed task in its new state"],
  "changed": ["Task — other rows changed as a side effect (e.g. steps cascaded by complete)"],
  "removed": ["uuid — rows hard-removed, if any"]
}
```

### Processing by action

**`complete`** (F-009 AC-11):

- Sets `status: 'done'` on every task. Applied uniformly regardless of current
  status — an already-done task receives the same write.
- F-005 AC-19 cascade applies: completing a parent ticks its undone steps.
  Cascaded steps appear in `changed`.
- F-005 AC-26 successor generation applies: completing a repeating task spawns
  a successor. The successor appears in `changed`.
- No confirmation required.

**`delete`** (F-009 AC-12):

- Soft-deletes every task (writes `deleted_at`). Tasks enter F-006's trash.
- **All tasks in the batch share one `delete_gesture_id`** (ADR-012), so
  restoring any one of them via `POST /tasks/{id}/restore` restores the entire
  cluster.
- Deleting a parent also soft-deletes its steps. Steps appear in `changed`.
- If `task_ids.length > 1` and `confirm` is not `true`:
  return `409 BULK_UNCONFIRMED` with `{task_count, task_titles}`.
- If `task_ids.length === 1`: proceeds immediately, no confirmation. Matches
  the single-delete behaviour with undo via trash (F-005 AC-42).

**`move`** (F-009 AC-13):

- Sets `list_id` on every task. `list_id: null` moves to Inbox.
- Step constraint applies: if any task_id names a step (`parent_id` non-null),
  the entire batch is refused → `400 VALIDATION` (F-008 AC-13).
- If `list_id` is a uuid, the list must exist and belong to the caller →
  `404 NOT_FOUND` otherwise.
- No confirmation required.

### All-or-nothing semantics

**Why all-or-nothing, not per-item.** The undo model is simpler: a bulk delete
produces one `delete_gesture_id` covering the whole batch, so restore is one
action. Partial results ("3 of 5 deleted") would require the client to track
which succeeded and offer partial undo, which no surface draws and no spec
describes. The failure modes are narrow — a task_id that is not found, not
owned, or is a step — and the client holds fresh data, so a validation failure
is a programming bug, not a user-facing race.

**Idempotency.** Each action is naturally idempotent: completing an
already-done task is a no-op in effect; deleting an already-deleted task
is a no-op; moving a task to the list it is already in is a no-op. A network
retry that replays the same request produces the same result. No explicit
`client_action_id` is needed.

### Errors

| Status | Code | Reason |
|---|---|---|
| 400 | VALIDATION | unknown action, empty task_ids, task_ids > 200, unknown fields, a task_id is a step (for `move`), `list_id` missing for `move` |
| 401 | UNAUTHENTICATED | missing `X-User-Id` |
| 404 | NOT_FOUND | any task_id unknown or not owned by this user; or `list_id` unknown (for `move`) |
| 409 | BULK_UNCONFIRMED | `delete` with > 1 task and `confirm` missing or false; body: `{task_count: N, task_titles: [string]}` |

---

## `GET /account` — F-009 amendments

Two fields added to the response:

```yaml
hide_completed:   boolean          # default false; F-009 AC-7
sort_preferences: Record<string, "due_date" | "priority" | "manual">
                                   # default {}; F-009 AC-4
                                   # key = collection id (static name or list uuid)
                                   # absent key = "due_date"
```

## `PATCH /account` — F-009 amendments

Two fields added to the accepted body:

```yaml
hide_completed:   boolean          # optional
sort_preferences: Record<string, "due_date" | "priority" | "manual">
                                   # optional; MERGES with existing preferences
                                   # (a key in the body overwrites that key;
                                   # keys not in the body are unchanged)
```

**Validation:**

- `sort_preferences` with `'manual'` on a date-axis or gate collection
  (`today`, `upcoming`, `done`) → `400 VALIDATION`, field:
  `"sort_preferences"`, message naming the collection and the constraint.
- Unknown collection ids are accepted — a preference set for a list that is
  later deleted is harmless; the client ignores keys it cannot resolve.

---

## `POST /assistant/turn` — F-008 amendments

### TURN_WRITE_FIELDS gains `list_id`

The full list is now: `title`, `note`, `due_at`, `reminder_at`, `priority`,
`status`, `list_id`.

`list_id` is the assistant's filing verb (F-008 AC-18, AC-19): *"move this to
Work"* writes `list_id` on the resolved task. The step constraint (F-008
AC-13) applies through the turn path too — a turn attempting to set `list_id`
on a step produces a `refused` outcome with
`reason: "structural_field_not_settable"`.

### ContextTask gains `list_id`

The interpreter must see where a task is filed to resolve *"move this to
Work"* (F-008 AC-18) and to avoid a no-op filing (*"it's already in Work"*).

### DIFF_FIELDS gains `list_id`

A voice filing produces a diff row: `{task_id, field: "list_id", old: null,
new: "<list-uuid>"}`. Undo of a voice filing restores the previous `list_id`
(F-008 AC-25).

### Interpreter: two new verb classes

**`list_create`** (F-008 AC-17): the interpreter recognises *"make a list
called Groceries"* and produces an action that creates a list. The list is
created with default colour (index 0). The outcome is `kind: "applied"` with
the created list named in the message. The `list_create` action writes to the
`list` store, not the `task` store — `changed_task_ids` is empty, no
`undo_snapshot` of tasks is captured. Undo removes the created list and
unfiles any tasks that were filed into it (F-008 AC-26), matching `DELETE
/lists/{id}` with `confirm: true` semantics.

**`list_move`** (F-008 AC-18, AC-19): the interpreter recognises *"move this
to Work"* and resolves the list name (case-insensitive exact match). The action
writes `list_id` on the resolved task. Name resolution:

- Exact match (one list) → file the task (AC-11 / AC-12).
- Zero matches → `no_match` outcome naming the list the user said (AC-21).
  No list is created — creating requires an explicit create verb (AC-17).
- Multiple matches → clarify question per F-001 AC-13.

**`list_refuse`** (F-008 AC-20): a turn attempting to rename, recolour, or
delete a list produces a `refused` outcome with
`reason: "list_operation_not_permitted"`. The refusal is expressed, not silent.

### `undo_snapshot` and `turn.diff` for list operations

**Filing a task by voice** is an ordinary applying turn. `undo_snapshot`
captures the task's state before the `list_id` change. `diff` records the
`list_id` field change. Undo restores the previous `list_id` (F-008 AC-25).

**Creating a list by voice** captures the created list's id in `created_ids`
(extended from task-only to include list ids). Undo removes the list and
unfiles its tasks (F-008 AC-26). The `undo_snapshot` contains no task rows
(no task was changed at creation time); the unfile-on-undo is the delete
semantics, not a snapshot replay.

---

## `POST /__qa__/seed` — F-008 / F-009 additions

The seed path gains:

```yaml
lists:       [ <raw list row> ]     # written verbatim, bypassing validation
preferences: [ { user_id, hide_completed?, sort_preferences? } ]
                                    # merged into account rows
```

A test that needs a pre-populated list (for filing scenarios) or a specific
sort preference (for manual-sort scenarios) uses the seed path.

---

## Harness: `POST /__qa__/seed` — `sort_order` on task rows

Task rows in the seed path may carry `sort_order`. When absent, the
initialisation pass assigns it (same as production). When present, it is kept
verbatim — a test that needs a specific sort order for a drag-reorder scenario
can set it explicitly.

---

## New and changed error codes (F-008 / F-009)

| Status | Code | Reason |
|---|---|---|
| 400 | VALIDATION | as before, plus: `list_id` on a step, `sort_order` out of range, `sort_preferences` with `manual` on a date-axis collection, unknown fields on list endpoints, bulk endpoint validation |
| 404 | NOT_FOUND | as before, plus: `list_id` referencing a non-existent or other-user's list |
| 409 | DUPLICATE_NAME | list create or rename collides with an existing name (case-insensitive, same user) |
| 409 | LIST_LIMIT_REACHED | user already has 50 lists |
| 409 | LIST_NOT_EMPTY | deleting a non-empty list without `confirm: true` |
| 409 | BULK_UNCONFIRMED | bulk delete of > 1 task without `confirm: true` |
