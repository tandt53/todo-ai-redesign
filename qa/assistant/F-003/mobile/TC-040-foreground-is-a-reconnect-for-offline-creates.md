# TC-040: A foreground IS a reconnect — offline creates replay even when the connectivity callback never fired

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-040 |
| Feature | F-003 (mobile-surface) |
| Platform | mobile |
| Acceptance criteria | AC-4, AC-8, F-001 AC-25 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/mobile/F-003-mobile-surface.spec.ts |
| Targets | ios, android |
| Tier | node-headless |
| Created | 2026-08-17 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
The replay of offline-created tasks (F-001 AC-25, the half BUG-001 was filed for) must not be owed to `Connectivity.onChange`. That callback only fires if the OS reported the transition **while the app was foregrounded** — and the commonest real path is the opposite: the user loses signal, backgrounds the app, and comes back on wifi. AC-8 makes every foreground transition a reconciliation, so the foreground is where this belongs. A client that replays only on the callback loses the user's offline work on the most ordinary sequence there is, and every headless connectivity test still passes.

## Preconditions
- Account `qamob-tc040@qa.example.com`.
- A `Connectivity` double that reports offline, then online, and whose `onChange` **never fires** — the OS-never-reported-it case. This is the discriminating fixture: with a normally-emitting double the test passes on the callback path and proves nothing about the foreground path.
- `AppLifecycle` double able to emit background/foreground.

## Test steps
1. Cold-open offline. Assert the surface is offline.
2. Create a task by hand. Assert it is `local: true` and absent from `GET /tasks`.
3. Background the app.
4. Flip the connectivity double to online **without** emitting a change event.
5. Foreground the app.
6. Read the client's task list, the local marker, and `GET /tasks`.

## Expected behaviour
- After the foreground, the task is on the server: `GET /tasks` returns it under the **client-generated id** it already had (`api-contracts.md` — no temporary-id mapping exists).
- The local marker is **removed**, not set false, so a synced task is indistinguishable from one that was never local.
- The replay happens exactly once — a foreground that races a connectivity callback must not create the task twice (`syncLocalTasks()` joins an in-flight pass rather than starting a second).
- Offline creates replay **before** the queued turn on this path too, for the reason TC-021 states: a replayed turn must be interpreted against a list that already contains them.

## Test data
| Field | Value |
|-------|-------|
| user | qamob-tc040@qa.example.com |
| task | `qamob-tc040-backgrounded-offline` |
| connectivity double | reports offline → online; `onChange` never emits |

## Notes
Written 2026-08-17 after T-026 added `syncLocalTasks()` to mobile's `onForeground()`. The TC exists because the gap it covers is invisible from the connectivity side: TC-021's reconnect assertions all drive `connectivity.set(true)`, which fires the callback, so they pass whether or not the foreground path works.

**Falsification check:** removing `syncLocalTasks()` from `onForeground()` turns this test red and leaves all 110 others green — verified by mutation on 2026-08-17. That is the whole justification for a separate TC rather than another assertion inside TC-021.
