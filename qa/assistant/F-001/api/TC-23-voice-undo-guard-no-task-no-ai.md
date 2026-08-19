# TC-23: Voice-undo guard — real revert, no turn row, no task named "undo", zero AI calls

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-23 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-5 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | in-progress |
| Automation file | tests/assistant/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-17 by qa-api-agent |

## Summary
ADR-006 server backstop: a transcript normalizing into `UNDO_PHRASES` (`"undo"` — the whole closed list since ADR-006's amendment of 2026-08-17) sent to POST /assistant/turn is **not interpreted** (harness AI-call counter stays flat), creates **no turn row**, executes the real undo path against the newest applied turn, returns `kind: "undo"`, and can never become a task named "undo" (AC-5). Normalization variants (case, trim, terminal punctuation) all match; a longer paraphrase does not.

**What changed 2026-08-17 (ADR-006 § Amendment, per the owner decision in ADR-008).** `UNDO_PHRASES` was `{"undo", "hoàn tác"}` and is now `{"undo"}`. This TC is unchanged in what it protects — *a phrase in the closed list never reaches the model and never becomes a task* — and a one-element list satisfies that guarantee the same way a two-element one did. What moved is the vocabulary: step 5's three variants are now English, and step 7 is new, asserting the **retirement itself** rather than deleting the Vietnamese coverage.

## Preconditions
- User `QAAPI-U1`; applied create turn (UT-CREATE-1) is the newest applied turn; AI-call counter value captured as `{n0}`; session message count captured.

## Test steps
| # | Method | Path | Headers | Body | Expected status | Assertions |
|---|--------|------|---------|------|-----------------|------------|
| 1 | POST | /assistant/turn | X-User-Id: {U1} | `{transcript: "undo", client_turn_id: {id1}, session_id: {sid}, source: "voice"}` (UT-UNDO-EN) | 200 | `kind: "undo"`, `turn: null`, `undo.undone: true`, `undo.via: "voice"`, `undo.reverted` names the created task |
| 2 | GET | /tasks | X-User-Id: {U1} | — | 200 | created task reverted away; **no task titled "undo"** (or any prefix/variant) exists |
| 3 | — | harness | — | — | — | AI-call counter still `{n0}` — the Interpreter was never called (fixture row `expect_no_interpreter_call`) |
| 4 | GET | /assistant/session | X-User-Id: {U1} | — | 200 | **no new turn row** for `{id1}`; the undone turn carries `undo_result.via: "voice"` with `transcript: "undo"` recorded (ADR-006/data-model) |
| 5 | — | repeat 1–4 with `"  Undo.  "` (UT-UNDO-NORM-1), `"UNDO"` (UT-UNDO-NORM-2), `"undo!"` (UT-UNDO-NORM-3) against fresh applied turns | 200 | normalization: all short-circuit identically, `undo.undone: true`, counter never moves, and the revert really lands (task list empty after each) |
| 6 | POST | /assistant/turn | X-User-Id: {U1} | `{transcript: "undo the last thing", ...}` (UT-UNDO-NOT-GUARD) | 200 | boundary partner: NOT short-circuited — `kind: "turn"`, counter `{n0}+1`, outcome `no_match`; still zero task mutations |
| 7 | POST | /assistant/turn | X-User-Id: {U1} | `{transcript: "hoàn tác", ...}` (UT-UNDO-RETIRED-VI), against a fresh applied create turn | 200 | **retirement, asserted directly** — every clause is step 1's negation: `kind: "turn"` (not `"undo"`), `undo: null`, counter `{n0}+1` (it reaches the interpreter now), outcome `no_match` with `heard_transcript == "hoàn tác"`, a **new turn row exists** (the guard path creates none), no task titled "hoàn tác", the step-7 create is **not** reverted, and the undo window is unspent — a subsequent tap undo of that create still succeeds |

## Expected behaviour
Deterministic guard by construction: exact normalized match on the closed phrase list, before the model, even when the model/stub is down. Dedupe: the outcome is recorded under `{id1}` — a replay of step 1's id re-serves the undo outcome without a second revert (asserted in automation, cross-ref TC-25). Pinned 2026-08-16: the guard targets the newest **mutating** applied turn (non-empty `changed_task_ids`) — intervening no_match/unsupported turns do not divert it (TC-40 step 7 covers the none-exists refusal).

Step 7 is the falsifier for the amendment: re-adding `"hoàn tác"` to `UNDO_PHRASES` turns step 7 red (verified 2026-08-17 by mutating `src/assistant/api/engine/normalize.ts` and restoring it byte-identical). Without it the retirement would be asserted by nothing — a phrase silently dropped from a closed list produces no failing test anywhere, because every remaining assertion is about the phrase that stayed.

## Test data
| Field | Value |
|-------|-------|
| user | QAAPI-U1 |
| utterances | UT-UNDO-EN / NORM-1 / NORM-2 / NORM-3 / NOT-GUARD / RETIRED-VI |

## Notes
Equivalence classes: exact phrase (guard) vs longer utterance (model) vs retired phrase (model, and the class step 7 adds). The zero-AI-call assertion is the fixture table's spec-mandated undo-phrase row requirement.

**Unasserted clause, named rather than dropped.** ADR-006's normalization contract is trim · lowercase · Unicode NFC · strip terminal punctuation. Step 5's three variants cover the first, second and fourth. **NFC has no assertion in this TC any more** — the closed list is now the single ASCII phrase `"undo"`, which has no decomposed form, so there is no utterance that can exercise it through this path. ADR-006 § Amendment keeps NFC deliberately (it is the engine-wide utterance-normalization contract, not a Vietnamese affordance); this note is the record that the coverage went away with the phrase and returns if a non-ASCII phrase ever enters the list.
