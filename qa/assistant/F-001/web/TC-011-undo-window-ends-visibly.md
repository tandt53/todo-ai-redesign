# TC-011: Undo window — newer turn or session close ends it visibly; stale undo refused visibly

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-011 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-8, AC-28 |
| Type | boundary |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-web-agent |
| Last updated | 2026-08-16 by qa-web-agent |

## Summary
Undo is one level and session-bounded: available while its turn is the newest applied turn of the open session. A newer applied turn or session close ends it and the affordance visibly disappears — no hidden timer. An undo attempted outside the window (stale affordance race, or by voice) yields AC-6's visible refusal outcome message stating why: never silence, never a task named "undo".

## Preconditions
- Open session. User `qaweb-tc011@qa.example.com`; baseline seed tasks.
- Applied turn A (newest). Turn stub ready to apply turn B. Undo stub able to return 409 `UNDO_REFUSED {reason: not_newest | session_closed}`.
- Injectable idle-close timer seam available for the close variant (spec Test strategy).

## Test steps
1. Assert `assistant-undo-button` present on turn A's bubble.
2. Send a new applying command → turn B applies.
3. Inspect turn A's bubble; inspect turn B's bubble.
4. Race variant: with a stale Undo affordance still targeting A (stub the 409 not_newest), activate it. Read the outcome.
5. Close variant: fresh applied turn, then trigger session close via the injectable idle-close timer; read the affordance; attempt voice "undo" (409 session_closed / not_undoable per contract). Read the outcome.

## Expected behaviour
- **AC-8 (newer turn)**: After B applies, A's Undo affordance is gone; B's bubble has the (single) `assistant-undo-button`. Exactly one live undo affordance exists at any time.
- **AC-8 (refusal visible)**: The stale/out-of-window attempt renders a visible refusal message stating WHY (not newest / session closed) — no silent no-op, no success rendering, and no task named "undo" appears.
- **AC-8 + AC-28 (close)**: On session close the affordance disappears; the close is visible per AC-28's marker rules.
- No hidden timer: with no newer turn and no close, the affordance persists (probe: wait past typical debounce intervals, affordance still present).

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc011@qa.example.com |
| undo refusals | fixture rows `WEB-UNDO-4` (409 not_newest), `WEB-UNDO-5` (409 session_closed) |

## Notes
The "no hidden timer" probe is bounded (a fixed wait then assert-present), not a proof of forever — the bounded form of the prohibition.
