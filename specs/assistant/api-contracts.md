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
timezone:          string | null # IANA tz, optional interpretation context
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
   `409 CLIENT_TURN_ID_REUSED`, nothing executes. `session_id` and `timezone`
   are excluded from the comparison — a post-close replay legitimately
   carries a different session (pinned by TC-25).
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
4. **Persist before interpreting.** `transcript_raw` is stored (turn row,
   status `pending`, appended to session history) before the Interpreter is
   called — a failed turn never loses the user's words (AC-23).
5. **Snapshot freshness (OQ 7).** The interpretation context (the user's
   current tasks) is read **fresh inside this turn's serial-queue slot**, in
   the same transaction scope as the apply. No client-supplied task or draft
   state is accepted or trusted, so a turn issued right after a manual edit
   sees the edited state (UC-09 AC-09.2).
6. **Atomic apply.** An applying turn's changes land all-or-nothing;
   `undo_snapshot` is captured immediately **before** apply, inside the apply
   transaction (AC-1, AC-6). A turn that produces a question applies nothing
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
`unsupported_query`. Cancel is client-local: there is **no cancel endpoint**;
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
counter) and read-back observables (AC-6, AC-14) run against these. Task
shape is the existing todo-ai model, unchanged (spec, Out of Scope); the
prototype serves the fields in data-model.md `task`.

| Method + path | Purpose | Success | Errors |
|---|---|---|---|
| `GET /tasks` | list the account's tasks (read-back observable) | 200 `{tasks: [Task]}` | 401 |
| `POST /tasks` | create `{id?, title, due_at?, priority?, status?}` | 201 `{task}` | 400, 401, 409 |
| `PATCH /tasks/{id}` | edit any mutable field | 200 `{task}` | 400, 401, 404 |
| `DELETE /tasks/{id}` | delete (soft: `deleted_at`) | 200 `{task}` | 401, 404 |

None of these touch the Interpreter — the AI-call counter must read zero for
any pure-CRUD scenario (AC-18, AC-25 offline local path).

`id` on `POST /tasks` is optional and **client-generated** (uuid): the
offline local path (AC-25) creates the task locally under a real id and
replays the create on reconnect — no temporary-id mapping exists. A colliding
id → `409 TASK_ID_EXISTS`; a client replaying its own create treats that 409
as already-synced (its ack). Omitted `id` → server generates one.
