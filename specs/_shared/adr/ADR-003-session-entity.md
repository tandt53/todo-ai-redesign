# ADR-003 — New session entity; fate of the 30-turn limit (OQ 3)

**Status:** accepted · 2026-08-16 · architect-agent (T-004)

## Context

The existing app has `capture_sessions` (status `open|committed|discarded`,
draft/commit lifecycle, sliding window of 10 turns, hard limit of 30 turns →
`409 commit_required`). OQ 3 asks: reuse it for assistant sessions — in which
case UC-12's 30-turn 409 applies to assistant turns and its close path must
reconcile with AC-28's visible-boundary rules — or create a new entity.

## Options considered

1. **Reuse `capture_sessions`.** One table, history continuity. But its
   status enum encodes a draft-commit model F-001 removed (turns apply
   directly; there is nothing to "commit"), `409 commit_required` is
   meaningless when nothing needs committing, and AC-28's close reasons
   (`idle`, `user_closed`) don't fit `committed|discarded`. Reuse means
   carrying two lifecycles in one enum. Rejected.
2. **New `assistant_session` entity.** Clean lifecycle exactly matching the
   spec's `open|closed` + close_reason; prototype store makes this free.
   Chosen.

## Decision

- New entity **`assistant_session`** (data-model.md). Status enum is the
  spec's verbatim `open | closed` with `close_reason` recorded (AC-28).
  `capture_sessions` is not reused, read, or migrated this phase.
- **The 30-turn hard limit does not apply to assistant turns.** There is no
  409 close path; sessions close only by idle timeout (ADR-004) or explicit
  close. What the 30-turn limit actually bounded — model-context cost — is
  bounded instead by a **sliding interpretation window**: the Interpreter
  receives at most the last **10 resolved turns** of the session as
  conversational context (same window size the existing app proved), while
  the full history remains persisted and served by `GET /assistant/session`.
- Consequence for AC-28: with no 409 path, the boundary message has exactly
  two close reasons to render — `idle` and `user_closed` — and the
  interaction question OQ 3 raised (409-close vs AC-28) is dissolved rather
  than answered.

## Consequences

- Spec sentences about session lifecycle map 1:1 onto the entity; no
  legacy-enum reconciliation for implementers or QA.
- Long sessions degrade gracefully: cost is bounded by the window, not by
  refusing turns — no user-visible hard stop to design or test.
- A turn referencing something older than the window may lose conversational
  context (the model no longer sees it). Accepted: task state — read fresh
  every turn (OQ 7) — not chat history, is the source of truth, and
  clarification questions recover ambiguity (AC-13).
- If a later feature reads old conversations (history review, UC-52
  follow-up), it builds on `assistant_session`, not `capture_sessions`.
