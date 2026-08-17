# TC-015: Unclassifiable utterance — executes nothing, question stays pending and resolvable

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-015 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-10 |
| Type | negative |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-web-agent |
| Last updated | 2026-08-17 by qa-web-agent (T-070b — ADR-008 English copy sync) |

## Summary
An unclassifiable utterance — not affirmative, not negative, not an interpretable command — executes nothing and the question stays pending, still resolvable by exactly D2's events (answer, supersede, session close). Uses the spec's ambiguous-answer fixture rows, which assert ZERO deletion (spec Test strategy: "ambiguous-answer rows asserting zero deletion").

## Preconditions
- Open session. User `qaweb-tc015@qa.example.com`; baseline seed tasks; pending bulk-delete question over 3 named tasks.
- Stub: unclassifiable answer → turn outcome `unclassifiable`, `resolutions: []`, no mutation. Classification comes from the canonical ambiguous-answer fixture rows.

## Test steps
1. With the question pending, send ambiguous answer 1 ("the weather is nice" — fixture `AMB-1`).
2. Read the reply, the question bubble, and the list.
3. Send ambiguous answer 2 ("hmm maybe" — fixture `AMB-2`). Re-read.
4. Then resolve properly: tap `assistant-chip-affirm`. Read the outcome.

## Expected behaviour
- **Zero deletion after each ambiguous turn**: all 3 questioned tasks still in the list (checked by title after steps 1 AND 3 — the fixture rows' bounded assertion).
- **Question stays pending**: the question bubble remains unresolved — chips still enabled/actionable, not disabled-resolved.
- **Visible, not silent**: the unclassifiable turn produces a visible outcome (the `unclassifiable` outcome message) — nothing resolves silently, and nothing pretends to resolve.
- **Still resolvable**: step 4's affirmative executes normally with full applied anatomy — the pending question survived two ambiguous turns intact and resolves exactly once.

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc015@qa.example.com |
| answers | canonical ambiguous-answer fixture rows `AMB-1`, `AMB-2` (web mirror in assistant-web-fixtures.json) |

## Notes
No timeout anywhere (D2): between steps the question must not auto-resolve; the automation includes a bounded idle wait before step 4 with the question still pending.
