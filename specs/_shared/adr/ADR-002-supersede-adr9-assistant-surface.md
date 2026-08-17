# ADR-002 — Superseding the existing app's ADR-9 for the assistant surface (OQ 5)

**Status:** accepted · 2026-08-16 · architect-agent (T-004)
**Supersedes:** todo-ai `docs/01-architecture.md` ADR-9 — **for this surface
only** (the deliberate crossing Gate 1 C12 demanded be recorded before
implementation).

## Context

The existing app's ADR-9 keeps the engine domain-neutral: the `ai` layer never
sees real task ids — agents work on draft-refs (`d1`, `d2`) against a
client-held draft, and only `packages/core` knows what a task is. F-001's
`POST /assistant/turn` deliberately crosses that boundary: the server
interprets **and applies** in one atomic turn, against **real task ids**, with
`undo_snapshot`, snapshot-comparison re-validation, and server-side deletes.
A draft-ref bridge cannot express "revert this real task to its pre-apply
state" or "re-validate these real tasks against ask-time state".

## Options considered

1. **Keep ADR-9; extend `chat-intent` with a commit step.** Preserves the
   boundary but re-creates the draft/commit model the redesign removed, and
   AC-6/7/12 (snapshot rules on real rows) still force real ids into the
   engine. Rejected — the spec calls this a new contract, not an extension.
2. **Supersede ADR-9 for the assistant server surface; keep uuids out of the
   model prompt via per-turn handles.** Chosen.
3. **Abandon ADR-9 globally.** Overreach — the legacy capture path and shared
   packages still benefit from the discipline. Rejected.

## Decision

For the **assistant server surface only** (`src/assistant/api/`, endpoints
`/assistant/*`):

- The turn engine operates on **real task ids** and performs **server-side
  task writes** inside the turn transaction.
- The **model boundary keeps opaque handles**: interpretation context lists
  candidate tasks as per-turn handles (`t1`…`tn`) mapped server-side to
  uuids. Raw uuids never enter prompts or model output, and draft-ref tokens
  (`#d1` style) cease to exist on this surface — which is what lets AC-4's
  "internal refs never render" hold by construction.

**Boundary of the supersession:** everything else — the legacy capture/draft
path, `packages/ai`/`core` in the existing repo — remains under ADR-9. This
ADR does not license any other surface to see real ids.

## Consequences

- Implementation of `POST /assistant/turn` is unblocked (the spec required
  this ADR first).
- The engine's task knowledge is confined to `src/assistant/api/`; the
  handle mapping is the one place uuid↔handle translation happens.
- The fixture table (QA) must include an internal-ref row asserting no
  uuid/handle/draft-ref token ever renders (spec, Test strategy).
