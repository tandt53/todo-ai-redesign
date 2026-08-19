# Architecture — todo-ai redesign (voice-first)

**Status:** baseline for F-001 · 2026-08-16 · architect-agent
**Scope:** exactly what F-001 needs. Grows per feature; per-feature sections below.

## System overview

A prototype-grade voice-first todo app. Three runnable parts: an **in-process
Node prototype server** (assistant endpoints + minimal task CRUD), a **React
web client**, and a **React Native mobile client**. Speech-to-text runs on the
client; the server only ever receives recognized text (spec AC-20). The
**server is the source of truth for the conversation** (session + turns); the
**task table is the source of truth for todos** — the on-screen list, not the
chat reply, is where results live. Clients hold only two durable local stores:
`pending_input` and `outgoing_turn` (spec Data). There is no real backend this
phase; the prototype server honours the spec's server-side contract sentences
for real, because QA's API suite executes against it (ADR-001).

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Language | TypeScript (strict) | everywhere, including the server |
| Web | React | four-state view model; durable browser storage for client stores |
| Mobile | React Native | native capabilities behind ports so logic tests run under Node |
| Server | Node ≥ 20, `node:http`, no framework | prototype-grade; ADR-001 |
| Persistence | in-memory store + JSON file snapshot | behind a `Store` port; ADR-001 |
| AI | Anthropic Messages API via `Interpreter` port | default model `claude-opus-5`, config-resolved; stubbed in tests |
| Tests | vitest (node env; jsdom for web components), supertest in-process | executed — see platform docs `## Test Harness` |

## Component map

**assistant-server** (`src/assistant/api/`) — the turn engine. Owns session
lifecycle (open/resume, lazy idle close per ADR-004), a per-account FIFO queue
that processes a session's turns serially in receipt order (AC-10), the
interpretation call through the `Interpreter` port, atomic apply with
`undo_snapshot` capture in the same transaction, per-status dedupe on
`(user_id, client_turn_id)`, the undo path (window check + revert in one
transaction), the voice-undo guard (ADR-006), and question resolution (D2
rules). Also serves minimal task CRUD so the manual no-AI path and read-back
observables run against real endpoints.

**web client** (`src/assistant/web/`) — conversation surface with exactly four
states (idle / listening / thinking / error); everything else renders as
messages from turn records. Web Speech capture behind a `TranscriptSource`
port; client stores in durable browser storage.

**mobile client** (`src/assistant/mobile/`) — same view model and contracts;
platform capabilities (speech recognition, permissions, audio interruption,
kill-surviving storage) behind ports so business logic is unit-testable under
Node without a simulator.

**shared contracts** (`src/_shared/`) — hand-maintained TS types mirroring
`specs/assistant/api-contracts.md` and `data-model.md`, imported by all three.
The markdown contracts stay authoritative (MANIFEST `## Ownership`).

## Key patterns

- **Ports + injection everywhere the spec demands a test seam**: `Interpreter`
  (real model vs fixture stub — answer classification included), `Clock` +
  `idleCloseMs` (injectable idle-close timer), `Store`, `TranscriptSource`
  (scripted transcripts, capability/permission/failure injection), and an
  AI-call counter wrapping `Interpreter` (AC-18/AC-25 zero-call assertions).
- **Serial per-session processing** via a per-account promise queue; the
  interpretation context is read fresh inside the queue slot (OQ 7).
- **Snapshot comparison** is the single modified-since rule (AC-7, AC-12).
- **Messages, not states**: outcomes are derived from persisted turn records;
  clients never invent state the server does not hold.

## Feature: F-001 voice-assistant-view

Endpoints: `POST /assistant/turn`, `GET /assistant/session`,
`POST /assistant/session/close`, `POST /assistant/turn/{turn_id}/undo`, plus
prototype task CRUD (`/tasks…`) — shapes in `specs/assistant/api-contracts.md`.
Entities: `assistant_session`, `assistant_turn` (status machine verbatim from
spec), embedded `question` / `undo_snapshot` / `undo_result`, dedupe index,
client stores — in `specs/assistant/data-model.md`.

Open Questions routed to T-004 — answers and their locations:

| OQ | Decision (short) | Answered in |
|---|---|---|
| 2 | idle close = 180 s, server-owned lazy close, injectable | ADR-004 |
| 3 | new `assistant_session` entity; 30-turn 409 limit does not apply | ADR-003 |
| 4 | one open session per **account**; dedupe unique `(user_id, client_turn_id)`, retention ≥ replay window | ADR-005 |
| 5 | ADR-9 superseded for the assistant server surface (real ids, server-side writes) | ADR-002 |
| 6 | voice undo = client closed-phrase short-circuit + server guard | ADR-006 |
| 7 | turn context read fresh inside the serial slot — hand edits visible to the next turn | api-contracts.md, `POST /assistant/turn` → Snapshot freshness |

(OQ 1 belongs to design-agent + product-agent; not decided here.)

## Non-obvious decisions (ADR index)

- ADR-001 — what "prototype-grade server" concretely is
- ADR-002 — supersedes existing-app ADR-9 for the assistant surface (OQ 5)
- ADR-003 — new session entity; fate of the 30-turn limit (OQ 3)
- ADR-004 — idle-close value and owner (OQ 2)
- ADR-005 — account-scoped session and dedupe (OQ 4) — **amended by ADR-010**
- ADR-006 — voice-undo mechanism (OQ 6)
- ADR-007 — accept the Metro image-size advisory
- ADR-008 — English-first this phase
- ADR-009 — Today is a date; `status: 'today'` retired (+ two amendments)
- ADR-010 — the `account` entity and where the user's timezone lives (F-005)
- ADR-011 — recurrence is six flat scalars; a set is a canonical string (F-005)
- ADR-012 — a delete records its own membership; restore replays that set (F-005)
- ADR-013 — a turn plans the rows it will cause, then captures, then applies (F-005)
- ADR-014 — the run count is derived from a per-occurrence flag (F-005)
- ADR-015 — step order is a sparse integer; a move is one write (F-005)

## Feature: F-005 task-detail

**Components touched, not added.** F-005 adds no runnable part: the turn engine,
the two clients and the shared model all grow. The one genuinely new server
concept is the **account row** (ADR-010) — the row ADR-005 has scoped sessions
and dedupe to since 2026-08-16 without one existing.

**Data flow, in one line each.** A hand edit is a field-level `PATCH` that
returns the row it changed plus **every other row it changed** (`changed`) and
the **pre-write values of the fields it changed** (`prior`); the client applies
all of them, which is what makes a generated successor or a cascaded step appear
without a refresh. A repeat is configured through a **server dry run**
(`repeat-preview`) and then committed, so the alignment, the month-day clamp and
the exclusivity rules have exactly one implementation. A soft delete mints a
**gesture id** written on every row it trashes, and `POST /tasks/{id}/restore`
replays that set. A turn now **plans** the rows it will cause, captures, then
applies — so a generated successor lands in `created_ids` and a cascade-ticked
step in `undo_snapshot`/`post_apply`, like any row the turn wrote directly.

**Two seams grow rather than doubling.** The date seam is `Clock` server-side
and `ControllerDeps.now` client-side — both already exist, and neither is
duplicated; the client seam gains a harness door on `window.__assistantSeams`
(`setClock({at, zone})`) because the e2e tier had none. The zone is **one stored
account attribute** read by every computing path, written by **one installer**
called from the auth step of every request, and read from **two** reporting
channels — `X-Timezone` and the pre-existing turn body field.

**Non-obvious decisions an implementer will question.**

- *Why is `priority` `null` in the store and `"none"` on the wire?* Because
  `applyCreate` skips null fields when building a diff and `taskEquals` compares
  `===`: a literal `'none'` would add a diff row to every create and report all
  783 existing rows modified. ADR-011's neighbour argument; AC-8 states it.
- *Why is a recurrence set a comma-joined string?* So that four scalar-only
  mechanisms stay correct and `turn.diff`'s declared `{old|null, new|null}`
  shape does not change. ADR-011.
- *Why is `due_all_day: null` on the wire not a bug?* It means **not
  determined**; a read never refuses, and a client renders such a due as a date
  with no clock time. ADR-010.
- *Why is restore a route and not a patchable `deleted_at`?* Because `PATCH`
  404s on a deleted row, and inverting that weakens the guard for every field.
  ADR-012.
