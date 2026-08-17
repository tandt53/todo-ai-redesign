# TC-031: Four states only — bounded transition sweep; every edge has a visible cue

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-031 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-29, AC-2 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-web-agent |
| Last updated | 2026-08-17 by qa-web-agent (T-070b — ADR-008 English copy sync) |

## Summary
The surface is always in exactly one of four states (idle / listening / thinking / error); questions and outcomes are messages, never blocking states. Bounded transition rule, asserted in its bounded form: each edge of the spec flowchart is driven and its visible cue asserted; and at every observation point the surface exhibits exactly one state's cue-set (never zero, never two). Includes the first-run idle-empty surface.

## Transition table (spec User Flow — the complete list)
| # | From → To | Driver |
|---|---|---|
| 1 | idle → listening | tap mic |
| 2 | idle → thinking | type + send |
| 3 | listening → thinking | end of speech |
| 4 | listening → idle | nothing recognized / cancel |
| 5 | thinking → idle (cancel) | tap `assistant-cancel-button` (client-local) |
| 6 | thinking → idle (applied msg) | applied outcome |
| 7 | thinking → idle (confirm q msg) | bulk-delete question |
| 8 | thinking → idle (clarify q msg) | ambiguous reference |
| 9 | thinking → idle (resolution msg) | answer resolves |
| 10 | thinking → idle (no-match msg) | no matching task |
| 11 | thinking → error | AI error |
| 12 | error → thinking | retry (same client_turn_id) |
| 13 | (msg) undo → reverted msg | tap/voice undo — no state change |
| 14 | (msg) answer/new command | normal next turn → thinking |

## Preconditions
- User `qaweb-tc031@qa.example.com`; empty account for first-run (idle-empty), then baseline seed tasks; transcript seam; scripted turn stubs for each outcome kind.

## Test steps
1. First run, empty list: assert idle-empty rendering — invitation copy visible, empty-list message in the list pane, no state indicator, mic available.
2. Drive each table row in order, asserting the visible cue after each: listening (indicator "Listening…", mic pressed, waveform surface), thinking (indicator "Thinking…", thinking bubble), idle (no indicator, composer resting), error (danger-edged bubble + retry).
3. At each observation point, run the exclusivity probe: exactly one of {listening cue-set, thinking cue-set, error cue-set, idle (none-of-the-above + interactive composer)} holds.
4. While a question message is pending (rows 7/8): assert NO modal/overlay/blocked input exists — composer focusable, list clickable, mic tappable (questions are messages, not states).

## Expected behaviour
- Every edge above occurs with its visible cue; the exclusivity probe never finds two concurrent state cue-sets or an unidentifiable fifth rendering.
- Pending questions/outcomes never lock the surface (no blocking overlay; all inputs operable).
- The bounded form of "no transition outside the list": the automation drives ONLY these edges and asserts no spontaneous state change occurs during a 3-second idle observation window after each edge.

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc031@qa.example.com |
| stubs | fixture rows `WEB-R1`…`WEB-R3`, `WEB-U2`, `WEB-U5` |

## Notes
Covers mockup states `idle-empty` and `idle-tasks` as the two idle renderings, plus `listening`/`thinking`/`error` cues. This is the web face of the Gate 1 C6 one-state-count decision.
