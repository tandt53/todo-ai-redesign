# TC-002: Parity — exactly four states on mobile; no transition outside the flowchart

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-002 |
| Feature | F-003 (mobile-surface) |
| Platform | mobile |
| Acceptance criteria | AC-1, F-001 AC-29, F-001 AC-11 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/mobile/F-003-mobile-surface.spec.ts |
| Targets | ios, android |
| Tier | node-headless |
| Created | 2026-08-16 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
The mobile surface is always in exactly one of **idle · listening · thinking · error**. Questions and outcomes are messages, never blocking states — a pending question blocks nothing (F-001 AC-11). The bounded transition rule is the falsifiable half: the only transitions are the edges of F-001's User Flow flowchart, and mobile adds no fifth state for permission, offline, keyboard or backgrounding.

## Preconditions
- Account `qamob-tc002@qa.example.com`; `AppLifecycle`, `Connectivity` and `TranscriptSource` doubles installed.

## Test steps
1. Record the surface state after every driver event in one long sweep: app open → tap mic → speech recognized → end of speech → outcome → tap mic → cancel → type + send → cancel while thinking → AI error → retry → question turn → answer → undo.
2. Interleave the mobile-only events: background, foreground, offline, online, permission denial, keyboard show/hide, system back.
3. Collect the ordered list of `(from, event, to)` triples the surface actually produced.
4. Assert the set of distinct states observed and the set of transitions observed.

## Expected behaviour
- Exactly four distinct state values are ever observed. `offline`, `permission-denied`, `backgrounded`, `keyboard-open` are **not** states: offline renders `assistant-offline-banner`, permission renders a message plus a mic **mode**, backgrounding is a lifecycle event.
- Every observed transition is an edge of the F-001 flowchart. Any triple outside that list fails the test and is reported with its `(from, event, to)`.
- Mic mode (`available | dimmed | hidden`) varies **orthogonally** to state: for at least one state, all three mic modes are observed without the state changing.
- A pending question never blocks: while `turn.question` is unanswered, the list is operable, a manual edit succeeds, and a new command is accepted (F-001 AC-11).
- The mobile-only events in step 2 produce **no** state transition of their own except where an AC names one (audio interruption → idle, AC-7).

## Test data
| Field | Value |
|-------|-------|
| user | qamob-tc002@qa.example.com |
| namespace | `qamob-` |

## Notes
This is a bug-detector, not a success validator: it fails if the implementation adds a state. Falsification check — introduce a fifth state value for "offline" in the model and this test must go red; if it stays green the state sweep is not reading the real state field.
