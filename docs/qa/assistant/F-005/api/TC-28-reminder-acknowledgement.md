# TC-28: The server writes `reminder_shown_at`, on an acknowledgement the client sends

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-28 |
| Feature | F-005 (task-detail) |
| Platform | api |
| Acceptance criteria | AC-38, AC-10, AC-40 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/api/F-005-task-detail.spec.ts (`describe('TC-28 …')`) |
| Created | 2026-08-19 by qa-api-agent |
| Last updated | 2026-08-19 by qa-api-agent |

## Summary
AC-38's **single falsifiable clause** is a server-persistence assertion observable at no other layer, and it is the whole reason the AC carries `(api)`: "revision 2 tagged the AC for two client tiers, both of which pass against an in-memory flag." Revision 4 struck "surfaced once" in favour of the sub-bullet: an **acknowledged** reminder does not reappear; an **unacknowledged** one does, at every open, until it is acknowledged or the task is completed or deleted.

## Preconditions
- In-process harness: `createApp(deps)` with the `__qa__` doors mounted in front, on an ephemeral port, driven by supertest. Fresh durable store per test.
- The clock seam and the account zone are both held at `T0 = 2026-08-19T12:00:00.000Z` / `UTC` by `POST /__qa__/set-clock` (AC-44). Every fixture instant is derived from `T0`, never from a wall clock (L-023).
- Reminders whose instant is in the past relative to `T0`, so they are the surfacing population.
- The durable store, so `POST /__qa__/reopen-store` can stand in for "after a reload".

## Test steps (API)
| # | Case (automation `it` name) | Request | Expected |
|---|------------------------------|---------|----------|
| 1 | TC-28a acknowledging sets the marker iff reminder_at matches | `POST /tasks/{id}/reminder-ack {reminder_at}` | `200 {task, changed, acknowledged: true}`, `reminder_shown_at == now`; the envelope has exactly those three keys |
| 2 | TC-28b an UNACKNOWLEDGED reminder reappears at every read; an acknowledged one is distinguishable | one acked row and one unacked row, read before and after a store re-open | `reminder_shown_at` is `null` for the unacked row and non-null for the acked one, both times |
| 3 | TC-28c a MOVED reminder is 409 REMINDER_MOVED | move the reminder, then ack the OLD instant | `409 REMINDER_MOVED`, marker still `null`; acking the current instant works |
| 4 | TC-28d acknowledging on a DONE or DELETED row is a no-op | ack a done row; ack a deleted row | `200 acknowledged: false`, nothing written |
| 5 | TC-28e reminder_shown_at is writable through THIS DOOR AND NO OTHER | `PATCH {reminder_shown_at}`; `POST /tasks {reminder_shown_at}` | `400 VALIDATION field: 'reminder_shown_at'` both times; the marker is still `null` |
| 6 | TC-28f the ack door is scoped to the caller's rows | cross-account, no auth, unknown id | `404` / `401` / `404`; the victim's marker is untouched |
| 7 | TC-28g reminder_at is REQUIRED on the ack body, and an unknown field is refused | empty body; body with an extra field | `400 VALIDATION`; `400 VALIDATION field: 'force'` |

## Expected behaviour
- The **server** writes the marker, on an acknowledgement the client sends — not on render, and not by the client.
- `reminder_shown_at` is carried **on the wire**, "so a client can tell an unacknowledged reminder from an acknowledged one without asking" — added in revision 4 (dev-mobile F4), and without it "every passed reminder re-surfaces on every foreground."
- The instant match is what stops an ack of an old instant retiring a new reminder.
- Caller scoping is explicit: "AC-41's restore got this clause; this door is the other brand-new write path and gets the same care." And **a turn may not set it** — TC-27b.

## Test data
| Field | Value |
|-------|-------|
| namespace | task titles `qaapi5-*`; reserved user ids in `docs/qa/_shared/fixtures/api/f005-users.json`. No unscoped destructive operations (§10). |
| past reminder | `2026-08-18T09:00:00.000Z` (before `T0`) |

## Notes
- "Render is not resolution" (product P1, design D16) is a **client** obligation — the acknowledgement gesture is design's, and the offline half ("an acknowledgement made offline is not recorded") is the clients'. What the api tier owns is the persistence and the matching, and that is what is asserted here.
- TC-28b uses a store re-open as the closest this tier gets to "the next launch, the next device, after a reload". The device half belongs to qa-web-agent and qa-mobile-agent.
- *Would this notice?* Yes — an in-memory flag fails TC-28b's post-reopen read; a marker written on render would already be non-null in TC-28a's precondition; a missing instant match fails TC-28c.
