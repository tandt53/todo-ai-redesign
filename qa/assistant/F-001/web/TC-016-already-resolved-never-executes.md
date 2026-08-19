# TC-016: Answer after resolution — never executes the questioned delete; visible already-resolved outcome

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-016 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-10, AC-11 |
| Type | negative |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-web-agent |
| Last updated | 2026-08-16 by qa-web-agent |

## Summary
One-shot resolution: a question resolves exactly once. An answer arriving after its question is already resolved applies nothing — it NEVER executes the questioned delete — and yields a visible already-resolved outcome. Web-observable case: a stale tap on a chip whose question was just resolved (the tap carries an explicit binding to the question's turn).

## Preconditions
- Open session. User `qaweb-tc016@qa.example.com`; baseline seed tasks; pending bulk-delete question over 3 named tasks.
- Stub scripts: first answer resolves (declined); second answer (explicitly bound via `answer_to_turn_id`) → `resolutions: [{result: already_resolved}]`, zero mutation.

## Test steps
1. Resolve the question with the negative chip (declined — tasks kept).
2. Immediately activate the affirm chip again (stale affordance / race with the resolved state; if the UI already disabled it, drive the equivalent typed answer bound to the same question via the seam-scripted replay).
3. Read the outcome and the list.

## Expected behaviour
- **Never executes**: the 3 questioned tasks remain in the list after step 2 (bounded check by title) — an already-resolved question can never fire its delete, even on an affirmative.
- **Visible outcome**: an already-resolved outcome message renders (AC-11: every resolution path produces a visible outcome; nothing silent).
- The question bubble stays in its resolved state (chips disabled per mockup); no second resolution is recorded visually.

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc016@qa.example.com |
| resolution script | fixture row `WEB-A5` (post-resolution affirmative → already_resolved) |

## Notes
If the UI disables chips instantly (mockup resolved shape), the stale-tap path may be unreachable by pointer — the typed-answer variant with explicit binding is the falsifiable fallback, and the disabled-chip behaviour itself is asserted as the first line of defence.
