# TC-006: Parity — bulk delete asks (>1) while a single delete applies (=1)

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-006 |
| Feature | F-003 (mobile-surface) |
| Platform | mobile |
| Acceptance criteria | AC-1, F-001 AC-9, F-001 AC-11 |
| Type | boundary |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/mobile/F-003-mobile-surface.spec.ts |
| Targets | ios, android |
| Tier | node-headless |
| Created | 2026-08-16 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
The confirmation gate is a boundary at exactly one task: a delete touching **more than one** task asks first, a single-task delete applies immediately with undo. Boundary value analysis says the interesting cases are 1 and 2, not 1 and 5 — this TC drives both edges plus one above.

## Preconditions
- Account `qamob-tc006@qa.example.com`; seeds sized so one utterance resolves to exactly 1 task and another to exactly 2.

## Test steps
1. Issue a delete resolving to exactly **1** task. Read the list and the message.
2. Issue a delete resolving to exactly **2** tasks. Read the list and the message.
3. Issue a delete resolving to **3** tasks. Read the message.
4. While the question from step 2/3 is pending, read the list and perform a manual complete.

## Expected behaviour
- Step 1 (count = 1): the task is deleted immediately, the outcome message names it by title (no row remains to mark), and `assistant-undo-button` is offered.
- Step 2 (count = 2): **nothing is deleted.** A confirm question message renders naming the count and **both titles**, with `assistant-chip-affirm` and `assistant-chip-negative`. The list is unchanged.
- Step 3 (count = 3): same shape, count and three titles (mockup `question-confirm`: head `Xoá 3 việc?`, body naming all three).
- The question applies nothing (F-001 AC-1 carve-out) — the task table is unchanged by the asking turn.
- Step 4: the list is fully operable while the question is pending; the manual complete succeeds and does **not** resolve the question (F-001 AC-11).

## Test data
| Field | Value |
|-------|-------|
| user | qamob-tc006@qa.example.com |
| counts driven | 1, 2, 3 |

## Notes
Count 2 is the boundary the F-001 web suite needed a QA extra row for. Reuse the same canonical/extension row rather than inventing a mobile-only utterance — one fixture table, per L-004.
