# TC-005: Cancel while thinking — sent turn completes; late outcome renders honestly

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-005 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-3, AC-29 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-web-agent |
| Last updated | 2026-08-17 by qa-web-agent (T-070b — ADR-008 English copy sync) |

## Summary
Cancel is client-local and never pretends to win a race against a sent turn. Cancelling while thinking returns the surface to idle with words kept — but the already-sent turn runs to completion server-side and its late outcome renders as the matching message per its kind: applied → applied bubble + Undo; question → question message (D2 rules apply); failed → error message. This is the spec's "cancel racing apply" injection at the web layer.

## Preconditions
- Open session. User `qaweb-tc005@qa.example.com`; baseline seed tasks.
- `POST /assistant/turn` stub with injectable delay (fixture-controlled), three scripted outcomes: applied / question / failed.

## Test steps
1. Type "qaweb move dentist to Friday" and send; while `assistant-state-indicator` shows the thinking state word ("Thinking…"), activate `assistant-cancel-button` (the cancel pill in the thinking indicator row; listening-cancel remains the mic tap).
2. Assert surface returns to idle immediately, composer keeps the words.
3. Let the delayed 200 (applied) arrive. Read conversation + list.
4. Repeat with the stub scripted to return a question outcome.
5. Repeat with the stub scripted to return 502 AI_ERROR.

## Expected behaviour
- **AC-3, applied race**: The late outcome renders as an applied bubble with diff AND `assistant-undo-button`; the list shows the applied change. The UI never suppresses the outcome or pretends the cancel won. Undo is the honest exit.
- **AC-3, question race**: The question message renders after cancel; it is pending and resolvable per D2 (answer / supersede / session close).
- **AC-3, failed race**: The error message renders (retry offered, words kept).
- **AC-29**: Cancel transition thinking → idle has a visible cue; the late message arrives while idle without re-entering thinking.

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc005@qa.example.com |
| stub scripts | fixture rows `WEB-R1` (applied, delayed), `WEB-R2` (question, delayed), `WEB-R3` (502, delayed) |
| delayed rows | all three QA_EXTRA at `delay_ms: 150` — `qaweb delayed create`, `qaweb delayed bulk delete`, `qaweb delayed failure` (`qa/assistant/automation/harness/qa-test-server.ts`) |

## Notes
There is no cancel endpoint (api-contracts, "Deliberately absent") — the automation asserts NO cancel-shaped HTTP request is emitted on cancel.

**Timing (T-070b).** The applied-race sub-case previously drove the canonical 60ms delay row ("add a task to buy cheese"). 60ms is shorter than one Playwright click round-trip against the in-process harness, so the thinking indicator — which owns the cancel pill — unmounted while the click was still resolving actionability, and the case failed roughly one run in three with "element was detached from the DOM". Triaged as a **script race, not a product bug**: reproduced 1 fail in 3 targeted runs, and the cancel path itself was passing in the two sub-cases that already used 150ms rows. The remedy is the one those two rows document — a QA_EXTRA row at 150ms, now also for the create variant. Nothing about the assertion was relaxed: cancel must still win the surface while a real turn is genuinely in flight, and the late outcome must still render. The 60ms canonical row keeps its own coverage of the ordinary thinking transition in TC-011 and TC-031.
