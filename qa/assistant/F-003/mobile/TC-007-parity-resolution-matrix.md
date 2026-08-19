# TC-007: Parity — question resolution matrix; every path produces a visible outcome

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-007 |
| Feature | F-003 (mobile-surface) |
| Platform | mobile |
| Acceptance criteria | AC-1, F-001 AC-10, F-001 AC-11, F-001 AC-12 |
| Type | negative |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/mobile/F-003-mobile-surface.spec.ts |
| Targets | ios, android |
| Tier | node-headless |
| Created | 2026-08-16 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
D2's resolution rules are a decision table with five reachable outcomes; nothing resolves silently, and no path may execute a delete that was not clearly affirmed. This is the security-adjacent case of the feature — the failure mode is destructive (an unclassifiable mumble deleting three tasks), so every row is P1.

## Preconditions
- Account `qamob-tc007@qa.example.com`, one pending bulk-delete question per sub-case (fresh session each).

## Test steps
For each row, ask the bulk-delete question, then drive the answer and read the list + the outcome message.

| # | Answer driven | Expected result | Expected list |
|---|---|---|---|
| 1 | clearly affirmative | `executed` with full applied anatomy | named tasks deleted |
| 2 | negative | `declined` | unchanged |
| 3 | unrelated interpretable command | `declined_superseded` **and** the new command proceeds | new command's effect only |
| 4 | unclassifiable utterance | nothing executes, question stays **pending** | unchanged |
| 5 | answer arriving after the question already resolved | `already_resolved` | unchanged |
| 6 | affirmative, but a named task was changed since the question was asked | executed on the survivors; outcome states the **actual** count and names | only survivors deleted |

## Expected behaviour
- Every row produces a **visible outcome message** — nothing resolves silently (F-001 AC-11).
- Row 1's executed outcome carries the full applied anatomy: rows marked, actual count and titles named, and `assistant-undo-button` present.
- Row 3 renders both messages in order: the declined-superseded outcome (mockup: `Đã giữ nguyên 3 việc` / `Lệnh xoá được gác lại vì bạn đã chuyển sang việc khác. Không có gì bị xoá.`) and the new command's own outcome.
- Row 4: the question is still answerable afterwards by an affirmative — resolvable by exactly the D2 events, no timeout anywhere.
- Row 5 **never** executes the questioned delete. This is the assertion that must not be weakened.
- Row 6: the count in the message equals the count actually deleted (F-001 AC-12), and the dropped task is named.
- Across all rows, zero deletions occur in rows 2, 3, 4, 5.

## Test data
| Field | Value |
|-------|-------|
| user | qamob-tc007@qa.example.com (one sub-account per row) |
| answers | canonical answer rows (affirmative / negative / unclassifiable) from the F-001 fixture table |

## Notes
The answer travels as a **normal turn** on `POST /assistant/turn` — spoken, typed, or a tap sending the option's literal text with `answer_to_turn_id`. There is no confirm endpoint on mobile any more than on web; a mobile-only confirm protocol would be an AC-1 fork.
