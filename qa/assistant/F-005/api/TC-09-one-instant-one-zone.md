# TC-09: One instant, one zone, one answer per row

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-09 |
| Feature | F-005 (task-detail) |
| Platform | api |
| Acceptance criteria | AC-44, AC-32, AC-13 |
| Type | boundary |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/api/F-005-task-detail.spec.ts (`describe('TC-09 …')`) |
| Created | 2026-08-19 by qa-api-agent |
| Last updated | 2026-08-19 by qa-api-agent |

## Summary
AC-44 was **inverted in revision 3** because "an implementation with a perfect seam and an hour of DST drift passed". So the assertions here are the **outcomes**: a daily 09:00 repeat rolled across a DST boundary is still due at 09:00 wall-clock; a rolled due depends on the previous due rather than on the moment of completion; a row resolves in one zone rather than one per device; and a computation with no zone is refused rather than falling back.

## Preconditions
- In-process harness: `createApp(deps)` with the `__qa__` doors mounted in front, on an ephemeral port, driven by supertest. Fresh durable store per test.
- The clock seam and the account zone are both held at `T0 = 2026-08-19T12:00:00.000Z` / `UTC` by `POST /__qa__/set-clock` (AC-44). Every fixture instant is derived from `T0`, never from a wall clock (L-023).
- For the DST case the run is re-held at `2026-10-31T12:00:00.000Z` / `America/New_York` (US DST ends 2026-11-01).
- A deliberately zoneless client, for the refusal.

## Test steps (API)
| # | Case (automation `it` name) | Request | Expected |
|---|------------------------------|---------|----------|
| 1 | TC-09a a date computation with no zone at all is REFUSED, and writes nothing | zoneless `POST /tasks {due_at}` | `409 TIMEZONE_UNKNOWN`, `detail.header == 'X-Timezone'`, and `GET /tasks` shows nothing written |
| 2 | TC-09b a rolled due is computed from the PREVIOUS due, never from the moment of completion | complete a Monday weekly task at `T0`, then again with the clock moved three weeks on | both successors are due the same next Monday |
| 3 | TC-09c a daily 09:00 repeat rolled across a DST boundary is still due at 09:00 WALL CLOCK | due `2026-10-31T13:00Z` (09:00 EDT), daily, complete | successor `2026-11-01T14:00Z` — 09:00 EST, not 13:00Z |
| 4 | TC-09d the zone is first-report-wins; a later differing report changes nothing | two device agents reporting different zones | `timezone` stays the first, `timezone_last_report` shows the second, and one row reads all-day for BOTH devices |
| 5 | TC-09e PATCH /account is the only way to change an established zone | `PATCH /account {timezone}` valid then invalid | `200` with `timezone_source: 'user'`; `400 VALIDATION` on an unknown IANA zone, value unchanged |
| 6 | TC-09f the BY-HAND user is safe | `GET /tasks` then a dated create, zero turns | `201`, and the AI-call counter is still 0 |

## Expected behaviour
- The DST outcome is the whole point: an implementation adding 24h of milliseconds lands on 13:00Z — 08:00 local, "an hour either side", which AC-44 forbids by name.
- `409 TIMEZONE_UNKNOWN` is reachable only for a client that has never sent the header on any request, because `recordClientZone` runs in the auth step before routing — it is a **client contract violation addressed to the client**, not a user state.
- A later report is recorded as `timezone_last_report` and changes nothing: an upsert-before-read would make device A resolve rows in UTC and device B in UTC+7 in the same second, which is the three-answers defect arriving through the writer.
- AC-32's by-hand user establishes the zone with an ordinary `GET /tasks`, so a user who never sends a turn is never the account that cannot compute a date.

## Test data
| Field | Value |
|-------|-------|
| namespace | task titles `qaapi5-*`; reserved user ids in `qa/_shared/fixtures/api/f005-users.json`. No unscoped destructive operations (§10). |
| DST zone | `America/New_York`; DST ends 2026-11-01, so 09:00 EDT = 13:00Z and 09:00 EST = 14:00Z |
| zones used | `Europe/Berlin`, `Asia/Bangkok`, `Pacific/Auckland`, `Mars/Olympus_Mons` (invalid) |

## Notes
- TC-09d was red on first authoring for a reason worth recording: `recordClientZone` runs on **every** request including a read, so reading the account through the default agent overwrote `timezone_last_report` with its own header. Fixed by giving each device its own agent — the observable is only meaningful if the read comes from the same device.
- *Would this notice?* Yes — TC-09c is the single assertion an inline `new Date()` or a millisecond-arithmetic roll cannot pass, and TC-09b distinguishes "reads the previous due" from "reads the clock".
