# F-001 voice-assistant-view — API test cases (index)

**Authored:** 2026-08-16 by qa-api-agent (T-007b, phase: author) — from spec rev 3 + api-contracts + data-model + ADR-004/005/006 only; no source code read.
**Automation draft:** `qa/assistant/automation/api/F-001-voice-assistant-view.spec.ts` (vitest + supertest in-process, per `specs/_shared/platform/backend.md`).
**Canonical fixture table:** [`utterance-intent-fixtures.json`](utterance-intent-fixtures.json) — shared by QA and implementers; the stub Interpreter resolves interpretation (incl. answer classification) from these rows. Carries the spec-mandated rows: ambiguous answers (UT-ANS-AMBIG-1/2, zero-deletion assertions), internal-ref (UT-INTREF-1), undo phrases (UT-UNDO-*).
**Language re-sync 2026-08-17 (T-070a):** ADR-008 makes English the product language and ADR-006's amendment shrinks `UNDO_PHRASES` to `{"undo"}`. QA expectations follow design and the implementers (ADR-008 § Sequencing). Touched here: TC-14 + UT-LISTQ-1 (`alternative` literal, re-synced from api-contracts.md §9), TC-23 + TC-24 + the UT-UNDO-* rows (undo vocabulary). No case was deleted — the retired Vietnamese phrase became `UT-UNDO-RETIRED-VI` and TC-23 step 7, which assert the ordinary-turn path it now takes.
**Zone re-sync 2026-08-19 (T-166):** ADR-010 / `F-005 AC-44` made `account.timezone` the one source every date computation reads and a zoneless computation `409 TIMEZONE_UNKNOWN`. `seedTask` posts `due_at`, so **TC-14 and TC-17 went red** (`expected 201, got 409`). Fixed at the harness — the supertest client is now `request.agent(server).set('X-Timezone','UTC')`, one default header rather than a per-call edit, because the zone is a property of the client. A second, deliberately **zoneless** agent is kept so the refusal stays assertable; **TC-41** is the case that asserts it. No assertion was weakened and no case was deleted.

**Test data namespace:** task titles `qaapi-*`; reserved user uuids in `qa/_shared/fixtures/api/users.json` (QAAPI-U1/U2/U3). No unscoped destructive operations.

## Test cases

| TC | Title | ACs | Type | Pri |
|----|-------|-----|------|-----|
| [TC-01](TC-01-applied-turn-atomic-read-back.md) | Applying turn lands atomically, read-back visible | AC-1 | happy | P1 |
| [TC-02](TC-02-mid-apply-failure-zero-partial-writes.md) | Mid-apply failure → zero partial writes | AC-1 | edge | P1 |
| [TC-03](TC-03-bulk-delete-gate-applies-nothing.md) | Bulk-delete gate: question, applies nothing, fires at 2 | AC-9, AC-1 | happy | P1 |
| [TC-04](TC-04-single-delete-applies-with-undo.md) | Single delete applies immediately + undo | AC-9, AC-5, AC-4 | happy | P1 |
| [TC-05](TC-05-affirmative-executes-full-anatomy.md) | Affirmative executes, full applied anatomy, one-shot record | AC-10, AC-9 | happy | P1 |
| [TC-06](TC-06-negative-answer-declines.md) | Negative declines, zero deletion | AC-10 | negative | P1 |
| [TC-07](TC-07-supersede-declines-and-proceeds.md) | Unrelated command supersedes + proceeds | AC-10, AC-13 | happy | P1 |
| [TC-08](TC-08-unclassifiable-zero-deletion-question-pending.md) | Unclassifiable: zero deletion, question stays pending | AC-10 | negative | P1 |
| [TC-09](TC-09-late-answer-already-resolved.md) | Late answer never executes — already_resolved | AC-10 | edge | P1 |
| [TC-10](TC-10-serial-order-and-answer-binding.md) | Serial receipt order; unclassifiable doesn't supersede, tap binding executes | AC-10 | edge | P1 |
| [TC-11](TC-11-revalidation-drops-changed-tasks.md) | Affirmative re-validation drops changed tasks | AC-12, AC-10 | edge | P1 |
| [TC-12](TC-12-clarify-candidates-no-mutation.md) | Clarify: real candidates, zero mutation, tap answer | AC-13 | happy | P1 |
| [TC-13](TC-13-no-match-quotes-transcript.md) | No-match: zero mutations, transcript quoted | AC-14 | negative | P1 |
| [TC-14](TC-14-unsupported-query-names-alternative.md) | List question: unsupported_query + alternative | AC-15 | negative | P1 |
| [TC-15](TC-15-undo-edit-restores-fields.md) | Undo edit restores prior fields (read-back) | AC-6, AC-5 | happy | P1 |
| [TC-16](TC-16-undo-create-removes-and-stays-removed.md) | Undo create removes, stays removed; whole-turn scope | AC-6, AC-5 | happy | P1 |
| [TC-17](TC-17-undo-delete-restores-all-fields.md) | Undo delete restores all fields intact | AC-6 | happy | P1 |
| [TC-18](TC-18-undo-refused-not-newest-window-reopens.md) | Undo refused not_newest; window re-opens | AC-6, AC-8 | negative | P1 |
| [TC-19](TC-19-undo-refused-session-closed.md) | Undo refused session_closed | AC-6, AC-8 | negative | P1 |
| [TC-20](TC-20-undo-already-undone-idempotent.md) | Already-undone undo idempotent, no second revert | AC-6 | edge | P1 |
| [TC-21](TC-21-undo-skips-later-mutations-names-skipped.md) | Undo skips later mutations, skipped named | AC-7 | edge | P1 |
| [TC-22](TC-22-undo-all-skipped-nothing-reverted.md) | All skipped → nothing_reverted, never success | AC-7 | boundary | P1 |
| [TC-23](TC-23-voice-undo-guard-no-task-no-ai.md) | Voice-undo guard: real revert, no turn row, zero AI calls | AC-5 | happy | P1 |
| [TC-24](TC-24-voice-undo-no-applied-turn-refusal.md) | Voice undo, no applied turn → visible refusal | AC-5, AC-8 | negative | P1 |
| [TC-25](TC-25-dedupe-replay-terminal-statuses.md) | Per-status dedupe: applied/asked/undone replays | AC-16 | edge | P1 |
| [TC-26](TC-26-failed-turn-retry-same-id.md) | 502 AI_ERROR; failed→pending retry same id | AC-23, AC-24, AC-16 | negative | P1 |
| [TC-27](TC-27-post-close-replay-new-session.md) | Post-close replay: SESSION_CLOSED → new session, id recognized | AC-16, AC-28 | edge | P1 |
| [TC-28](TC-28-concurrent-identical-requests-once.md) | N concurrent identical requests → once; IN_FLIGHT | AC-16 | edge | P1 |
| [TC-29](TC-29-idle-close-boundary-injectable-clock.md) | Idle close at 180 s boundary; single boundary message | AC-28, AC-10, AC-8 | boundary | P1 |
| [TC-30](TC-30-explicit-close-declines-idempotent.md) | Explicit close declines the pending question, keeps resolved ones; idempotent | AC-28, AC-10 | happy | P1 |
| [TC-31](TC-31-resume-open-session-seq-order.md) | Resume open session, history in seq order | AC-28, AC-23 | happy | P1 |
| [TC-32](TC-32-auth-matrix-401.md) | Auth matrix: 401 on all endpoints | AC-1 | security | P1 |
| [TC-33](TC-33-cross-account-isolation-404.md) | Cross-account ids behave as 404, no enumeration | AC-1, AC-6 | security | P1 |
| [TC-34](TC-34-validation-400-matrix.md) | Validation 400 matrix, zero side effects | AC-1, AC-20 | negative | P1 |
| [TC-35](TC-35-turn-response-contract-shape.md) | Contract drift: exact shapes, no undocumented fields | AC-1, AC-16 | edge | P1 |
| [TC-36](TC-36-internal-refs-never-render.md) | Internal refs never render (no uuid/#d tokens) | AC-4 | security | P1 |
| [TC-37](TC-37-text-only-turn-payload.md) | Turn payload is text only, never audio | AC-20 | negative | P1 |
| [TC-38](TC-38-manual-crud-zero-ai-calls.md) | Manual CRUD with zero AI calls | AC-18 | happy | P1 |
| [TC-39](TC-39-cancel-race-late-outcome.md) | Cancel racing apply: sent turn completes, late outcome + Undo | AC-3, AC-28 | edge | P1 |
| [TC-40](TC-40-non-mutating-turns-undo-window.md) | Non-mutating turns neither hold nor end the undo window | AC-8, AC-6, AC-5 | edge | P1 |
| [TC-41](TC-41-zoneless-client-refusal-guard.md) | Zoneless client refused on a date-computing write; read still served (guards this suite's `X-Timezone` default) | F-005 AC-44, AC-13, AC-18 | regression | P1 |

## AC coverage map (api-tagged ACs of spec rev 3)

| AC | TCs | Note |
|----|-----|------|
| AC-1 | TC-01, TC-02, TC-03 (+32/33/34/35 guard rails) | atomicity, carve-out, read-back |
| AC-5 | TC-04, TC-15, TC-16, TC-23, TC-24, TC-40 | tap + voice undo, never-a-task; TC-23 step 7 pins the closed list's **boundary from the outside** — a phrase no longer in it is not short-circuited |
| AC-6 | TC-15, TC-16, TC-17, TC-18, TC-19, TC-20, TC-40 | 3 revert shapes + 3 refusals + idempotency |
| AC-7 | TC-21, TC-22 | skip + all-skipped |
| AC-8 | TC-18, TC-19, TC-24, TC-29, TC-40 | window mechanics (mutating-only key), both close reasons |
| AC-9 | TC-03, TC-04, TC-05 | gate at >1, immediate at 1 |
| AC-10 | TC-05, TC-06, TC-07, TC-08, TC-09, TC-10 (+29/30 close-declines) | full D2 decision table |
| AC-12 | TC-11 | ask-time snapshot re-validation |
| AC-13 | TC-07, TC-12 | clarify + supersede |
| AC-14 | TC-13, TC-23 (step 7) | no-match honesty; step 7 covers the retired undo phrase falling through to no_match |
| AC-15 | TC-14 | |
| AC-16 | TC-25, TC-26, TC-27, TC-28 (+02 step 4, 23 dedupe) | per-status, cross-close, concurrency |
| AC-20 | TC-37 (+34) | text-only api half |
| AC-23 | TC-26, TC-31 | persist-before-interpret |
| AC-24 | TC-26 | api half (explicit error + retryable) |
| AC-28 | TC-27, TC-29, TC-30, TC-31, TC-39 | idle + explicit close, boundary, resume |

Non-api-tagged ACs pinned here because spec Test strategy / briefing mandates their api half: **AC-3** (TC-39), **AC-4** (TC-36, TC-04), **AC-18** (TC-38). All other ACs (2, 11, 17, 19, 21, 22, 25, 26, 27, 29) are web/mobile-only and belong to qa-web/qa-mobile.

## Error-row coverage map (api-contracts error tables)

| Endpoint | Error row | Triggering TC |
|----------|-----------|---------------|
| POST /assistant/turn | 400 VALIDATION | TC-34 |
| POST /assistant/turn | 401 UNAUTHENTICATED | TC-32 |
| POST /assistant/turn | 404 NOT_FOUND (session_id / answer_to_turn_id) | TC-33 |
| POST /assistant/turn | 409 SESSION_CLOSED | TC-27 |
| POST /assistant/turn | 409 IN_FLIGHT | TC-28 |
| POST /assistant/turn | 409 CLIENT_TURN_ID_REUSED | TC-25 (step 4) |
| POST /assistant/turn | 409 UNDO_REFUSED (voice-guard refusal) | TC-24 |
| POST /assistant/turn | 500 APPLY_FAILED | TC-02 |
| POST /assistant/turn | 502 AI_ERROR | TC-26 |
| GET /assistant/session | 401 | TC-32 |
| POST /assistant/session/close | 400 | TC-34 |
| POST /assistant/session/close | 401 | TC-32 |
| POST /assistant/session/close | 404 | TC-33 |
| POST .../undo | 401 | TC-32 |
| POST .../undo | 404 | TC-33 |
| POST .../undo | 409 UNDO_REFUSED not_newest | TC-18 |
| POST .../undo | 409 UNDO_REFUSED session_closed | TC-19 |
| POST .../undo | 409 UNDO_REFUSED not_undoable | TC-24, TC-40 (non-mutating turn / no mutating applied turn) |
| GET /tasks | 401 | TC-32 |
| POST /tasks | 400 / 401 | TC-34 / TC-32 |
| POST /tasks | 409 TASK_ID_EXISTS (client-id collision; own-replay = sync ack) | TC-38 (steps 8–9) |
| PATCH /tasks/{id} | 400 / 401 / 404 | TC-34 / TC-32 / TC-33 |
| DELETE /tasks/{id} | 401 / 404 | TC-32 / TC-33 |
| POST /tasks | 409 TIMEZONE_UNKNOWN (date computation, zone never reported) | TC-41 |

## Open questions — ALL RESOLVED 2026-08-16 (architect-agent pinned them in the contracts)

1. ~~Mid-apply failure status code~~ → **`500 APPLY_FAILED`**, atomic abort, turn `failed` with transcript, same-id retry re-attempts. Contract: api-contracts.md processing rule 6 + turn error table (line 161). TC-02 updated.
2. ~~Refused voice-undo dedupe~~ → the refusal **consumes** the `client_turn_id` via a dedupe record (no turn row); same-id retry re-serves the recorded 409 without re-evaluating. Contract: api-contracts.md rule 3 + turn error table `409 UNDO_REFUSED` (line 160); data-model.md Dedupe retention (lines 71–76). TC-24 updated (steps 5–6).
3. ~~Same id, divergent body~~ → **`409 CLIENT_TURN_ID_REUSED`**, nothing executes; comparison covers `transcript`/`source`/`answer_to_turn_id`, excludes `session_id`/`timezone`. Contract: api-contracts.md rule 2 (lines 77–82) + error table (line 159). TC-25 updated (steps 4–5).
4. ~~Unknown-field policy~~ → **`400 VALIDATION` naming the field, every endpoint**. Contract: api-contracts.md Conventions (lines 17–19). TC-34 updated (steps 13–15); TC-37 step 2 updated (same decision's audio-field half).
5. ~~All-skipped undo turn status~~ → still transitions **`applied → undone`**; the undo is consumed, retry is the AC-6 idempotent replay. Contract: data-model.md UndoResult (lines 104–108). TC-22 updated (steps 3–4).
