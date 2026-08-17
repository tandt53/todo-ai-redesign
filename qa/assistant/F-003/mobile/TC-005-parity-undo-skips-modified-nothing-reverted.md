# TC-005: Parity — undo names every skipped task; all-skipped never reads as success

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-005 |
| Feature | F-003 (mobile-surface) |
| Platform | mobile |
| Acceptance criteria | AC-1, F-001 AC-7 |
| Type | negative |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/mobile/F-003-mobile-surface.spec.ts |
| Targets | ios, android |
| Tier | node-headless |
| Created | 2026-08-16 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
Undo never clobbers later work: a task modified after the turn is **skipped and named**; when every task is skipped, the message says nothing was reverted and must never render as a successful revert. Zero silent overwrites. This is the highest-consequence honesty rule in the undo contract and its whole observable is the rendered message, so mobile owns it fully.

## Preconditions
- Account `qamob-tc005@qa.example.com`; an applied turn touching two tasks.

## Test steps
1. Apply a turn that changes task A and task B.
2. Modify task A by hand (manual list edit) after the turn.
3. Tap undo. Read the outcome message and the list.
4. Reset with a fresh applied turn touching A and B; modify **both** by hand; tap undo.
5. Reset again; with no applied turn in the session at all, say the undo phrase.

## Expected behaviour
- Step 3: B reverts, A is left alone, and the message **names A** as skipped (mockup `reverted` state: `Skipped: {title} — it changed after my edit, so I left it alone.`). The skipped task's current value is unchanged — zero silent overwrite.
- Step 4: the message is the nothing-reverted shape (mockup `nothing-reverted` state, head `Nothing was undone`) naming **both** tasks; the list is byte-identical before and after; the message must not carry a success head and must not be styled as an applied outcome. The automation asserts this head **against an observed successful revert** rather than against a typed literal — the head must differ from the one a real revert produces, which is the property AC-7 is about and which a named string stops checking the moment the copy moves.
- Step 5: `There is nothing to undo — nothing has been applied in this session.` — a visible refusal, and the utterance never becomes a task titled `undo`. (ADR-008 retired the Vietnamese phrase `hoàn tác`; `undo` is the whole closed list, and the AC-5 guard short-circuits it before the model.)
- In every branch the count named in the message equals the count actually reverted. A message claiming 2 reverted while 1 reverted fails this test.

## Test data
| Field | Value |
|-------|-------|
| user | qamob-tc005@qa.example.com |
| tasks | two `qamob-` seeded titles |

## Notes
Modified-since detection is snapshot comparison against **post-apply** state (F-001 AC-7). If this test reports every task as skipped even when untouched, the implementation is comparing against the pre-apply snapshot — the exact inversion AC-7 calls out. Diagnose that before filing.
