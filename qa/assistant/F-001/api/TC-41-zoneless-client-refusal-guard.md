# TC-41: A zoneless client is refused on a date-computing write, and still served on a read

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-41 |
| Feature | F-001 (voice-assistant-view) — harness guard for F-005 |
| Platform | api |
| Acceptance criteria | F-005 AC-44, F-005 AC-13, F-005 AC-18 (harness guard; this suite's own ACs are unaffected) |
| Type | regression |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/api/F-001-voice-assistant-view.spec.ts (`TC-41 a zoneless client is refused…`) |
| Created | 2026-08-19 by qa-api-agent |
| Last updated | 2026-08-19 by qa-api-agent |

## Summary
This case exists because of a fix, and it guards that fix.

ADR-010 / `F-005 AC-44` made `account.timezone` the one source every date
computation reads, and made a date computation with no zone a
`409 TIMEZONE_UNKNOWN`. This suite's `seedTask` helper posts `due_at`, so TC-14
and TC-17 began failing `expected 201, got 409`. The fix was a **default
`X-Timezone: UTC` header on the harness's supertest agent** — one hook on the
client rather than a `.set()` on every call, because the zone is a property of
the client and because a per-call fix has to be re-applied by every case added
afterwards.

That fix has a cost, and this case is the payment: with a zone on every request,
**nothing in this file can observe the refusal any more**. A regression that
dropped the refusal, or one that silently fell back to the server's own zone —
which AC-44 forbids by name — would leave all 47 other tests green. So the
harness keeps a second, deliberately **zoneless** agent, and this case is the
one thing that uses it.

## Preconditions
- The in-process harness (`makeHarness()`), fresh store per test.
- `Harness.zoneless` — a supertest agent that has never sent `X-Timezone` on any
  request. `api-contracts.md § When the zone is absent` says that is the only
  way to reach this refusal, because `recordClientZone` runs in the auth step
  before routing.
- A user id used by **no other request in the test**, so `h.agent`'s own zone
  header cannot have established an account zone for it.

## Test steps (API)
| # | Method | Path | Headers | Body | Expected status | Expected response shape |
|---|--------|------|---------|------|-----------------|-------------------------|
| 1 | POST | /tasks | `X-User-Id: <fresh>` only — **no `X-Timezone`** | `{"title":"qaapi-zoneless-due","due_at":"2026-08-20T08:00:00.000Z"}` | 409 | `{ error: { code: "TIMEZONE_UNKNOWN", detail: { header: "X-Timezone" } } }` |
| 2 | GET | /tasks | same zoneless client | — | 200 | `{ tasks: [] }` — the refused write wrote nothing |
| 3 | POST | /tasks | same zoneless client | `{"title":"qaapi-zoneless-dateless"}` | 201 | `{ task: {...} }` — no date computation, so no refusal |
| 4 | GET | /tasks | same zoneless client | — | 200 | `{ tasks: [ 1 row ] }` — a read never refuses |

## Expected behaviour
- Step 1 is `409` with code exactly `TIMEZONE_UNKNOWN` and `detail.header`
  exactly `X-Timezone`. The code and the header name are both asserted: a `409`
  with a different code would pass a status-only assertion.
- Step 2 proves the refusal is **whole-write** (`F-005 AC-18`: "a refused write
  writes nothing"). Asserted as an absence, not assumed.
- Steps 3–4 prove the refusal is scoped to computations, not to the account: a
  write needing no date succeeds and **a read never refuses**
  (`api-contracts.md § Task on the wire`, `§ When the zone is absent`).

## Test data
| Field | Value |
|-------|-------|
| user id | a fresh uuid per run — deliberately not QAAPI-U1/U2/U3, whose zone `h.agent` establishes |
| due_at | `2026-08-20T08:00:00.000Z` |
| titles | `qaapi-zoneless-*` (suite namespace, §10) |

## Notes
- **Own-mutation check** (`_qa-foundations.md §5`): removing the refusal turns
  steps 1's two assertions red; making the read refuse as well turns step 4 red.
  The case therefore distinguishes the two behaviours rather than asserting
  their agreement.
- The F-005 suite has its own AC-44 cases covering the refusal across all four
  write doors and the zone's first-report-wins rule. This case is narrower on
  purpose: its subject is **this file's harness default**, which is why it lives
  here and not there.
