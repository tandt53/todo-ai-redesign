# Run record: F-001 API integration suite — phase: execute

| Field | Value |
|---|---|
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Agent | qa-api-agent |
| Phase | execute (T-007b, dispatched by orchestrator after Gate 2 found the authored suite had never run) |
| Date | 2026-08-16 |
| Suite | `qa/assistant/automation/api/F-001-voice-assistant-view.spec.ts` |
| Command | `npx vitest run qa/assistant/automation/api` |
| Result | **46 / 46 PASS**, stable across 4 consecutive runs |
| Project gate | `npm run test:all` → **213 / 213 PASS** (10 files) — the 46 failures Gate 2 flagged are gone |

## What was actually wrong (bug report vs. reality)

The orchestrator's bug report named two problems (wrong file name, wrong export
name). Reading the real exports (`src/assistant/api/app.ts`,
`store/memory-store.ts`, `store/store.ts`, `ports/{clock,interpreter}.ts`,
`engine/{turns,undo,serialize,sessions,apply,normalize,task-equals}.ts`)
showed the actual gap was larger: the authoring-phase draft had guessed at a
title-keyed `interpret({transcript, tasks})` port and a nested
`{config: {idleCloseMs, interpreter: {...}}}` deps shape. The real
`Interpreter` port is **handle-based** (ADR-002: candidate tasks arrive as
opaque handles `t1..tn`, never uuids) and `AppDeps` is flat
(`{store, interpreter, clock, idleCloseMs}`). A title-keyed stub could not
have produced a single passing turn against the real engine — this was not a
two-line import fix.

## Wiring rewritten (script fixes — not product bugs)

1. **Imports**: `app.ts` (`createApp`, `AppDeps`), `store/memory-store.ts`
   (`MemoryStore`), `ports/clock.ts` (`FakeClock`), `ports/interpreter.ts`
   (types only) — all now match real exports.
2. **`AppDeps` shape**: flattened to `{store, interpreter, clock, idleCloseMs}`.
3. **Interpreter**: replaced the title-keyed shim with `QaFixtureInterpreter`,
   a from-scratch implementation of the real handle-based `Interpreter` port
   (regex-matched against the same utterances the canonical fixture table
   `qa/assistant/F-001/api/utterance-intent-fixtures.json` documents — that
   file is unchanged and still the authored reference; this class is its
   runtime realization against a real per-turn handle context, which the
   static JSON can't resolve on its own). Undo phrases need no handling here
   at all: the real engine's voice-undo guard (`engine/normalize.ts`)
   intercepts them *before* interpretation, which is what TC-23/24/40's
   zero-AI-call assertions actually prove.
4. **Store fault injector** (TC-02): rewritten from a method-name-regex proxy
   (which could never match the real `Store` port's only two methods,
   `read`/`transact`) to a `Proxy` on `state.tasks` inside `transact()`,
   matching how `applyCreate` actually writes.
5. **Clock**: swapped the hand-rolled `{now:()=>Date, advance}` (wrong return
   type — the real `Clock.now()` returns epoch `number`) for the real
   `FakeClock` class.
6. **Server lifecycle**: `createApp` returns a plain `http.RequestListener`,
   not an app object supertest can safely be handed request-after-request.
   Built one real `http.Server` per test, bound to `127.0.0.1` on an
   ephemeral port, awaited `'listening'`, and closed it in `afterEach` —
   avoiding a documented class of Node/supertest flake (ephemeral ports +
   `globalAgent` keep-alive pooling can route a later test's request to a
   stale, closed server). Disabled `globalAgent.keepAlive` for the same
   reason. This generic Node/supertest correctness fix does not touch any
   assertion.

None of the above changed what any test asserts — every assertion still
derives only from `specs/assistant/{F-001-voice-assistant-view,api-contracts,
data-model}.md` and the two ADR pins, never from engine internals.

## Failures found on first real run, and their triage

3 of 46 failed on the first execution. Per `_qa-foundations.md` §8, each was
re-run 3× in isolation before any classification — all three reproduced
identically every time (`vitest -t "TC-17|TC-30|TC-38"`, 3 runs, same 3
failures each time), ruling out flakiness.

| TC | Symptom | Classification | Root cause |
|---|---|---|---|
| TC-17 | `POST /tasks` → 400 instead of 201 | **Script bug** | Test seeded `priority: 2` (a number). The real endpoint requires `priority: string \| null` (`app.ts` field validator). Fixed to `priority: 'high'`. |
| TC-38 | Same | **Script bug** | Same defect, `priority: 1` in a different test. Same fix. |
| TC-30 | `declined_question_turn_ids` contained one id, not the two expected | **Script bug (test-authoring gap)** | The test asked a second question (clarify) while the first (bulk_delete) was still unresolved, expecting both to end up independently pending. Re-reading AC-10/D2 and `engine/turns.ts`'s `applyInterpretation`: "any unrelated new command supersedes the question" applies to a command that itself asks a new question too — asking Q2 supersedes Q1 immediately, by design (the spec consistently frames "the pending question" as singular). The real engine is behaving exactly per contract; the test's premise (two coexisting pending questions) was never achievable. Rewrote the scenario to assert what's true and still contract-relevant: close declines only the genuinely-pending question and does not overwrite the already-superseded one's resolution. |

### A fourth issue found by re-reading, not by a failure: TC-10 was a false green

While diagnosing TC-30, the same "two pending questions" premise turned up in
TC-10 — but TC-10 had *passed*, for the wrong reason. Its tap-binding
assertion only checked `resolutions[0].question_turn_id === q1`, never
`result`. Since Q1 was actually already superseded by Q2's creation (the
same mechanism as TC-30), the tap's answer landed on `already_resolved`, not
`executed` — and the weak assertion couldn't tell the difference. This is
exactly the "could this pass for the wrong reason?" trap `_qa-foundations`
§3.9 names. Fixed per the same triage (not a product bug — the engine is
correct) by rewriting the scenario to something achievable and still
valuable: an *unclassifiable* utterance does not supersede (a real, useful
distinction from an interpretable command), so a later explicit tap binding
still reaches the same still-pending question and genuinely executes —
now asserting the full `{question_turn_id, result: 'executed'}` object, not
just the id.

**No product bugs filed.** All four issues were in the QA automation itself
(three assertions built on data or scenarios that could never pass against a
contract-compliant server; one weak assertion that masked the same class of
scenario error). Consistent with the orchestrator's expectation given
backend's 73/73 unit tests and 12 clean full-suite runs.

## Drift noted (not fixed — flagged for spec-agent / orchestrator)

`qa/assistant/F-001/api/TC-10-serial-order-and-answer-binding.md` and
`TC-30-explicit-close-declines-idempotent.md` still describe the original
"two simultaneously pending questions" scenario in their step tables. The
automation above no longer matches that wording (for the reason explained
above — that scenario isn't achievable against the real engine, which is
contract-correct). Recommend both `.md` files be revised to match: TC-10 to
the unclassifiable-then-tap scenario, TC-30 to the single-still-pending
scenario. Not changed in this dispatch — out of the scope the orchestrator
set (fix wiring, run for real, triage failures, write the run record); flagged
here per ethos §10 ("leave evidence, not conclusions") rather than silently
edited.

## Evidence

```
$ npx vitest run qa/assistant/automation/api
 Test Files  1 passed (1)
      Tests  46 passed (46)
   Duration  443ms

$ npm run test:all
 Test Files  10 passed (10)
      Tests  213 passed (213)
   Duration  1.06s
```

AC coverage, error-row coverage, and the fixture table are unchanged from
authoring — see `qa/assistant/F-001/api/index.md`.
