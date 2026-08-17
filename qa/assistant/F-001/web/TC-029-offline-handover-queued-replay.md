# TC-029: Offline — no half-running conversation; local no-AI path; queued turn replays visibly

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-029 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-25 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-web-agent |
| Last updated | 2026-08-17 by qa-web-agent (T-070b — ADR-008 English copy sync) |

## Summary
Offline there is no half-running conversation: the surface states it and hands over to the list (ADR-7). Input made while offline creates tasks through the local no-AI path. A turn already in flight when the connection drops queues and replays VISIBLY when the network returns (UC-13 AC-13.2) — the queued state is shown, and so is its eventual outcome.

## Preconditions
- Open session. User `qaweb-tc029@qa.example.com`; baseline seed tasks.
- Network control (Playwright offline mode + route aborts); AI-call counter seam; `client.outgoing_turn` durable store active (web: survives reload, platform doc).

## Test steps
1. Send a turn; drop the network while it is in flight (thinking).
2. Read the banner, the queued notice, and the surface state.
3. While offline: enter a task through the composer/local path ("qaweb offline task"); read the list and the AI-call counter.
4. While offline: verify manual list ops still work (spot: complete a task).
5. Restore the network. Watch the queued turn replay; read its outcome and the list.

## Expected behaviour
- **Surface says so**: `assistant-offline-banner` renders (mockup `offline` state: "No connection — the list still works, and what you type is saved on the device.", queued count); the conversation does NOT sit in a permanent thinking state — no half-running conversation.
- **Queued visibly**: the in-flight turn's bubble shows the queued notice `assistant-queued-notice` ("Waiting for the network — will send again" + pulse); the banner's queued count reflects it ("1 waiting to send").
- **Local no-AI path**: the offline-entered input becomes a task in the list WITHOUT any AI call (counter delta 0 while offline; zero `/assistant/*` requests); list manual ops keep working.
- **Visible replay**: on reconnect the queued turn is re-sent (same `client_turn_id` on the wire), the queued notice resolves into the turn's real outcome message, and the list updates accordingly. The user can see the replay happened — notice disappears, outcome appears.

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc029@qa.example.com |
| offline task title | "qaweb offline task" |

## Notes
Web asymmetry note (spec): browser speech may be unavailable offline — this TC uses the TYPED path offline; the local path floor is what AC-25 guarantees. Reload-survival of the outgoing turn is the store's contract (data table: web durable storage) — probed with one reload while offline.
