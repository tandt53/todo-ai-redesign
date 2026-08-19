# TC-031: Cold open onto a closed session renders exactly ONE boundary message and starts clean

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-031 |
| Feature | F-003 (mobile-surface) |
| Platform | mobile |
| Acceptance criteria | AC-8, F-001 AC-28 |
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
A stale session must start clean rather than pointing at yesterday's tasks — but not silently. Exactly **one** boundary message carries the closed session's terminal outcomes: the close marker, every question declined by close **named**, and any turn that resolved between last foreground and close. "Exactly one" is the assertion; a client that renders one message per boundary item floods the surface, and one that renders none loses the outcomes entirely.

## Preconditions
- Account `qamob-tc031@qa.example.com`; a closed session carrying: close reason `idle`, one declined question with three task titles, one late applied turn.

## Test steps
1. Cold-open. Read the conversation.
2. Count messages carrying `assistant-boundary-marker`.
3. Read the boundary content against the server's `boundary` payload field by field.
4. Send a new turn; assert it opens a new session and renders normally after the boundary.
5. Background and foreground again; count boundary messages.
6. Repeat with `close_reason: "user_closed"`.

## Expected behaviour
- Exactly **one** `assistant-boundary-marker` message renders (mockup `boundary` state: close marker line, declined question named with its task titles, late outcome named).
- Its content covers all three payload parts: close marker with reason and time; **every** declined question named with its task titles; **every** late outcome with tasks named. A boundary that renders the marker but drops the declined-question names fails.
- The conversation above the boundary is **clean** — yesterday's turns are not shown as if live, and no undo affordance from the closed session survives.
- Step 4: the new turn opens a new session and renders below the boundary.
- Step 5: the boundary is **not** re-rendered on a subsequent foreground — one boundary, once.
- Both close reasons render a boundary; the reason is stated.

## Test data
| Field | Value |
|-------|-------|
| user | qamob-tc031@qa.example.com |
| boundary payload | 1 declined question (3 titles) + 1 late applied turn |

## Notes
Step 5 is the duplicate-render probe. The failure it catches is a client that renders the boundary from the `GET` response each time rather than once per session transition — invisible on a single cold open, obvious after two foregrounds.
