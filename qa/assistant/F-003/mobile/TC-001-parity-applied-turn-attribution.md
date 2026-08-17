# TC-001: Parity — applied turn lands in the list in the same turn, attributed in place

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-001 |
| Feature | F-003 (mobile-surface) |
| Platform | mobile |
| Acceptance criteria | AC-1, F-001 AC-1, F-001 AC-4 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/mobile/F-003-mobile-surface.spec.ts |
| Targets | ios, android |
| Tier | node-headless |
| Created | 2026-08-16 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
F-003 AC-1 binds the parity table: an F-001 AC listed as *hold identically* must be observably true on the mobile surface, driven by the same conversation reducer and outcome→message mapping the web client uses. This is the base case — an applying turn's changes land atomically and appear in the on-screen list within the same turn (F-001 AC-1), and every change is attributable in place (F-001 AC-4). If mobile forked the reducer, this test is where the fork shows up first.

## Preconditions
- Account `qamob-tc001@qa.example.com`, open session, seeded tasks per the canonical utterance→intent table (`qa/assistant/F-001/api/utterance-intent-fixtures.json` — read, never copied).
- `TranscriptSource` double with capability granted; `Connectivity` online; `DurableStore` empty.

## Test steps
1. Drive an editing + creating utterance through the surface (canonical multi-effect row: an edit of an existing task plus a create).
2. Read the rendered task list and the newest assistant message while the turn is still the newest turn.
3. Read every diff pair the message exposes and the row markers on the list.
4. Assert no raw uuid and no `#d1`-style draft-ref token appears in any rendered string.

## Expected behaviour
- The list reflects **both** effects in the same turn — the list, not the chat reply, is where the result lives (F-001 AC-1).
- The applying turn is atomic: either both effects are present or neither is; no partial state is ever rendered.
- The message carries the applied anatomy: head naming the counts (mockup: `Đã sửa 1 việc · thêm 1`), one diff row per changed task, `assistant-diff-old` → `assistant-diff-new` for the edit, a "new" marker for the create with **no fabricated old value**, and an `assistant-undo-button` (F-001 AC-4, F-001 AC-5).
- Only this turn's `changed_task_ids` are marked (`assistant-row-badge`); rows changed by hand or by another turn carry no marker from this turn.
- Zero rendered strings contain a task uuid or a draft-ref token.
- The mobile message vocabulary for this outcome is **identical** to the web client's for the same turn record — same kind, same fields, no mobile-only field and no dropped field (AC-1's no-fork rule).

## Test data
| Field | Value |
|-------|-------|
| user | qamob-tc001@qa.example.com |
| utterances | canonical rows from `qa/assistant/F-001/api/utterance-intent-fixtures.json` (edit + create) |
| namespace | `qamob-` |

## Notes
A divergence found here is a **spec question routed through the orchestrator**, never an implementer's local call (AC-1's own wording). If this test fails because mobile renders a different message shape than web, file it as a spec/architecture question before filing a product bug against either client.
