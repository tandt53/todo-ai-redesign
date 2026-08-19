# TC-021: Offline — being offline does not dim or hide the mic; recognized text goes to the local no-AI path

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-021 |
| Feature | F-003 (mobile-surface) |
| Platform | mobile |
| Acceptance criteria | AC-4, F-001 AC-25 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/mobile/F-003-mobile-surface.spec.ts |
| Targets | ios, android |
| Tier | node-headless (routing + mic mode) + device-lab (real on-device recognition offline) |
| Created | 2026-08-16 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
This is where mobile deliberately diverges from web. On-device recognition may still work with no network, so **offline by itself must not dim or hide the mic**. Recognized text is never discarded: it lands in the composer and goes through F-001 AC-25's local no-AI path, no assistant turn is attempted, and the surface states it is offline rather than showing a half-running conversation.

## Preconditions
- Account `qamob-tc021@qa.example.com`; `Connectivity` double offline; `TranscriptSource` capable and granted; AI-call counter readable.

## Test steps
1. Go offline. Read the mic mode and the accessible name.
2. Tap the mic; drive a recognition to a final result.
3. Read the composer, the conversation, the list, and the AI-call counter.
4. Assert no `POST /assistant/turn` was attempted while offline.
5. Perform manual list ops (create, complete) offline.
6. Return online; read the surface.

## Expected behaviour
- The mic is **available** while offline — not dimmed, not hidden. Dimming on offline alone fails this test; that mode belongs to permission denial (TC-015–TC-020) and transient recognizer failure (TC-022).
- The recognized text is **not discarded**: it appears in `assistant-composer-input` verbatim.
- No assistant turn is attempted — the request spy records zero `/assistant/*` calls and the AI-call counter delta is **0**.
- The surface states it is offline: `assistant-offline-banner` renders (mockup: `Mất mạng — danh sách vẫn dùng được.`). There is no permanent thinking state and no half-running conversation.
- The local no-AI path creates the task locally under a client-generated id (per `api-contracts.md`, `POST /tasks` takes a client-generated uuid, so no temporary-id mapping exists).
- Manual list ops work offline.
- On reconnect the banner clears and the surface returns to the normal idle rendering.

## Test data
| Field | Value |
|-------|-------|
| user | qamob-tc021@qa.example.com |
| offline task title | `qamob-tc021-offline-task` |

## Notes
**Device-lab residue:** that on-device recognition genuinely works offline **in the interface language** is a device claim — it depends on OS version and installed packs (Open Question 2). This tier proves the *routing* (mic stays available, text is kept, nothing is sent, list still works); the device pass proves the recognizer. Do not report this TC as covering the device half.

## Execution result — 2026-08-17 (T-021, `phase: execute`; updated after T-023)

PASS. The mic stays **available** offline, the recognized text lands in the
composer verbatim, zero `/assistant/*` requests and zero AI calls are made while
offline, `assistant-offline-banner` renders, manual list ops work, and
reconnecting clears the banner.

### BUG-001 — closed

At the first execute pass the offline-created task never reached the server after
reconnect. That was **BUG-001**, filed against F-001 and inherited by F-003
through the shared controller, so it was cited rather than re-filed. It was
pinned by a test that asserted the *broken* behaviour on purpose, carrying its
own instruction in the failure message: when the fix lands, invert the assertion,
do not delete it.

**T-023 (web-agent) fixed it and the pin fired.** The pin is now five forward
assertions of the behaviour `api-contracts.md` specifies, so the fix cannot
silently regress:

| Assertion | Contract clause it comes from |
|---|---|
| an offline create replays on reconnect under **its own client-generated id**, and the local marker is **removed** (not set false) | "creates the task locally under a real id and replays the create on reconnect — no temporary-id mapping exists" |
| a colliding id is an **ack**: `409 TASK_ID_EXISTS` clears the marker and produces one task, not two | "A colliding id → `409 TASK_ID_EXISTS`; a client replaying its own create treats that 409 as already-synced (its ack)" |
| a second reconnect re-posts nothing and duplicates nothing | idempotence of the replay pass |
| local creates replay **before** the queued turn — asserted through the outcome, not just the wire order: the replayed turn *deletes* the replayed task instead of returning no-match | F-001 AC-25; a task missing from the server is also missing from the turn's interpretation context |
| an offline **cold open** restores stored local tasks, and the next local write does not wipe them | the adjacent path T-023 also closed |

Proven falsifiable by mutation: swapping the reconnect order reddens the ordering
test; treating the 409 as a failure reddens the ack test.

**Device-lab residue unchanged:** that on-device recognition genuinely works
offline in the interface language is a device claim (spec Open Question 2). This
tier proves the routing only.
