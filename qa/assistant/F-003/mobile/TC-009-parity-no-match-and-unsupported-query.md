# TC-009: Parity — no-match quotes the heard transcript; a list question names the working alternative

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-009 |
| Feature | F-003 (mobile-surface) |
| Platform | mobile |
| Acceptance criteria | AC-1, F-001 AC-14, F-001 AC-15 |
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
Two honesty rules that matter more on a phone, where mishearing is more likely than on a keyboard: a command matching no task must quote **what was heard** so a misheard word is distinguishable from an absent task, and a question *about* the list must say it cannot do that yet while naming the working alternative — with zero mutations either way.

## Preconditions
- Account `qamob-tc009@qa.example.com`; a known seeded list; task-table snapshot taken before each sub-case.

## Test steps
1. Speak a command that matches no task (canonical no-match row). Read the message.
2. Compare the quoted string against the transcript the client sent.
3. Snapshot the task table and compare against the pre-state.
4. Ask a question about the list ("what's on Sunday?" shape). Read the message and re-compare the task table.

## Expected behaviour
- The no-match message quotes the heard transcript **verbatim**, including diacritics and any mishearing (mockup `no-match`: `Tôi nghe “gạch trận cầu lông” — không có việc nào trong danh sách khớp.`), and invites a retry.
- Bounded no-mutation check: the task table is unchanged, **no** unrelated task was edited, and **no** task was created. A client that turns a no-match into a new task titled with the transcript fails here.
- The list question yields `unsupported_query` naming the working alternative — the on-screen list and its existing filters — and fabricates **no** answer about the user's tasks.
- Zero task mutations in both branches.

## Test data
| Field | Value |
|-------|-------|
| user | qamob-tc009@qa.example.com |
| utterances | canonical `no_match` and `unsupported_query` rows |

## Notes
The quoted-transcript assertion compares against the exact string on the wire, not a fuzzy contains — an implementation that lowercases or strips diacritics before quoting is a defect (the whole point is that the user can see the mishearing).
