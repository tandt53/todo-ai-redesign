# BUG-001 — tasks created while offline never reach the server

- **Filed:** 2026-08-17 by orchestrator (found by mobile-agent during T-019's shared extraction)
- **Layer:** `web` (shared client controller — now `src/assistant/_shared/`)
- **Severity:** HIGH — silent, permanent divergence between device and server
- **Feature:** F-001 (approved), inherited by F-003
- **Status:** FIXED 2026-08-17 (T-023) — syncLocalTasks() in the shared controller; 409 TASK_ID_EXISTS treated as ack; also closed an adjacent path where an offline cold open wiped stored local tasks

## What the contract promises

`specs/assistant/api-contracts.md:313-317` — the offline local path assigns a
client-generated task `id`, and the client **"replays the create on reconnect —
no temporary-id mapping exists. A colliding id → `409 TASK_ID_EXISTS`; a client
replaying its own create treats that 409 as its already-synced ack."**

Spec F-001 AC-25 puts the offline input on the local no-AI path on that basis.

## What the code does

`src/assistant/_shared/controller.ts:559` creates the task with `local: true`
and nothing ever clears it. There is no replay of local creates anywhere in
`_shared/` (grep for `replayLocal|replayCreate|pendingCreates` returns nothing).
Only the outgoing *turn* is replayed (`replayLeftoverOutgoing`).

## Consequence

A task the user creates while offline stays on that device forever. It is absent
from `GET /tasks`, so it never appears on another device, never enters an
assistant turn's context, and is lost with the app's storage. No error is shown —
the user has every reason to believe the task was saved, because it is visibly
in their list.

## Why no gate caught it

- C3/C9 compare declared endpoints and handler shapes; `POST /tasks` exists and
  matches. The missing thing is a *client-side call that never happens*, which no
  contract-consistency check reads.
- The web e2e offline TC (TC-029) asserts the queued **turn** replays visibly —
  which it does. The local-create half of AC-25 has no test.
- The api suite proves the server accepts a client id and returns
  `409 TASK_ID_EXISTS` on replay — the server half is correct and tested. The
  client half was never written.

## Fix direction (not yet decided)

Either implement the replay the contract already specifies (client re-POSTs each
`local: true` task on reconnect, treats `409 TASK_ID_EXISTS` as the ack, clears
the flag), or amend the contract and AC-25 to say offline creates are
device-local until the user acts again — which would be a product decision, not
a doc edit, because it changes what the app promises.

## Evidence
```
$ grep -rn "local: true" src/assistant/_shared/
src/assistant/_shared/controller.ts:559:      local: true,
$ grep -rn "replayLocal\|replayCreate\|pendingCreates" src/assistant/_shared/
(no matches)
$ grep -n "replays the create on reconnect" specs/assistant/api-contracts.md
315:replays the create on reconnect — no temporary-id mapping exists. A colliding
```
