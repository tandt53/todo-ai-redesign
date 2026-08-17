# TC-032: Rapid actions — double-activation executes once only (undo, send, affirm)

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-032 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-5, AC-10, AC-16 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-web-agent |
| Last updated | 2026-08-16 by qa-web-agent |

## Summary
Timing probes (bug-signal category 4, concurrency): rapid double-activation of the three mutating controls must produce exactly one execution. Undo double-tap → one revert (second is the idempotent same-success outcome per AC-6's contract, never a second revert); send double-click → one turn (one `client_turn_id`, one message pair); affirm-chip double-tap → the questioned delete executes exactly once (one-shot resolution, AC-10).

## Preconditions
- Open session. User `qaweb-tc032@qa.example.com`; baseline seed tasks; request capture on all `/assistant/*` routes.
- Staged: applied turn (for undo), composer text (for send), pending bulk-delete question (for affirm).
- Stubs honour the contract's idempotency: undo replay → `already_undone: true` same-success; duplicate `client_turn_id` → `replayed: true` or 409 IN_FLIGHT.

## Test steps
1. **Undo**: double-click `assistant-undo-button` as fast as the driver allows. Count undo HTTP requests + rendered reverted-outcome messages; read the list.
2. **Send**: with text in the composer, double-click `assistant-composer-send`. Count turn requests, distinct `client_turn_id`s, user bubbles, outcome messages; read the list.
3. **Affirm**: double-click `assistant-chip-affirm` on a pending 3-task delete question. Count answer turns and executed outcomes; read the list.

## Expected behaviour
- **Undo**: exactly one revert is observable — the list reflects a single revert (values restored once, never double-reverted); at most one reverted-outcome message renders as a NEW revert (an idempotent replay renders the same success, no second revert — AC-6 wire contract). No error flash from the second click.
- **Send**: exactly one user bubble, one outcome message, one applied change in the list; duplicate wire attempts (if any) carry the SAME `client_turn_id` and render no duplicate outcome (AC-16 dedupe / 409 IN_FLIGHT handled invisibly or as the single outcome).
- **Affirm**: the delete executes exactly once — 3 tasks leave the list once, one executed outcome message; the second tap yields no second execution (chip disabled on resolution, or already-resolved outcome per TC-016 — either way zero double-delete).
- No zombie disabled states: after each probe the surface is idle and usable.

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc032@qa.example.com |

## Notes
Playwright drives real double events (`dblclick` + two racing `click`s). This TC is the web layer's contribution to the spec's idempotency story (AC-16 is api-tagged; here we assert the UI's observable once-only behaviour and same-id reuse on the wire).
