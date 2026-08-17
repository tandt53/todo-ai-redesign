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
- ADR-005 — account-scoped session and dedupe (OQ 4)
- ADR-006 — voice-undo mechanism (OQ 6)
