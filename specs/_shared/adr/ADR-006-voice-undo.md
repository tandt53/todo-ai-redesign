# ADR-006 — Voice-undo mechanism: closed phrase list, short-circuit before the model (OQ 6)

**Status:** accepted · 2026-08-16 · architect-agent (T-004) — architecture
half; design-agent owns the affordance/wording half.

## Context

AC-5: saying "hoàn tác" / "undo" undoes the newest applied turn and **never
becomes a task with that name**. Candidate mechanisms (11-uc §6.19): a
client-side closed phrase list vs a model `undo_turn` tool. The contract must
say whether the phrase short-circuits before model interpretation.

## Options considered

1. **Model `undo_turn` tool.** Handles paraphrases ("bỏ đi", "revert that"),
   but makes the core AC-5 guarantee probabilistic — a misclassification
   creates a task named "undo" — and drags undo through the model on every
   utterance. Rejected for v1.
2. **Client-side closed phrase list, exact match, short-circuit before any
   send** + a server-side guard as backstop. Deterministic; undo works even
   when the model/stub is down; guarantee holds by construction. Chosen.

## Decision

- **Yes — "undo"/"hoàn tác" short-circuits before model interpretation.**
- **Phrase list (closed, shared constant `UNDO_PHRASES`):** exactly `"undo"`
  and `"hoàn tác"`, matched on the **normalized full utterance** (trim,
  lowercase, Unicode NFC, strip terminal punctuation). Anything longer
  ("undo the last thing") is a normal turn for the model. Growing the list is
  a design/product decision; the mechanism doesn't change.
- **Client half:** on a match, the client sends **no turn**. It calls
  `POST /assistant/turn/{turn_id}/undo` with `via: "voice"` against the
  newest applied turn it renders. Stale affordance → the endpoint's visible
  AC-6 refusal. No applied turn known at all → the client renders the same
  refusal message locally (design-agent's catalogue), no server call, no
  task created (AC-8).
- **Server backstop (how the contract expresses it):** if a transcript
  normalizing into `UNDO_PHRASES` reaches `POST /assistant/turn` anyway, the
  server does **not** interpret and creates **no turn row**: it executes the
  undo path against the newest applied turn of the open session (or returns
  the refusal outcome) and records the result under the `client_turn_id` for
  dedupe — response `kind: "undo"` (api-contracts.md, processing rule 3).
  The turn-status machine is untouched because no turn exists; the outcome
  renders from the undone turn's `undo_result`, exactly as a tap undo.

## Consequences

- AC-5's "never a task named undo" holds even against a buggy client, and is
  testable in the API suite without any model: send `"undo"` as a turn,
  assert zero task mutations plus a real revert.
- The QA fixture table still carries undo-phrase rows asserting no
  interpretation call occurs (harness AI-call counter).
- Paraphrased undo intents fall through to the model and become no-match or
  clarify outcomes — honest, visible, and revisitable when F-002+ considers
  an `undo_turn` tool. This ADR fixes v1 semantics only.
